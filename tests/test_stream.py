from datetime import datetime, timedelta
import ape

import pytest
from apepay import exceptions as apepay_exc


def test_init(stream_manager, owner, validators, tokens):
    assert stream_manager.MIN_STREAM_LIFE == timedelta(hours=1)
    assert stream_manager.owner == owner
    assert stream_manager.validators == validators

    for token in tokens:
        assert stream_manager.is_accepted(token)


def test_set_validators(stream_manager, owner, create_validator):
    new_validator = create_validator()
    assert new_validator not in stream_manager.validators

    stream_manager.add_validators(new_validator, sender=owner)
    assert new_validator in stream_manager.validators

    stream_manager.remove_validators(new_validator, sender=owner)
    assert new_validator not in stream_manager.validators


def test_add_rm_tokens(stream_manager, owner, tokens, create_token):
    new_token = create_token(owner)
    assert new_token not in tokens
    assert not stream_manager.is_accepted(new_token)

    stream_manager.add_token(new_token, sender=owner)
    assert stream_manager.is_accepted(new_token)

    stream_manager.remove_token(new_token, sender=owner)
    assert not stream_manager.is_accepted(new_token)


@pytest.fixture(scope="session")
def create_stream(stream_manager, payer, MIN_STREAM_LIFE):
    def create_stream(token=None, amount_per_second=None, sender=None, allowance=(2**256-1), **extra_args):
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
        dict(reason="Just trying out a reason"),
        dict(
            reason={
                "ecosystem_id": 13,
                "custom_block_time": 10,
                "bot_counts": {"1": 4, "10": 1, "42": 16},
            }
        ),
        dict(start_time=-1000),
    ],
)
def test_create_stream(chain, payer, token, create_stream, MIN_STREAM_LIFE, extra_args):
    with pytest.raises(apepay_exc.StreamLifeInsufficient):
        create_stream(token, allowance=0, **extra_args)

    amount_per_second = (token.balanceOf(payer) // MIN_STREAM_LIFE)

    with pytest.raises(apepay_exc.StreamLifeInsufficient):
        # NOTE: Performs approval
        create_stream(token, amount_per_second=amount_per_second + 1, **extra_args)

    stream = create_stream(token, **extra_args)
    start_time = chain.blocks.head.timestamp

    assert stream.token == token
    assert stream.stream_id == 0
    assert stream.creator == payer
    assert stream.amount_per_second == amount_per_second
    assert stream.reason == extra_args.get("reason", "")

    expected = datetime.fromtimestamp(start_time + extra_args.get("start_time", 0))
    assert stream.start_time - expected <= timedelta(seconds=1), "Unexpected start time"
