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


# List of Validator contracts to check for Stream creation, funding, migrations
# TODO: Use `Set` to ensure uniqueness, when available
MAX_VALIDATORS: constant(uint8) = 10
validators: public(DynArray[Validator, MAX_VALIDATORS])

MIN_STREAM_LIFE: public(immutable(uint256))
MAX_PRODUCTS: constant(uint8) = 20

struct Stream:
    owner: address
    token: IERC20
    amount_per_second: uint256
    max_stream_life: uint256
    funded_amount: uint256
    start_time: uint256
    last_claim: uint256
    products: DynArray[bytes32, MAX_PRODUCTS]


token_is_accepted: public(HashMap[IERC20, bool])

# Global index of Streams
num_streams: public(uint256)
streams: public(HashMap[uint256, Stream])

# Service Provider (has all Capabilities, also beneficiary of funding)
controller: public(address)
new_controller: public(address)
new_controller_proposed: public(uint256)
CONTROLLER_ACCEPTANCE_DELAY: constant(uint256) = 7 * 24 * 60 * 60  # 1 week

event NewControllerProposed:
    old: indexed(address)
    new: indexed(address)


event NewControllerAccepted:
    old: indexed(address)
    new: indexed(address)


# Delegated Abilities
flag Ability:
    MODFIY_TOKENS
    MODFIY_VALIDATORS
    MODFIY_ACCESS
    CANCEL_STREAMS

capabilities: public(HashMap[address, Ability])


event StreamCreated:
    id: indexed(uint256)
    owner: indexed(address)
    token: indexed(IERC20)
    amount_per_second: uint256
    start_time: uint256
    products: DynArray[bytes32, MAX_PRODUCTS]


event StreamOwnershipUpdated:
    id: indexed(uint256)
    old: indexed(address)
    new: indexed(address)


event StreamFunded:
    id: indexed(uint256)
    funder: indexed(address)
    added: uint256


event StreamClaimed:
    id: indexed(uint256)
    claimer: indexed(address)
    exhausted: indexed(bool)
    claimed: uint256


event StreamCancelled:
    id: indexed(uint256)
    canceller: indexed(address)
    reason: indexed(bytes32)
    refunded: uint256


@deploy
def __init__(
    controller: address,
    min_stream_life: uint256,  # timedelta in seconds
    accepted_tokens: DynArray[IERC20, 20],
    validators: DynArray[Validator, MAX_VALIDATORS],
):
    self.controller = controller
    MIN_STREAM_LIFE = min_stream_life

    for token: IERC20 in accepted_tokens:
        self.token_is_accepted[token] = True

    self.validators = validators


@external
def transfer_control(new_controller: address):
    # NOTE: can revoke transfer at any time calling this method with `self.controller`
    assert msg.sender == self.controller
    self.new_controller = new_controller
    self.new_controller_proposed = block.timestamp

    log NewControllerProposed(msg.sender, new_controller)


@external
def accept_control():
    assert msg.sender == self.new_controller
    assert block.timestamp - self.new_controller_proposed >= CONTROLLER_ACCEPTANCE_DELAY

    log NewControllerAccepted(self.controller, msg.sender)
    self.controller = msg.sender


@external
def set_capabilities(account: address, capabilities: Ability):
    if Ability.MODFIY_ACCESS not in self.capabilities[msg.sender]:
        assert msg.sender == self.controller  # dev: no capabilities

    self.capabilities[account] = capabilities


@external
def set_validators(validators: DynArray[Validator, MAX_VALIDATORS]):
    if Ability.MODFIY_VALIDATORS not in self.capabilities[msg.sender]:
        assert msg.sender == self.controller  # dev: no capabilities

    self.validators = validators


@external
def set_token_accepted(token: IERC20, is_accepted: bool):
    if Ability.MODFIY_TOKENS not in self.capabilities[msg.sender]:
        assert msg.sender == self.controller  # dev: no capabilities

    self.token_is_accepted[token] = is_accepted


@external
def create_stream(
    token: IERC20,
    amount_per_second: uint256,
    products: DynArray[bytes32, MAX_PRODUCTS] = [],
    max_funding: uint256 = max_value(uint256),
    start_time: uint256 = block.timestamp,
) -> uint256:
    assert self.token_is_accepted[token]  # dev: token not accepted
    assert start_time <= block.timestamp  # dev: start time in future

    # NOTE: Only check token balance if opt-in via default setting, otherwise
    #       if set incorrectly then we will fail later on doing `token.transfer`
    funded_amount: uint256 = max_funding
    if funded_amount == max_value(uint256):  # NOTE: Use all token amount
        funded_amount = staticcall token.balanceOf(msg.sender)

    # Check all validators for any unacceptable or incorrect stream parameters
    max_stream_life: uint256 = max_value(uint256)
    for validator: Validator in self.validators:
        # NOTE: Validator either raises or returns a max stream life to use
        max_stream_life = min(
            max_stream_life,
            extcall validator.validate(  # dev: validator failed
                msg.sender, token, amount_per_second, products
            ),
        )

    # Ensure stream life parameters are acceptable
    assert max_stream_life >= funded_amount // amount_per_second  # dev: max stream life too small

    prefunded_stream_life: uint256 = max(
        MIN_STREAM_LIFE, block.timestamp - start_time  # dev: start_time in future
    )
    assert max_stream_life >= prefunded_stream_life  # dev: prefunded stream life too large
    assert funded_amount >= prefunded_stream_life * amount_per_second  # dev: not enough funds

    assert extcall token.transferFrom(  # dev: transfer fail
        msg.sender, self, funded_amount, default_return_value=True
    )

    # Create stream data structure and start streaming
    stream_id: uint256 = self.num_streams
    self.streams[stream_id] = Stream({
        owner: msg.sender,
        token: token,
        amount_per_second: amount_per_second,
        max_stream_life: max_stream_life,
        funded_amount: funded_amount,
        start_time: start_time,
        last_claim: start_time,
        products: products,
    })
    self.num_streams = stream_id + 1

    log StreamCreated(stream_id, msg.sender, token, amount_per_second, start_time, products)

    return stream_id


