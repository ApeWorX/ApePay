from datetime import datetime, timedelta

import ape
import pytest
from eth_pydantic_types import HexBytes

from apepay import Validator
from apepay import exceptions as apepay_exc


def test_init(stream_manager, controller, validators, tokens):
    assert stream_manager.MIN_STREAM_LIFE == timedelta(hours=1)
    assert stream_manager.controller == controller
    assert stream_manager.validators == sorted(
        Validator(v, manager=stream_manager) for v in validators
    )

    for token in tokens:
        assert stream_manager.is_accepted(token)


def test_set_validators(stream_manager, controller, create_validator):
    new_validator = create_validator()
    assert new_validator not in stream_manager.validators

    stream_manager.add_validators(new_validator, sender=controller)
    assert new_validator in stream_manager.validators

    stream_manager.remove_validators(new_validator, sender=controller)
    assert new_validator not in stream_manager.validators


def test_add_rm_tokens(stream_manager, controller, tokens, create_token):
    new_token = create_token(controller)
    assert new_token not in tokens
    assert not stream_manager.is_accepted(new_token)

    stream_manager.add_token(new_token, sender=controller)
    assert stream_manager.is_accepted(new_token)

    stream_manager.remove_token(new_token, sender=controller)
    assert not stream_manager.is_accepted(new_token)


@pytest.fixture(scope="session")
def create_stream(stream_manager, payer, MIN_STREAM_LIFE):
    def create_stream(
        token=None, amount_per_second=None, sender=None, allowance=(2**256 - 1), **extra_args
    ):
        if amount_per_second is None:
            # NOTE: Maximum amount we can afford to send (using 1 hr pre-allocation)
            amount_per_second = token.balanceOf(sender or payer) // MIN_STREAM_LIFE

        if token.allowance(sender or payer, stream_manager.contract) != allowance:
            token.approve(stream_manager.contract, allowance, sender=sender or payer)

        return stream_manager.create(
            token,
            amount_per_second,
            **extra_args,
            sender=sender or payer,
        )

    return create_stream


@pytest.mark.parametrize(
    "extra_args",
    [
        dict(),
        # NOTE: Adjust to 32 bytes
        dict(products=[HexBytes(b"Just trying out a product" + b"\x00" * 7)]),
        dict(products=[HexBytes(b"multiple" + b"\x00" * 24), HexBytes(b"products" + b"\x00" * 24)]),
        dict(start_time=-1000),
    ],
)
def test_create_stream(chain, payer, token, create_stream, MIN_STREAM_LIFE, extra_args):
    with pytest.raises(apepay_exc.StreamLifeInsufficient):
        create_stream(token, allowance=0, **extra_args)

    amount_per_second = token.balanceOf(payer) // MIN_STREAM_LIFE

    with pytest.raises(apepay_exc.StreamLifeInsufficient):
        # NOTE: Performs approval
        create_stream(token, amount_per_second=amount_per_second + 1, **extra_args)

    stream = create_stream(token, **extra_args)
    start_time = chain.blocks.head.timestamp

    assert stream.token == token
    assert stream.id == 0
    assert stream.owner == payer
    assert stream.amount_per_second == amount_per_second
    assert stream.products == extra_args.get("products", [])

    expected = datetime.fromtimestamp(start_time + extra_args.get("start_time", 0))
    assert stream.start_time - expected <= timedelta(seconds=1), "Unexpected start time"


@pytest.fixture
def stream(create_stream, token, payer, MIN_STREAM_LIFE):
    # NOTE: Use 2 hour stream life
    amount_per_second = token.balanceOf(payer) // (2 * MIN_STREAM_LIFE)
    return create_stream(token, amount_per_second=amount_per_second)


def test_cancel_stream(chain, token, payer, starting_balance, controller, MIN_STREAM_LIFE, stream):
    with chain.isolate():
        # Owner can cancel at any time
        stream.cancel(b"Because I felt like it", sender=controller)
        assert token.balanceOf(stream.contract) == stream.amount_unlocked
        assert token.balanceOf(payer) == starting_balance - stream.amount_unlocked
        assert not stream.is_active

    with ape.reverts():
        # Payer has to wait `MIN_STREAM_LIFE`
        stream.cancel(sender=payer)

    chain.pending_timestamp += MIN_STREAM_LIFE

    with chain.isolate():
        # Owner can still cancel at any time
        stream.cancel(b"Because I felt like it", sender=controller)
        assert token.balanceOf(stream.contract) == stream.amount_unlocked
        assert token.balanceOf(payer) + stream.amount_unlocked == starting_balance
        assert not stream.is_active

    # Payer can cancel after `MIN_STREAM_LIFE`
    stream.cancel(sender=payer)
    assert token.balanceOf(stream.contract) == stream.amount_unlocked
    assert token.balanceOf(payer) + stream.amount_unlocked == starting_balance
    assert not stream.is_active
