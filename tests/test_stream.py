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
def test_create_stream(chain, payer, tokens, stream_manager, extra_args):
    if len(tokens) == 0:
        pytest.skip("No valid tokens")

    # NOTE: Maximum amount we can afford to send (using 1 hr pre-allocation)
    amount_per_second = tokens[0].balanceOf(payer) // int(
        stream_manager.MIN_STREAM_LIFE.total_seconds()
    )

    with pytest.raises(apepay_exc.StreamLifeInsufficient):
        stream_manager.create(tokens[0], amount_per_second, sender=payer)

    tokens[0].approve(stream_manager.contract, 2**256 - 1, sender=payer)

    with pytest.raises(apepay_exc.StreamLifeInsufficient):
        stream_manager.create(tokens[0], amount_per_second + 1, sender=payer)

    start_time = chain.pending_timestamp
    stream = stream_manager.create(
        tokens[0], amount_per_second, **extra_args, sender=payer
    )

    assert stream.token == tokens[0]
    assert stream.stream_id == 0
    assert stream.creator == payer
    assert stream.amount_per_second == amount_per_second
    assert stream.reason == extra_args.get("reason", "")
    assert stream.start_time == datetime.fromtimestamp(
        start_time + extra_args.get("start_time", 0)
    )

def test_batch_withdraw(chain, payer, owner, tokens, stream_manager):
    if len(tokens) == 0:
        pytest.skip("No valid tokens")
    streams = []
    payers = []
    for i in range(len(tokens)):
        amount_per_second = tokens[i].balanceOf(payer) // int(
            stream_manager.MIN_STREAM_LIFE.total_seconds()
        )

        tokens[i].approve(stream_manager.contract, 2**256 - 1, sender=payer)

        stream = stream_manager.create(
            tokens[i], amount_per_second, sender=payer
        )
        streams.append(stream.stream_id)
        payers.append(payer.address)

    chain.pending_timestamp += 3600 * 12
    stream_manager.batch_withdraw(payers, streams, sender=owner)

