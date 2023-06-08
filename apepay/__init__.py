import json
from datetime import datetime, timedelta
from functools import partial
from typing import Any, Iterator, List, Optional, Union, cast, AsyncIterator
from enum import Enum

from ape.api import ReceiptAPI
from ape.contracts.base import ContractInstance, ContractTransactionHandler
from ape.exceptions import ContractLogicError
from ape.types import AddressType, HexBytes, ContractLog
from ape.utils import BaseInterfaceModel, cached_property
from pydantic import validator
from .exceptions import (
    MissingCreationReceipt,
    StreamNotCancellable,
    FundsNotWithdrawable,
    ValidatorFailed,
    TokenNotAccepted,
    StreamLifeInsufficient,
)
from .utils import async_wrap_iter

WARNING_LEVEL = timedelta(minutes=1)  # days=2)
CRITICAL_LEVEL = timedelta(seconds=5)  # hours=12)


class Status(Enum):
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"
    INACTIVE = "inactive"

    @classmethod
    def from_time_left(cls, time_left: timedelta) -> "Status":
        if time_left > WARNING_LEVEL:
            return cls.NORMAL

        elif time_left > CRITICAL_LEVEL:
            return cls.WARNING

        elif time_left.total_seconds() > 0:
            return cls.CRITICAL

        else:
            return cls.INACTIVE


def coerce_time_unit(time):
    time = time.strip().lower()
    if time in ("week", "day", "hour", "minute", "second"):
        return f"{time}s"

    shorthand = {
        "wk": "weeks",
        "d": "days",
        "h": "hours",
        "hr": "hours",
        "m": "minutes",
        "min": "minutes",
        "mins": "minutes",
        "s": "seconds",
        "sec": "seconds",
        "secs": "seconds",
    }

    if time in shorthand:
        return shorthand[time]

    return time


def total_seconds_for_time_unit(time_unit: str) -> int:
    return timedelta(**{coerce_time_unit(time_unit): 1}).total_seconds()


class Validator(BaseInterfaceModel):
    contract: ContractInstance

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, Validator):
            return self.contract == other.contract

        elif isinstance(other, ContractInstance):
            return self.contract == other

        return super().__eq__(other)

    def validate(self, creator, token, amount_per_second, reason) -> bool:
        try:
            self.contract.validate.call(creator, token, amount_per_second, reason)
            return True

        except ContractLogicError:
            return False


class StreamManager(BaseInterfaceModel):
    address: AddressType

    @validator("address", pre=True)
    def normalize_address(cls, value: Any) -> AddressType:
        return cls.conversion_manager.convert(value, AddressType)

    @property
    def contract(self) -> ContractInstance:
        # TODO: Fix this
        return self.project_manager.StreamManager.at(self.address)
        # return self.chain_manager.contracts.instance_at(self.address)

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
                validators.append(
                    Validator(
                        contract=self.project_manager.Validator.at(
                            self.contract.validators(idx)
                        )
                    )
                )
            except ContractLogicError:
                break

        return validators

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
                / total_seconds_for_time_unit(time)
            )

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

            for validator in self.validators:
                if not validator.validate(*validator_args):
                    raise ValidatorFailed(validator)

        tx = self.contract.create_stream(*args, **txn_kwargs)
        event = tx.events.filter(self.contract.StreamCreated)[0]
        return Stream.from_event(
            manager=self,
            event=event,
            is_creation_event=True,
        )

    def streams_by_creator(self, creator: AddressType) -> Iterator["Stream"]:
        for stream_id in range(self.contract.num_streams(creator)):
            yield Stream(self, creator, stream_id)

    def all_streams(self) -> Iterator["Stream"]:
        for stream_created_event in self.contract.StreamCreated:
            yield Stream.from_event(
                manager=self,
                event=stream_created_event,
                is_creation_event=True,
            )

    def active_streams(self) -> Iterator["Stream"]:
        for stream in self.all_streams():
            if stream.is_active:
                yield stream

    def unclaimed_streams(self) -> Iterator["Stream"]:
        for stream in self.all_streams():
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
        # TODO: Fix this
        return self.project_manager.TestToken.at(self.info.token)
        # return self.chain_manager.contracts.instance_at(self.info.token)

    @cached_property
    def amount_per_second(self) -> int:
        return self.info.amount_per_second

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

        except Exception:
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
    def status(self) -> Status:
        return Status.from_time_left(self.time_left)

    @property
    def is_active(self) -> bool:
        return self.status is not Status.INACTIVE

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
    def withdraw(self) -> ContractTransactionHandler:
        if not self.amount_unlocked > 0:
            raise FundsNotWithdrawable()

        return cast(
            ContractTransactionHandler,
            partial(self.contract.withdraw, self.creator, self.stream_id),
        )
