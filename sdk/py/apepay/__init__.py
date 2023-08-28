import json
from datetime import datetime, timedelta
from decimal import Decimal
from functools import partial
from typing import Any, Dict, Iterable, Iterator, List, Optional, Union, cast

from ape.api import ReceiptAPI
from ape.contracts.base import ContractInstance, ContractTransactionHandler
from ape.exceptions import (
    CompilerError,
    ContractLogicError,
    DecodingError,
    ProjectError,
    ContractNotFoundError,
)
from ape.types import AddressType, ContractLog, HexBytes
from ape.utils import BaseInterfaceModel, cached_property
from ethpm_types import ContractType
from pydantic import ValidationError, validator

from .exceptions import (
    FundsNotClaimable,
    MissingCreationReceipt,
    StreamLifeInsufficient,
    StreamNotCancellable,
    TokenNotAccepted,
    ValidatorFailed,
)
from .utils import time_unit_to_timedelta


class Validator(BaseInterfaceModel):
    contract: ContractInstance

    def __hash__(self) -> int:
        return self.contract.address.__hash__()

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, Validator):
            return self.contract.address == other.contract.address

        elif isinstance(other, ContractInstance):
            return self.contract.address == other.address

        # Try __eq__ from the other side.
        return NotImplemented

    def validate(self, creator, token, amount_per_second, reason) -> bool:
        try:
            self.contract.validate.call(creator, token, amount_per_second, reason)
            return True

        except ContractLogicError:
            return False


_ValidatorItem = Union[Validator, ContractInstance, str, AddressType]


