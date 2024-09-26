from collections.abc import Iterator
from datetime import timedelta
from difflib import Differ
from functools import partial, wraps
from typing import TYPE_CHECKING, Any, Callable, Union, cast

import click
from ape.api import ReceiptAPI
from ape.contracts.base import ContractEvent, ContractInstance, ContractTransactionHandler
from ape.exceptions import ContractLogicError, DecodingError
from ape.types import AddressType, HexBytes
from ape.utils import BaseInterfaceModel, cached_property
from ape_ethereum import multicall
from pydantic import field_validator

from .exceptions import (
    NotEnoughAllowance,
    NoValidProducts,
    StreamLifeInsufficient,
    TokenNotAccepted,
)
from .package import MANIFEST
from .streams import Stream
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
        def set_validators(*validators: _ValidatorItem, **txn_kwargs) -> ReceiptAPI:
            # NOTE: Always keep sets sorted, ensure no duplicates
            new_validators = sorted(v.address for v in set(map(self._parse_validator, validators)))
            # NOTE: Okay to use Click here, intended primarily to support interactive features
            click.echo("Validators update:")
            for line in Differ().compare(tuple(v.address for v in self.validators), new_validators):
                click.echo(line)
            return self.contract.set_validators(new_validators, **txn_kwargs)

        return cast(ContractTransactionHandler, set_validators)

    def add_validators(self, *new_validators: _ValidatorItem, **txn_kwargs) -> ReceiptAPI:
        return self.set_validators(
            *(set(self.validators) | set(map(self._parse_validator, new_validators))),
            **txn_kwargs,
        )

    def replace_validator(self, old_validator, new_validator, **txn_kwargs) -> ReceiptAPI:
        return self.set_validators(
            *(
                (set(self.validators) - set([self._parse_validator(old_validator)]))
                | set([self._parse_validator(new_validator)])
            ),
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

    def compute_funding_rate(
        self,
        funder: AddressType,
        token: Any,
        amount: int,
        products: list[HexBytes],
    ) -> int:
        total = 0

        for validator in self.validators:
            try:
                total += validator(funder, token, amount, products)
            except ContractLogicError:
                pass

        return total

    def create(
        self,
        token: ContractInstance,
        amount: str | int,
        products: list[HexBytes],
        min_stream_life: timedelta | int | None = None,
        **txn_kwargs,
    ) -> "Stream":
        if not self.is_accepted(token.address):  # for mypy
            raise TokenNotAccepted(str(token))

        if not isinstance(amount, int):
            amount = self.conversion_manager.convert(amount, int)
        assert isinstance(amount, int)  # for mypy

        args: list[Any] = [token, amount, products]

        if min_stream_life is not None:
            if isinstance(min_stream_life, int):
                min_stream_life = timedelta(seconds=min_stream_life)

            if min_stream_life < self.MIN_STREAM_LIFE:
                raise StreamLifeInsufficient(
                    stream_life=min_stream_life,
                    min_stream_life=self.MIN_STREAM_LIFE,
                )

            args.append(min_stream_life)

        else:
            min_stream_life = self.MIN_STREAM_LIFE
        assert isinstance(min_stream_life, timedelta)  # for mypy

        if sender := txn_kwargs.get("sender"):
            # NOTE: `sender` must always be present, but fallback on ape's exception
            if min(token.balanceOf(sender), token.allowance(sender, self.address)) < amount:
                raise NotEnoughAllowance(self.address)

            amount_per_second = self.compute_funding_rate(sender, token, amount, products)

            if not (amount_per_second) > 0:
                raise NoValidProducts()

            elif (stream_life := timedelta(seconds=amount // amount_per_second)) < min_stream_life:
                raise StreamLifeInsufficient(
                    stream_life=stream_life,
                    min_stream_life=min_stream_life,
                )

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
            if stream.amount_claimable > 0:
                yield stream
