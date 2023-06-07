# @version 0.3.9

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

from vyper.interfaces import ERC20

from . import Validator


MAX_VALIDATORS: constant(uint8) = 10
validators: public(DynArray[Validator, MAX_VALIDATORS])
MAX_BATCH_SIZE: constant(uint8) = 128

MAX_REASON_SIZE: constant(uint16) = 1024
MIN_STREAM_LIFE: public(immutable(uint256))


struct Stream:
    token: ERC20
    amount_per_second: uint256
    max_stream_life: uint256
    funded_amount: uint256
    start_time: uint256
    last_pull: uint256
    reason: Bytes[MAX_REASON_SIZE]

num_streams: public(HashMap[address, uint256])
streams: public(HashMap[address, HashMap[uint256, Stream]])


owner: public(address)
token_is_accepted: public(HashMap[ERC20, bool])


event StreamCreated:
    token: indexed(ERC20)
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


event Withdrawn:
    creator: indexed(address)
    stream_id: indexed(uint256)
    stream_exhausted: indexed(bool)
    withdrawal_amount: uint256


@external
def __init__(
    owner: address,
    min_stream_life: uint256,  # timedelta in seconds
    validators: DynArray[Validator, MAX_VALIDATORS],
    accepted_tokens: DynArray[ERC20, 20],
):
    self.owner = owner
    MIN_STREAM_LIFE = min_stream_life
    self.validators = validators

    for token in accepted_tokens:
        self.token_is_accepted[token] = True


@external
def set_validators(validators: DynArray[Validator, MAX_VALIDATORS]):
    """
    @dev Set the validators for this contract. 
    @notice This can only be called by the owner of the contract.
    @param validators The validators to use.
    """
    assert msg.sender == self.owner
    self.validators = validators


@external
def add_token(token: ERC20):
    """
    @dev Add a token to the list of accepted tokens. 
    @notice This can only be called by the owner of the contract.
    @param token The token to add.
    """
    assert msg.sender == self.owner
    self.token_is_accepted[token] = True


@external
def remove_token(token: ERC20):
    """
    @dev Remove a token from the list of accepted tokens. 
    @notice This can only be called by the owner of the contract.
    @param token The token to remove.
    """
    assert msg.sender == self.owner
    self.token_is_accepted[token] = False


@external
def create_stream(
    token: ERC20,
    amount_per_second: uint256,
    reason: Bytes[MAX_REASON_SIZE] = b"",
    start_time: uint256 = block.timestamp,
) -> uint256:
    """
    @dev Create a stream targeting the owner of this contract. The stream will
        be funded with the lesser of the `amount_per_second` * `max_stream_life`
        or the `funded_amount` of the token. The `start_time` can be in the
        past, but the stream will not be able to be cancelled until
        `start_time` + `MIN_STREAM_LIFE` has elapsed. 
    @param token The token to use for the stream.
    @param amount_per_second The amount of the token to stream per second.
    @param reason A reason for the stream.
    @param start_time The time to start the stream. 
        Defaults to the current block timestamp.
    @return The id of the stream.
    """
    assert self.token_is_accepted[token]
    assert start_time <= block.timestamp

    funded_amount: uint256 = token.allowance(msg.sender, self)
    if funded_amount == max_value(uint256):
        funded_amount = token.balanceOf(msg.sender)

    max_stream_life: uint256 = max_value(uint256)
    for validator in self.validators:
        # NOTE: Validator either raises or returns a max stream life to use
        max_stream_life = min(
            max_stream_life,
            validator.validate(msg.sender, token.address, amount_per_second, reason),
        )

    assert max_stream_life >= funded_amount / amount_per_second

    prefunded_stream_life: uint256 = max(MIN_STREAM_LIFE, block.timestamp - start_time)
    assert max_stream_life >= prefunded_stream_life
    assert funded_amount >= prefunded_stream_life * amount_per_second

    assert token.transferFrom(msg.sender, self, funded_amount, default_return_value=True)

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
@internal
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
    """
    @dev Get the amount of the stream that is unlocked and available for withdrawal.
    @param creator The creator of the stream.
    @param stream_id The id of the stream.
    @return The amount of the stream that is unlocked and available for withdrawal.
    """
    return self._amount_unlocked(creator, stream_id)


