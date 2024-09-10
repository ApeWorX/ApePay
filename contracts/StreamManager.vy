# pragma version 0.4.0

"""
@title StreamManager
@author ApeWorX LTD.
@dev  The Stream contract is owned by `owner`, who is the recipient of all
    streams created by this contract. `owner` can specify any number of payment
    tokens that they can accept as a stream. Anyone can create a stream
    targeting the `owner`, as long as it is one of the tokens that `owner`
    has specified as accepting. Streams can be cancelled after
    `MIN_STREAM_LIFE` has elapsed, and can be backdated if needed.

    The purpose of the streams is usually as an optimistic payment method for
    an off-chain good or service, so the security properties of this contract
    reflect that. As such, in all extraordinary situations, the `owner` should
    have the ability or right to create and enforce the terms that the payment
    is for, this contract simply streamlines the creation and payment of those
    defined goods or services.
"""

from ethereum.ercs import IERC20

from . import Validator


MAX_VALIDATORS: constant(uint8) = 10
validators: public(DynArray[Validator, MAX_VALIDATORS])


MAX_REASON_SIZE: constant(uint16) = 1024
MIN_STREAM_LIFE: public(immutable(uint256))


struct Stream:
    token: IERC20
    amount_per_second: uint256
    max_stream_life: uint256
    funded_amount: uint256
    start_time: uint256
    last_pull: uint256
    reason: Bytes[MAX_REASON_SIZE]

num_streams: public(HashMap[address, uint256])
streams: public(HashMap[address, HashMap[uint256, Stream]])


owner: public(address)
token_is_accepted: public(HashMap[IERC20, bool])


event StreamCreated:
    token: indexed(IERC20)
    creator: indexed(address)
    stream_id: indexed(uint256)
    amount_per_second: uint256
    start_time: uint256
    reason: Bytes[MAX_REASON_SIZE]


event StreamFunded:
    creator: indexed(address)
    stream_id: indexed(uint256)
    amount_added: uint256


event StreamCancelled:
    creator: indexed(address)
    stream_id: indexed(uint256)
    amount_locked: uint256
    reason: Bytes[MAX_REASON_SIZE]


event Claimed:
    creator: indexed(address)
    stream_id: indexed(uint256)
    stream_exhausted: indexed(bool)
    claimed_amount: uint256


@deploy
def __init__(
    owner: address,
    min_stream_life: uint256,  # timedelta in seconds
    validators: DynArray[Validator, MAX_VALIDATORS],
    accepted_tokens: DynArray[IERC20, 20],
):
    self.owner = owner
    MIN_STREAM_LIFE = min_stream_life
    self.validators = validators

    for token: IERC20 in accepted_tokens:
        self.token_is_accepted[token] = True


@external
def set_validators(validators: DynArray[Validator, MAX_VALIDATORS]):
    assert msg.sender == self.owner
    self.validators = validators


@external
def add_token(token: IERC20):
    assert msg.sender == self.owner
    self.token_is_accepted[token] = True


@external
def remove_token(token: IERC20):
    assert msg.sender == self.owner
    self.token_is_accepted[token] = False


@external
def create_stream(
    token: IERC20,
    amount_per_second: uint256,
    reason: Bytes[MAX_REASON_SIZE] = b"",
    start_time: uint256 = block.timestamp,
) -> uint256:
    assert self.token_is_accepted[token]  # dev: token not accepted
    assert start_time <= block.timestamp  # dev: start time in future

    funded_amount: uint256 = staticcall token.allowance(msg.sender, self)
    if funded_amount == max_value(uint256):
        funded_amount = staticcall token.balanceOf(msg.sender)

    max_stream_life: uint256 = max_value(uint256)
    for validator: Validator in self.validators:
        # NOTE: Validator either raises or returns a max stream life to use
        max_stream_life = min(
            max_stream_life,
            extcall validator.validate(msg.sender, token, amount_per_second, reason),
        )

    assert max_stream_life >= funded_amount // amount_per_second  # dev: max stream life too small

    prefunded_stream_life: uint256 = max(MIN_STREAM_LIFE, block.timestamp - start_time)
    assert max_stream_life >= prefunded_stream_life  # dev: prefunded stream life too large
    assert funded_amount >= prefunded_stream_life * amount_per_second  # dev: not enough funds

    assert extcall token.transferFrom(  # dev: transfer fail
        msg.sender, self, funded_amount, default_return_value=True
    )

    stream_id: uint256 = self.num_streams[msg.sender]
    self.streams[msg.sender][stream_id] = Stream({
        token: token,
        amount_per_second: amount_per_second,
        max_stream_life: max_stream_life,
        funded_amount: funded_amount,
        start_time: start_time,
        last_pull: start_time,
        reason: reason,
    })
    self.num_streams[msg.sender] = stream_id + 1

    log StreamCreated(token, msg.sender, stream_id, amount_per_second, start_time, reason)

    return stream_id