class StreamManager(BaseInterfaceModel):
    address: AddressType
    contract_type: Optional[ContractType] = None

    @validator("address", pre=True)
    def normalize_address(cls, value: Any) -> AddressType:
        return cls.conversion_manager.convert(value, AddressType)

    @cached_property
    def _local_contracts(self) -> Dict[str, ContractType]:
        try:
            return self.project_manager.contracts
        except (CompilerError, ProjectError, ValidationError):
            return {}

    @property
    def contract(self) -> ContractInstance:
        return (
            self.project_manager.StreamManager.at(self.address)
            if "StreamManager" in self._local_contracts
            else self.chain_manager.contracts.instance_at(
                self.address, contract_type=self.contract_type
            )
        )

    def __repr__(self) -> str:
        return f"<apepay_sdk.StreamManager address={self.address}>"

    @property
    def owner(self) -> AddressType:
        return self.contract.owner()

    @property
    def validators(self) -> List[Validator]:
        validators = []

        for idx in range(20):
            try:
                validator_address = self.contract.validators(idx)

            except (ContractLogicError, DecodingError):
                # NOTE: Vyper returns no data if not a valid index
                break

            validator_contract = (
                self.project_manager.Validator.at(validator_address)
                if "Validator" in self._local_contracts
                else self.chain_manager.contracts.instance_at(validator_address)
            )
            validators.append(Validator(contract=validator_contract))

        return validators

    def _convert_to_address(self, item: _ValidatorItem) -> str:
        if isinstance(item, Validator):
            return item.contract.address
        elif isinstance(item, ContractInstance):
            return item.address
        else:
            return item

    def set_validators(
        self,
        validators: List[_ValidatorItem],
        **txn_kwargs,
    ) -> ReceiptAPI:
        if len(validators) >= 20:
            raise Validator("Validators full")

        return self.contract.set_validators(
            [self._convert_to_address(v) for v in validators],
            **txn_kwargs,
        )

    def add_validators(
        self,
        *new_validators: Iterable[_ValidatorItem],
        **txn_kwargs,
    ) -> ReceiptAPI:
        return self.set_validators(
            [*self.validators, *new_validators],
            **txn_kwargs,
        )

    def remove_validators(
        self,
        *validators: Iterable[_ValidatorItem],
        **txn_kwargs,
    ) -> ReceiptAPI:
        return self.set_validators(
            list(
                set(map(self._convert_to_address, self.validators))
                - set(map(self._convert_to_address, validators))
            ),
            **txn_kwargs,
        )

    def add_token(
        self, token: Union[ContractInstance, str, AddressType], **txn_kwargs
    ) -> ReceiptAPI:
        return self.contract.add_token(token, **txn_kwargs)

    def remove_token(
        self, token: Union[ContractInstance, str, AddressType], **txn_kwargs
    ) -> ReceiptAPI:
        return self.contract.remove_token(token, **txn_kwargs)

    def is_accepted(self, token: Union[ContractInstance, str, AddressType]):
        return self.contract.token_is_accepted(token)

    @cached_property
    def MIN_STREAM_LIFE(self) -> timedelta:
        return timedelta(seconds=self.contract.MIN_STREAM_LIFE())

    def create(
        self,
        token: ContractInstance,
        amount_per_second: Union[str, int],
        reason: Union[HexBytes, bytes, str, dict, None] = None,
        start_time: Union[datetime, int, None] = None,
        **txn_kwargs,
    ) -> "Stream":
        if not self.contract.token_is_accepted(token):
            raise TokenNotAccepted(str(token))

        if isinstance(amount_per_second, str) and "/" in amount_per_second:
            value, time = amount_per_second.split("/")
            amount_per_second = int(
                self.conversion_manager.convert(value.strip(), int)
                / time_unit_to_timedelta(time).total_seconds()
            )

        if amount_per_second == 0:
            raise ValueError("`amount_per_second` must be greater than 0.")

        args: List[Any] = [token, amount_per_second]

        if reason is not None:
            if isinstance(reason, dict):
                reason = json.dumps(reason, separators=(",", ":"))

            if isinstance(reason, str):
                reason = reason.encode("utf-8")

            args.append(reason)

        if start_time is not None:
            if len(args) == 2:
                args.append(b"")  # Add empty reason string

            if isinstance(start_time, datetime):
                args.append(int(start_time.timestamp()))

            elif isinstance(start_time, int) and start_time < 0:
                args.append(self.chain_manager.pending_timestamp + start_time)

            else:
                args.append(start_time)

        if sender := hasattr(token, "allowance") and txn_kwargs.get("sender"):
            allowance = token.allowance(sender, self.contract)

            if allowance == 2**256 - 1:  # NOTE: Sentinel value meaning "all balance"
                allowance = token.balanceOf(sender)

            stream_life = allowance // amount_per_second

            if stream_life < self.MIN_STREAM_LIFE.total_seconds():
                raise StreamLifeInsufficient(
                    stream_life=timedelta(seconds=stream_life),
                    min_stream_life=self.MIN_STREAM_LIFE,
                )

            validator_args = [sender, *args[:2]]
            # Arg 3 (reason) is optional
            if len(args) == 3:
                validator_args.append(args[2])
            else:
                validator_args.append(b"")
            # Skip arg 4 (start_time)

            for _validator in self.validators:
                if not _validator.validate(*validator_args):
                    raise ValidatorFailed(_validator)

        tx = self.contract.create_stream(*args, **txn_kwargs)
        event = tx.events.filter(self.contract.StreamCreated)[-1]
        return Stream.from_event(
            manager=self,
            event=event,
            is_creation_event=True,
        )

    def streams_by_creator(self, creator: AddressType) -> Iterator["Stream"]:
        for stream_id in range(self.contract.num_streams(creator)):
            yield Stream(manager=self, creator=creator, stream_id=stream_id)

    def all_streams(self, start_block: Optional[int] = None) -> Iterator["Stream"]:
        for stream_created_event in self.contract.StreamCreated.range(
            start_block if start_block is not None else self.contract.receipt.block_number,
            self.chain_manager.blocks.head.number,
        ):
            yield Stream.from_event(
                manager=self,
                event=stream_created_event,
                is_creation_event=True,
            )

    def active_streams(self, start_block: Optional[int] = None) -> Iterator["Stream"]:
        for stream in self.all_streams(start_block=start_block):
            if stream.is_active:
                yield stream

    def unclaimed_streams(self, start_block: Optional[int] = None) -> Iterator["Stream"]:
        for stream in self.all_streams(start_block=start_block):
            if not stream.is_active and stream.amount_unlocked > 0:
                yield stream