@view
@internal
def _time_left(creator: address, stream_id: uint256) -> uint256:
    unlocked: uint256 = self._amount_unlocked(creator, stream_id)
    return (
        (self.streams[creator][stream_id].funded_amount - unlocked)
        / self.streams[creator][stream_id].amount_per_second
    )


@view
@external
def time_left(creator: address, stream_id: uint256) -> uint256:
    """
    @dev Get the amount of time left in the stream.
    @param creator The creator of the stream.
    @param stream_id The id of the stream.
    @return The amount of time left in the stream.
    """
    return self._time_left(creator, stream_id)


@external
def add_funds(creator: address, stream_id: uint256, amount: uint256) -> uint256:
    """
    @dev Add funds to a stream.
    @param creator The creator of the stream.
    @param stream_id The id of the stream.
    @param amount The amount to add to the stream.
    @return The amount of time left in the stream.
    """
    token: ERC20 = self.streams[creator][stream_id].token
    assert token.transferFrom(msg.sender, self, amount, default_return_value=True)
    self.streams[creator][stream_id].funded_amount += amount

    time_left: uint256 = self._time_left(creator, stream_id)
    assert (
        (time_left + block.timestamp - self.streams[creator][stream_id].start_time)
        <= self.streams[creator][stream_id].max_stream_life
    )

    log StreamFunded(creator, stream_id, amount)
    return time_left


@view
@external
def stream_is_cancelable(creator: address, stream_id: uint256) -> bool:
    """
    @dev Check if a stream is cancelable.
    @param creator The creator of the stream.
    @param stream_id The id of the stream.
    @return True if the stream is cancelable, False otherwise.
    """
    return self.streams[creator][stream_id].start_time + MIN_STREAM_LIFE <= block.timestamp


@external
def cancel_stream(
    stream_id: uint256,
    reason: Bytes[MAX_REASON_SIZE] = b"",
    creator: address = msg.sender,
) -> uint256:
    """
    @dev Cancel a stream. The stream must  must have been created at least `MIN_STREAM_LIFE` ago.
    @param stream_id The id of the stream.
    @param reason The reason for the cancellation.
    @param creator The creator of the stream.
    """
    assert msg.sender in [creator, self.owner]
    assert self.streams[creator][stream_id].start_time + MIN_STREAM_LIFE <= block.timestamp

    funded_amount: uint256 = self.streams[creator][stream_id].funded_amount
    amount_locked: uint256 = funded_amount  - self._amount_unlocked(creator, stream_id)

    token: ERC20 = self.streams[creator][stream_id].token
    assert token.transfer(msg.sender, amount_locked, default_return_value=True)

    self.streams[creator][stream_id].funded_amount = funded_amount - amount_locked

    log StreamCancelled(creator, stream_id, amount_locked, reason)

    return funded_amount - amount_locked


@external
def withdraw(creator: address, stream_id: uint256) -> uint256:
    """
    @dev Withdraw from a stream.
    @param creator The creator of the stream.
    @param stream_id The id of the stream.
    """
    return self._withdraw(creator, stream_id)


@external
def batch_withdraw(creators: DynArray[address, MAX_BATCH_SIZE], stream_ids: DynArray[uint256, MAX_BATCH_SIZE]):
    """
    @dev Withdraw from all streams for a given creator.
    @param creators The creator of the stream.
    """
    assert len(creators) == len(stream_ids), "creators and streams must be the same length"

    for i in range(MAX_BATCH_SIZE):
        if convert(i, uint256) >= len(creators):
            break
        self._withdraw(creators[i], stream_ids[i])


@internal
def _withdraw(creator: address, stream_id: uint256) -> uint256:
    funded_amount: uint256 = self.streams[creator][stream_id].funded_amount
    withdrawal_amount: uint256 = min(
        self._amount_unlocked(creator, stream_id),
        funded_amount,
    )

    if withdrawal_amount == 0:
        return 0

    token: ERC20 = self.streams[creator][stream_id].token
    assert token.transfer(self.owner, withdrawal_amount, default_return_value=True)

    self.streams[creator][stream_id].funded_amount = funded_amount - withdrawal_amount
    self.streams[creator][stream_id].last_pull = block.timestamp

    log Withdrawn(creator, stream_id, funded_amount == withdrawal_amount, withdrawal_amount)

    return withdrawal_amount
