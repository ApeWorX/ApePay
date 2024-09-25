import json
from collections.abc import Iterator
from datetime import datetime, timedelta
from functools import partial, wraps
from typing import TYPE_CHECKING, Any, Callable, Union, cast

from ape.api import ReceiptAPI
from ape.contracts.base import (
    ContractCallHandler,
    ContractEvent,
    ContractInstance,
    ContractTransactionHandler,
)
from ape.exceptions import ContractLogicError, DecodingError
from ape.types import AddressType, HexBytes
from ape.utils import BaseInterfaceModel, cached_property
from ape_ethereum import multicall
from pydantic import field_validator

from .exceptions import StreamLifeInsufficient, TokenNotAccepted, ValidatorFailed
from .package import MANIFEST
from .streams import Stream
from .utils import time_unit_to_timedelta
from .validators import Validator

if TYPE_CHECKING:
    # NOTE: We really only use this for type checking, optional install
    from silverback import SilverbackApp

MAX_DURATION_SECONDS = int(timedelta.max.total_seconds()) - 1

_ValidatorItem = Union[Validator, ContractInstance, AddressType]


class StreamManager(BaseInterfaceModel):
    address: AddressType

    def __init__(self, address, /, *args, **kwargs):
        kwargs["address"] = address
        super().__init__(*args, **kwargs)

    @field_validator("address", mode="before")
    def normalize_address(cls, value: Any) -> AddressType:
        return cls.conversion_manager.convert(value, AddressType)

    @property
    def contract(self) -> ContractInstance:
        return MANIFEST.StreamManager.at(self.address)

    def __repr__(self) -> str:
        return f"<apepay_sdk.StreamManager address={self.address}>"

    @property
    def controller(self) -> AddressType:
        return self.contract.controller()

    @property
    def set_controller(self) -> ContractTransactionHandler:
        return self.contract.set_controller

    @property
    def validators(self) -> list[Validator]:
        call = multicall.Call()
        [call.add(self.contract.validators, idx) for idx in range(20)]
        try:
            return [Validator(addr, manager=self) for addr in call() if addr is not None]

        except multicall.exceptions.UnsupportedChainError:
            pass

        # Handle if multicall isn't available via brute force (e.g. local testing)
        validators = []

        for idx in range(20):  # NOTE: Max of 20 validators per contract
            try:
                validator_address = self.contract.validators(idx)

            except (ContractLogicError, DecodingError):
                # NOTE: Vyper returns no data if not a valid index
                break

            validators.append(Validator(validator_address, manager=self))

        return validators

    @property
    def _parse_validator(self) -> Callable[[_ValidatorItem], Validator]:
        return partial(Validator, manager=self)

    @property
    def set_validators(self) -> ContractTransactionHandler:

        @wraps(self.contract.set_validators)
        def order_validators(*validators: _ValidatorItem, **txn_kwargs) -> ReceiptAPI:
            # NOTE: Always keep sets sorted, ensure no duplicates
            return self.contract.set_validators(
                sorted(v.address for v in set(map(self._parse_validator, validators))),
                **txn_kwargs,
            )

        return cast(ContractTransactionHandler, order_validators)

    def add_validators(self, *new_validators: _ValidatorItem, **txn_kwargs) -> ReceiptAPI:
        return self.set_validators(
            *(set(self.validators) | set(map(self._parse_validator, new_validators))),
            **txn_kwargs,
        )

    def remove_validators(self, *old_validators: _ValidatorItem, **txn_kwargs) -> ReceiptAPI:
        return self.set_validators(
            *(set(self.validators) - set(map(self._parse_validator, old_validators))),
            **txn_kwargs,
        )

    def add_token(self, token: AddressType, **txn_kwargs) -> ReceiptAPI:
        return self.contract.set_token_accepted(token, True, **txn_kwargs)

    def remove_token(self, token: AddressType, **txn_kwargs) -> ReceiptAPI:
        return self.contract.set_token_accepted(token, False, **txn_kwargs)

    def is_accepted(self, token: AddressType) -> bool:
        return self.contract.token_is_accepted(token)

    @cached_property
    def MIN_STREAM_LIFE(self) -> timedelta:
        # NOTE: Immutable in contract
        return timedelta(seconds=self.contract.MIN_STREAM_LIFE())

    def create(
        self,
        token: ContractInstance,
        amount_per_second: str | int,
        products: list[HexBytes] | None = None,
        start_time: datetime | int | None = None,
        max_funding: str | int | None = None,
        **txn_kwargs,
    ) -> "Stream":
        if not self.is_accepted(token.address):
            raise TokenNotAccepted(str(token))

        if isinstance(amount_per_second, str) and "/" in amount_per_second:
            value, time = amount_per_second.split("/")
            amount_per_second = int(
                self.conversion_manager.convert(value.strip(), int)
                / time_unit_to_timedelta(time).total_seconds()
            )

        if amount_per_second == 0:
            raise ValueError("`amount_per_second` must be greater than 0.")

        args: list[Any] = [token, amount_per_second]

        if products is not None:
            args.append(products)

        if max_funding is not None:
            if len(args) == 2:
                args.append([])  # Add empty product list

            args.append(self.conversion_manager.convert(max_funding, int))

        if start_time is not None:
            if len(args) == 2:
                args.append([])  # Add empty product list

            if len(args) == 3:
                args.append(2**256 - 1)

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
            # Arg 3 (products) is optional for create, but not for validator
            if len(args) == 3:
                validator_args.append(args[2])
            else:
                validator_args.append([])
            # Skip arg 4 (max_funding) and 5 (start_time)

            for v in self.validators:
                if not v(*validator_args):
                    raise ValidatorFailed(v)

        tx = self.contract.create_stream(*args, **txn_kwargs)
        # NOTE: Does not require tracing (unlike `.return_value`)
        log = tx.events.filter(self.contract.StreamCreated)[-1]
        return Stream(manager=self, id=log.id)

    def _parse_stream_decorator(self, app: "SilverbackApp", container: ContractEvent):

        def decorator(f):

            @app.on_(container)
            @wraps(f)
            def inner(log):
                return f(Stream(manager=self, id=log.id))

            return inner

        return decorator

    def on_stream_created(self, app: "SilverbackApp"):
        """
        Usage example::

            app = SilverbackApp()
            sm = StreamManager(address=...)

            sm.on_stream_created(app)
            def do_something(stream):
                ...  # Use `stream` to update your infrastructure
        """
        return self._parse_stream_decorator(app, self.contract.StreamCreated)

    def on_stream_funded(self, app: "SilverbackApp"):
        """
        Usage example::

            app = SilverbackApp()
            sm = StreamManager(address=...)

            sm.on_stream_funded(app)
            def do_something(stream):
                ...  # Use `stream` to update your infrastructure
        """
        return self._parse_stream_decorator(app, self.contract.StreamFunded)

    def on_stream_claimed(self, app: "SilverbackApp"):
        """
        Usage example::

            app = SilverbackApp()
            sm = StreamManager(address=...)

            sm.on_stream_claimed(app)
            def do_something(stream):
                ...  # Use `stream` to update your infrastructure
        """
        return self._parse_stream_decorator(app, self.contract.Claimed)

    def on_stream_cancelled(self, app: "SilverbackApp"):
        """
        Usage example::

            app = SilverbackApp()
            sm = StreamManager(address=...)

            sm.on_stream_cancelled(app)
            def do_something(stream):
                ...  # Use `stream` to update your infrastructure
        """
        return self._parse_stream_decorator(app, self.contract.StreamCancelled)

    def all_streams(self) -> Iterator[Stream]:
        for stream_id in range(self.contract.num_streams()):
            yield Stream(manager=self, id=stream_id)

    def active_streams(self) -> Iterator[Stream]:
        for stream in self.all_streams():
            if stream.is_active:
                yield stream

    def unclaimed_streams(self) -> Iterator[Stream]:
        for stream in self.all_streams():
            if stream.amount_unlocked > 0:
                yield stream