class Stream(BaseInterfaceModel):
    manager: StreamManager
    creator: AddressType
    stream_id: int
    creation_receipt: Optional[ReceiptAPI] = None
    transaction_hash: Optional[HexBytes] = None

    @validator("transaction_hash", pre=True)
    def normalize_transaction_hash(cls, value: Any) -> Optional[HexBytes]:
        if value:
            return HexBytes(cls.conversion_manager.convert(value, bytes))

        return value

    @validator("creator", pre=True)
    def validate_addresses(cls, value):
        return (
            value if isinstance(value, str) else cls.conversion_manager.convert(value, AddressType)
        )

    @classmethod
    def from_event(
        cls,
        manager: StreamManager,
        event: ContractLog,
        is_creation_event: bool = False,
    ) -> "Stream":
        return cls(
            manager=manager,
            creator=event.creator,
            stream_id=event.stream_id,
            transaction_hash=event.transaction_hash if is_creation_event else None,
        )

    def to_event(self) -> ContractLog:
        return self.receipt.events.filter(self.manager.contract.StreamCreated)[0]

    @property
    def contract(self) -> ContractInstance:
        return self.manager.contract

    @property
    def receipt(self) -> ReceiptAPI:
        if self.creation_receipt:
            return self.creation_receipt

        if self.transaction_hash:
            receipt = self.chain_manager.get_receipt(self.transaction_hash.hex())
            self.creation_receipt = receipt
            return receipt

        raise MissingCreationReceipt()

    def __repr__(self) -> str:
        return (
            f"<apepay_sdk.Stream address={self.contract.address} "
            f"creator={self.creator} stream_id={self.stream_id}>"
        )

    @property
    def info(self):
        return self.contract.streams(self.creator, self.stream_id)

    @cached_property
    def token(self) -> ContractInstance:
        if "TestToken" in self.project_manager.contracts:
            return self.project_manager.TestToken.at(self.info.token)

        try:
            return self.chain_manager.contracts.instance_at(self.info.token)
        except ContractNotFoundError as err:
            try:
                from ape_tokens.managers import ERC20

                return self.chain_manager.contracts.instance_at(self.info.token, contract_type=ERC20)
            except ImportError:
                raise err

    @cached_property
    def amount_per_second(self) -> int:
        return self.info.amount_per_second

    @property
    def funding_rate(self) -> Decimal:
        """
        Funding rate, in tokens per second, of Stream in correct decimal form.
        """
        return Decimal(self.amount_per_second) / Decimal(10 ** self.token.decimals())

    def estimate_funding(self, period: timedelta) -> int:
        """
        Useful for estimating how many tokens you need to add to extend for a specific time period.
        """
        return int(period.total_seconds() * self.amount_per_second)

    @cached_property
    def start_time(self) -> datetime:
        return datetime.fromtimestamp(self.info.start_time)

    @cached_property
    def reason(self) -> Union[HexBytes, str, dict]:
        try:
            reason_str = self.info.reason.decode("utf-8")

        except Exception:
            return self.info.reason

        try:
            return json.loads(reason_str)

        except (Exception, json.JSONDecodeError):
            return reason_str

    @property
    def last_pull(self) -> datetime:
        return datetime.fromtimestamp(self.info.last_pull)

    @property
    def amount_unlocked(self) -> int:
        return self.contract.amount_unlocked(self.creator, self.stream_id)

    @property
    def amount_left(self) -> int:
        return self.info.funded_amount - self.amount_unlocked

    @property
    def time_left(self) -> timedelta:
        return timedelta(seconds=self.contract.time_left(self.creator, self.stream_id))

    @property
    def is_active(self) -> bool:
        return self.time_left.total_seconds() > 0

    @property
    def add_funds(self) -> ContractTransactionHandler:
        return cast(
            ContractTransactionHandler,
            partial(self.contract.add_funds, self.creator, self.stream_id),
        )

    @property
    def is_cancelable(self) -> bool:
        return self.contract.stream_is_cancelable(self.creator, self.stream_id)

    @property
    def cancel(self) -> ContractTransactionHandler:
        if not self.is_cancelable:
            raise StreamNotCancellable(self.time_left)

        return cast(
            ContractTransactionHandler,
            partial(self.contract.cancel_stream, self.stream_id),
        )

    @property
    def claim(self) -> ContractTransactionHandler:
        if not self.amount_unlocked > 0:
            raise FundsNotClaimable()

        return cast(
            ContractTransactionHandler,
            partial(self.contract.claim, self.creator, self.stream_id),
        )
