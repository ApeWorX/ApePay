from datetime import datetime, timedelta
from decimal import Decimal

import ape
import pytest

from apepay import exceptions as apepay_exc


def test_create_stream(chain, payer, token, funding_rate, stream_life, create_stream, products):
    with pytest.raises(apepay_exc.NotEnoughAllowance):
        create_stream(allowance=0)

    with pytest.raises(apepay_exc.NotEnoughAllowance):
        create_stream(amount=token.balanceOf(payer) + 1)

    stream = create_stream()
    total_funded = stream.info.funded_amount

    assert stream.id == 0  # Sanity check that isolation is working
    assert stream.token == token
    assert stream.owner == payer
    assert stream.funding_rate == funding_rate
    assert stream.products == products

    assert stream.is_active is True
    assert stream.amount_claimable == 0
    assert stream.amount_refundable == total_funded
    assert stream.time_left == stream_life

    # Mine to the end of the stream
    chain.mine(deltatime=int(stream.time_left.total_seconds()))

    assert stream.is_active is False
    assert stream.amount_claimable == total_funded
    assert stream.amount_refundable == 0
    assert stream.time_left == timedelta(seconds=0)

    # Double check that if you call this at some point after the end, nothing changes
    chain.mine(deltatime=60 * 60)

    assert stream.is_active is False
    assert stream.amount_claimable == total_funded
    assert stream.amount_refundable == 0
    assert stream.time_left == timedelta(seconds=0)


def test_fund_stream(chain, token, payer, stream, stream_life, funding_rate, accounts, controller):
    old_expiry = stream.info.expires_at
    ONE_HOUR = timedelta(hours=1)
    amount = int(
        Decimal(ONE_HOUR.total_seconds())
        * funding_rate
        # NOTE: To undo the adjustment factor
        * Decimal(10 ** token.decimals())
    )

    assert stream.time_left == stream_life

    stream.add_funds(amount, sender=payer)

    # Move the time ahead to the old expiration
    chain.mine(timestamp=old_expiry)
    assert stream.is_active
    assert stream.time_left == ONE_HOUR

    # Anyone can pay
    somebody = accounts[3]
    assert somebody != controller and somebody != payer
    token.transfer(somebody, amount, sender=payer)  # NOTE: payer made token
    token.approve(stream.manager.address, amount, sender=somebody)
    stream.add_funds(amount, sender=somebody)

    # Move the time ahead another hour, should still be time left
    chain.mine(timestamp=old_expiry + int(ONE_HOUR.total_seconds()))
    assert stream.is_active
    assert stream.time_left == ONE_HOUR

    # Now move it to expiry
    chain.mine(deltatime=int(ONE_HOUR.total_seconds()))
    assert not stream.is_active
    assert stream.time_left == timedelta(seconds=0)

    # After expiring, no one can pay
    with ape.reverts():
        stream.add_funds(amount, sender=payer)


def test_cancel_stream(
    chain, token, payer, controller, MIN_STREAM_LIFE, stream_life, funding_rate, stream
):
    # Ensure that we are at 1 second before Stream is cancellable
    cancel_time = stream.last_update + MIN_STREAM_LIFE - timedelta(seconds=1)
    chain.pending_timestamp = int(cancel_time.timestamp())

    # NOTE: `controller` starting balance is 0
    starting_balance = token.balanceOf(payer)
    claimable = int(
        stream.estimate_funding(cancel_time - stream.last_update) * (10 ** token.decimals())
    )
    refundable = stream.info.funded_amount - claimable
    assert token.balanceOf(stream.contract) == refundable + claimable

    with chain.isolate():
        tx = stream.cancel(b"Because I felt like it", sender=controller)
        assert (
            tx.block.timestamp - stream.info.last_update == int(MIN_STREAM_LIFE.total_seconds()) - 1
        )

        # Only claimable amount left in stream
        assert stream.amount_refundable == 0
        assert stream.amount_claimable == token.balanceOf(stream.contract.address) == claimable
        assert token.balanceOf(payer) == starting_balance + refundable
        assert token.balanceOf(controller) == 0  # No claim happened
        assert not stream.is_active

    with ape.reverts():
        # Payer has to wait `MIN_STREAM_LIFE`
        stream.cancel(sender=payer)

    # Now, teleport to the cancellable threshold
    cancel_time = stream.last_update + MIN_STREAM_LIFE
    chain.pending_timestamp = int(cancel_time.timestamp())

    if stream_life == MIN_STREAM_LIFE:
        chain.mine()  # Make sure we are at this block specifially
        assert stream.amount_refundable == 0
        assert stream.amount_claimable == token.balanceOf(stream.contract.address)
        assert token.balanceOf(controller) == 0  # No claim happened
        assert not stream.is_active

        with ape.reverts():
            stream.cancel(sender=controller)

        with ape.reverts():
            stream.cancel(sender=payer)

        return  # NOTE: Skip rest of test because it's no longer able to be cancelled once expired

    claimable = int(
        stream.estimate_funding(cancel_time - stream.last_update) * (10 ** token.decimals())
    )
    refundable = stream.info.funded_amount - claimable
    assert token.balanceOf(stream.contract) == refundable + claimable

    with chain.isolate():
        # Owner can still cancel at any time
        stream.cancel(b"Because I felt like it", sender=controller)
        assert stream.amount_refundable == 0
        assert stream.amount_claimable == token.balanceOf(stream.contract.address) == claimable
        assert token.balanceOf(payer) == starting_balance + refundable
        assert token.balanceOf(controller) == 0  # No claim happened
        assert not stream.is_active

    # Payer can cancel after `MIN_STREAM_LIFE`
    stream.cancel(sender=payer)
    assert stream.amount_refundable == 0
    assert stream.amount_claimable == token.balanceOf(stream.contract.address) == claimable
    assert token.balanceOf(payer) == starting_balance + refundable
    assert token.balanceOf(controller) == 0  # No claim happened
    assert not stream.is_active