@external
def set_stream_owner(stream_id: uint256, new_owner: address):
    assert msg.sender == self.streams[stream_id].owner
    self.streams[stream_id].owner = new_owner

    log StreamOwnershipUpdated(stream_id, msg.sender, new_owner)


@view
def _amount_unlocked(stream_id: uint256) -> uint256:
    return min(
        (
            (block.timestamp - self.streams[stream_id].last_claim)
            * self.streams[stream_id].amount_per_second
        ),
        self.streams[stream_id].funded_amount,
    )


@view
@external
def amount_unlocked(stream_id: uint256) -> uint256:
    return self._amount_unlocked(stream_id)


@view
def _time_left(stream_id: uint256) -> uint256:
    return (
        (self.streams[stream_id].funded_amount - self._amount_unlocked(stream_id))
        // self.streams[stream_id].amount_per_second
    )


@view
@external
def time_left(stream_id: uint256) -> uint256:
    return self._time_left(stream_id)


@external
def fund_stream(stream_id: uint256, amount: uint256) -> uint256:
    # NOTE: Anyone can fund a stream
    assert extcall self.streams[stream_id].token.transferFrom(
        msg.sender, self, amount, default_return_value=True
    )
    self.streams[stream_id].funded_amount += amount

    time_left: uint256 = self._time_left(stream_id)
    # TODO: Process with validators again instead of comparing to max_stream_life
    assert (
        (time_left + block.timestamp - self.streams[stream_id].start_time)
        <= self.streams[stream_id].max_stream_life
    )

    log StreamFunded(stream_id, msg.sender, amount)

    return time_left


@view
def _stream_is_cancelable(stream_id: uint256) -> bool:
    # Stream owner needs to wait `MIN_STREAM_LIFE` to cancel a stream
    return block.timestamp - self.streams[stream_id].start_time >= MIN_STREAM_LIFE


@view
@external
def stream_is_cancelable(stream_id: uint256) -> bool:
    return self._stream_is_cancelable(stream_id)


@external
def claim_stream(stream_id: uint256) -> uint256:
    # NOTE: Anyone can claim a stream (for the Controller)
    funded_amount: uint256 = self.streams[stream_id].funded_amount
    claim_amount: uint256 = self._amount_unlocked(stream_id)
    self.streams[stream_id].funded_amount = funded_amount - claim_amount
    self.streams[stream_id].last_claim = block.timestamp

    token: IERC20 = self.streams[stream_id].token
    assert extcall token.transfer(self.controller, claim_amount, default_return_value=True)

    log StreamClaimed(stream_id, msg.sender, funded_amount == claim_amount, claim_amount)

    return claim_amount


@external
def cancel_stream(stream_id: uint256, reason: bytes32 = empty(bytes32)) -> uint256:
    stream_owner: address = self.streams[stream_id].owner
    if msg.sender == stream_owner:
        # Creator needs to wait `MIN_STREAM_LIFE` to cancel a stream
        assert (  # dev: stream not cancellable yet
            block.timestamp - self.streams[stream_id].start_time >= MIN_STREAM_LIFE
        )

    elif Ability.CANCEL_STREAMS not in self.capabilities[msg.sender]:
        # Controller (or those with capability to cancel) can cancel at any time
        assert msg.sender == self.controller  # dev: no capabilities

    funded_amount: uint256 = self.streams[stream_id].funded_amount
    # NOTE: Max that `self._amount_unlocked(...)` can be is `funded_amount`
    refund_amount: uint256 = funded_amount - self._amount_unlocked(stream_id)
    # NOTE: reverts if stream doesn't exist, or already cancelled
    assert refund_amount > 0  # dev: stream already cancelled or completed
    # NOTE: Allows claim to process unlocked amount
    self.streams[stream_id].funded_amount = funded_amount - refund_amount

    # Refund Stream owner
    assert extcall self.streams[stream_id].token.transfer(  # dev: SHOULD NOT HAPPEN
        stream_owner, refund_amount, default_return_value=True
    )

    log StreamCancelled(stream_id, msg.sender, reason, refund_amount)

    return refund_amount
