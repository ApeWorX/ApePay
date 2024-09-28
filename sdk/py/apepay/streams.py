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

    @property
    def funding_rate(self) -> Decimal:
        """
        Funding rate, in tokens per second, of Stream in human-readable decimal form.
        """
        info = self.info  # NOTE: Avoid calling contract twice by caching

        return (
            Decimal(info.funded_amount)
            / Decimal(info.expires_at - info.last_claim)
            / Decimal(10 ** self.token.decimals())
        )

    def estimate_funding(self, period: timedelta) -> Decimal:
        """
        Useful for displaying how many tokens you need to add to extend for a specific time period.
        """
        return int(period.total_seconds()) * self.funding_rate

    @cached_property
    def products(self) -> list[HexBytes]:
        # NOTE: This cannot be updated
        return self.info.products

    @property
    def owner(self) -> AddressType:
        return self.info.owner

    @property
    def expires_at(self) -> datetime:
        return datetime.fromtimestamp(self.info.expires_at)

    @property
    def last_update(self) -> datetime:
        return datetime.fromtimestamp(self.info.last_update)

    @property
    def last_claim(self) -> datetime:
        return datetime.fromtimestamp(self.info.last_claim)

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
