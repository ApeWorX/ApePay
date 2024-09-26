from datetime import timedelta

import ape
import pytest
from eth_utils import to_int

from apepay import exceptions as apepay_exc


def test_create_stream(payer, token, create_stream, products):
    with pytest.raises(apepay_exc.NotEnoughAllowance):
        create_stream(allowance=0)

    with pytest.raises(apepay_exc.NotEnoughAllowance):
        create_stream(amount=token.balanceOf(payer) + 1)

    amount_per_second = sum(map(to_int, products))

    stream = create_stream()

    assert stream.token == token
    assert stream.id == 0
    assert stream.owner == payer
    assert stream.amount_per_second == amount_per_second
    assert stream.products == products
    assert stream.time_left == timedelta(seconds=stream.amount_refundable // amount_per_second)


def test_cancel_stream(chain, token, payer, starting_balance, controller, MIN_STREAM_LIFE, stream):
    with chain.isolate():
        # Owner can cancel at any time
        stream.cancel(b"Because I felt like it", sender=controller)
        assert stream.amount_refundable == token.balanceOf(stream.contract) == 0
        assert token.balanceOf(controller) == starting_balance - token.balanceOf(payer)
        assert not stream.is_active

    with ape.reverts():
        # Payer has to wait `MIN_STREAM_LIFE`
        stream.cancel(sender=payer)

    chain.mine(timestamp=int((stream.start_time + MIN_STREAM_LIFE).timestamp()))
    if stream.time_left == timedelta(seconds=0):
        return  # Skip rest of test when `stream_life == MIN_STREAM_LIFE`

    with chain.isolate():
        # Owner can still cancel at any time
        stream.cancel(b"Because I felt like it", sender=controller)
        assert stream.amount_refundable == token.balanceOf(stream.contract) == 0
        assert token.balanceOf(controller) == starting_balance - token.balanceOf(payer)
        assert not stream.is_active

    # Payer can cancel after `MIN_STREAM_LIFE`
    stream.cancel(sender=payer)
    assert stream.amount_refundable == token.balanceOf(stream.contract) == 0
    assert token.balanceOf(controller) == starting_balance - token.balanceOf(payer)
    assert not stream.is_active