@view
def _amount_unlocked(creator: address, stream_id: uint256) -> uint256:
    return min(
        (
            (block.timestamp - self.streams[creator][stream_id].last_pull)
            * self.streams[creator][stream_id].amount_per_second
        ),
        self.streams[creator][stream_id].funded_amount,
    )


@view
@external
def amount_unlocked(creator: address, stream_id: uint256) -> uint256:
    return self._amount_unlocked(creator, stream_id)


@view
def _time_left(creator: address, stream_id: uint256) -> uint256:
    unlocked: uint256 = self._amount_unlocked(creator, stream_id)
    return (
        (self.streams[creator][stream_id].funded_amount - unlocked)
        // self.streams[creator][stream_id].amount_per_second
    )


@view
@external
def time_left(creator: address, stream_id: uint256) -> uint256:
    return self._time_left(creator, stream_id)


@external
def add_funds(creator: address, stream_id: uint256, amount: uint256) -> uint256:
    token: IERC20 = self.streams[creator][stream_id].token
    assert extcall token.transferFrom(msg.sender, self, amount, default_return_value=True)
    self.streams[creator][stream_id].funded_amount += amount

    time_left: uint256 = self._time_left(creator, stream_id)
    assert (
        (time_left + block.timestamp - self.streams[creator][stream_id].start_time)
        <= self.streams[creator][stream_id].max_stream_life
    )

    log StreamFunded(creator, stream_id, amount)
    return time_left


@view
def _stream_is_cancelable(creator: address, stream_id: uint256) -> bool:
    # Creator needs to wait `MIN_STREAM_LIFE` to cancel a stream
    return self.streams[creator][stream_id].start_time + MIN_STREAM_LIFE <= block.timestamp


@view
@external
def stream_is_cancelable(creator: address, stream_id: uint256) -> bool:
    return self._stream_is_cancelable(creator, stream_id)


@external
def cancel_stream(
    stream_id: uint256,
    reason: Bytes[MAX_REASON_SIZE] = b"",
    creator: address = msg.sender,
) -> uint256:
    if msg.sender == creator:
        assert self._stream_is_cancelable(creator, stream_id)
    else:
        # Owner can cancel at any time
        assert msg.sender == self.owner

    funded_amount: uint256 = self.streams[creator][stream_id].funded_amount
    amount_locked: uint256 = funded_amount - self._amount_unlocked(creator, stream_id)
    assert amount_locked > 0  # NOTE: reverts if stream doesn't exist, or already cancelled
    self.streams[creator][stream_id].funded_amount = funded_amount - amount_locked

    token: IERC20 = self.streams[creator][stream_id].token
    assert extcall token.transfer(creator, amount_locked, default_return_value=True)

    log StreamCancelled(creator, stream_id, amount_locked, reason)

    return funded_amount - amount_locked


@external
def claim(creator: address, stream_id: uint256) -> uint256:
    funded_amount: uint256 = self.streams[creator][stream_id].funded_amount
    claim_amount: uint256 = self._amount_unlocked(creator, stream_id)
    self.streams[creator][stream_id].funded_amount = funded_amount - claim_amount
    self.streams[creator][stream_id].last_pull = block.timestamp

    token: IERC20 = self.streams[creator][stream_id].token
    assert extcall token.transfer(self.owner, claim_amount, default_return_value=True)

    log Claimed(creator, stream_id, funded_amount == claim_amount, claim_amount)

    return claim_amount
