from datetime import datetime

import ape
import pytest
from apepay import exceptions as apepay_exc


def test_init(stream_manager, token):
    assert stream_manager.is_accepted(token)


@pytest.mark.parametrize(
    "extra_args",
    [
        dict(),
        dict(reason="Just trying out a reason"),
        dict(start_time=-1000),
    ],
)
def test_create_stream(chain, payer, token, stream_manager, extra_args):
    # NOTE: Maximum amount we can afford to send (using 1 hr pre-allocation)
    amount_per_second = token.balanceOf(payer) // (60 * 60)

    with pytest.raises(apepay_exc.StreamLifeInsufficient):
        stream_manager.create(token, amount_per_second, sender=payer)

    token.approve(stream_manager.contract, 2**256 - 1, sender=payer)

    with pytest.raises(apepay_exc.StreamLifeInsufficient):
        stream_manager.create(token, amount_per_second + 1, sender=payer)

    start_time = chain.pending_timestamp
    stream = stream_manager.create(token, amount_per_second, **extra_args, sender=payer)

    assert stream.token == token
    assert stream.stream_id == 0
    assert stream.creator == payer
    assert stream.amount_per_second == amount_per_second
    assert stream.reason == extra_args.get("reason", "")
    assert stream.start_time == datetime.fromtimestamp(
        start_time + extra_args.get("start_time", 0)
    )
