from datetime import datetime, timedelta
from decimal import Decimal
from functools import partial
from typing import TYPE_CHECKING, cast

from ape.contracts.base import ContractInstance, ContractTransactionHandler
from ape.types import AddressType, HexBytes
from ape.utils import BaseInterfaceModel, cached_property

from .exceptions import FundsNotClaimable

if TYPE_CHECKING:
    from .manager import StreamManager

MAX_DURATION_SECONDS = int(timedelta.max.total_seconds()) - 1


class Stream(BaseInterfaceModel):
    manager: "StreamManager"
    id: int

    @property
    def contract(self) -> ContractInstance:
        return self.manager.contract

    def __repr__(self) -> str:
        return f"<apepay_sdk.Stream manager={self.contract.address} id={self.id}>"

    @property
    def info(self):
        return self.contract.streams(self.id)

    @cached_property
    def token(self) -> ContractInstance:
        # NOTE: This cannot be updated
        try:
            from ape_tokens.managers import ERC20  # type: ignore[import-not-found]

        except ImportError:
            ERC20 = None  # type: ignore[assignment]

        return self.chain_manager.contracts.instance_at(self.info.token, contract_type=ERC20)

    @cached_property
    def amount_per_second(self) -> int:
        # NOTE: This cannot be updated
        return self.info.amount_per_second

    @property
    def funding_rate(self) -> Decimal:
        """
        Funding rate, in tokens per second, of Stream in human-readable decimal form.
        """
        return Decimal(self.amount_per_second) / Decimal(10 ** self.token.decimals())

    def estimate_funding(self, period: timedelta) -> Decimal:
        """
        Useful for displaying how many tokens you need to add to extend for a specific time period.
        """
        return int(period.total_seconds()) * self.funding_rate

    @cached_property
    def start_time(self) -> datetime:
        # NOTE: This cannot be updated
        return datetime.fromtimestamp(self.info.start_time)

    @cached_property
    def products(self) -> list[HexBytes]:
        # NOTE: This cannot be updated
        return self.info.products

    @property
    def owner(self) -> AddressType:
        return self.info.owner

    @property
    def last_pull(self) -> datetime:
        return datetime.fromtimestamp(self.info.last_pull)

    @property
    def amount_claimable(self) -> int:
        return self.contract.amount_claimable(self.id)

    @property
    def amount_refundable(self) -> int:
        # NOTE: Max `.amount_claimable` can be is `.funded_amount`
        return self.info.funded_amount - self.amount_claimable

    @property
    def time_left(self) -> timedelta:
        seconds = self.contract.time_left(self.id)
        assert seconds < MAX_DURATION_SECONDS, "Invaraint wrong"
        return timedelta(seconds=seconds)

    @property
    def total_time(self) -> timedelta:
        info = self.info  # NOTE: Avoid calling contract twice by caching

        # NOTE: Measure time-duration of unclaimed amount remaining
        remaining_life = info.funded_amount // info.amount_per_second
        assert remaining_life < MAX_DURATION_SECONDS, "Invariant wrong"

        return (
            # NOTE: `last_pull == start_time` if never pulled
            datetime.fromtimestamp(info.last_pull)
            - datetime.fromtimestamp(info.start_time)
            + timedelta(seconds=remaining_life)
        )

    @property
    def is_active(self) -> bool:
        return self.time_left.total_seconds() > 0

    @property
    def add_funds(self) -> ContractTransactionHandler:
        return cast(
            ContractTransactionHandler,
            partial(self.contract.fund_stream, self.id),
        )

    @property
    def is_cancelable(self) -> bool:
        return self.contract.stream_is_cancelable(self.id)

    @property
    def cancel(self) -> ContractTransactionHandler:
        return cast(
            ContractTransactionHandler,
            partial(self.contract.cancel_stream, self.id),
        )

    @property
    def claim(self) -> ContractTransactionHandler:
        if not self.amount_claimable > 0:
            raise FundsNotClaimable()

        return cast(
            ContractTransactionHandler,
            partial(self.contract.claim_stream, self.id),
        )
