import json
from datetime import datetime, timedelta
from decimal import Decimal
from functools import partial
from typing import TYPE_CHECKING, Any, cast

from ape.api import ReceiptAPI
from ape.contracts.base import ContractInstance, ContractTransactionHandler
from ape.types import AddressType, ContractLog, HexBytes
from ape.utils import BaseInterfaceModel, cached_property
from pydantic import field_validator

from .exceptions import FundsNotClaimable, MissingCreationReceipt

if TYPE_CHECKING:
    from .manager import StreamManager

MAX_DURATION_SECONDS = int(timedelta.max.total_seconds()) - 1


class Stream(BaseInterfaceModel):
    manager: "StreamManager"
    creator: AddressType
    stream_id: int
    creation_receipt: ReceiptAPI | None = None
    transaction_hash: HexBytes | None = None

    @field_validator("transaction_hash", mode="before")
    def normalize_transaction_hash(cls, value: Any) -> HexBytes | None:
        if value:
            return HexBytes(cls.conversion_manager.convert(value, bytes))

        return value

    @field_validator("creator", mode="before")
    def validate_addresses(cls, value):
        return (
            value if isinstance(value, str) else cls.conversion_manager.convert(value, AddressType)
        )

    @classmethod
    def from_event(
        cls,
        manager: "StreamManager",
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
        try:
            from ape_tokens.managers import ERC20  # type: ignore[import-not-found]
        except ImportError:
            ERC20 = None

        return self.chain_manager.contracts.instance_at(self.info.token, contract_type=ERC20)

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
    def reason(self) -> HexBytes | str | dict:
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
    def amount_locked(self) -> int:
        return self.info.funded_amount - self.amount_unlocked

    @property
    def time_left(self) -> timedelta:
        seconds = self.contract.time_left(self.creator, self.stream_id)
        return timedelta(seconds=min(MAX_DURATION_SECONDS, seconds))

    @property
    def total_time(self) -> timedelta:
        info = self.info  # NOTE: Avoid calling contract twice
        # NOTE: Measure time-duration of unclaimed amount remaining (locked and unlocked)
        max_life = int(info.funded_amount / info.amount_per_second)

        return (
            # NOTE: `last_pull == start_time` if never pulled
            datetime.fromtimestamp(info.last_pull)
            - datetime.fromtimestamp(info.start_time)
            + timedelta(seconds=min(MAX_DURATION_SECONDS, max_life))
        )

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
