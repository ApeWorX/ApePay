# pragma version 0.4.0
"""
@title StreamManager
@author ApeWorX LTD.
@dev The Stream contract is owned by `controller`, who is the recipient of all streams created by
    this contract. The `controller` can specify any number of payment tokens that they can be
    accepted for streaming. Anyone can create a stream targeting the `controller`, as long as it is
    one of the tokens that `controller` has specified as accepting.

    Streams can only be successfully created after passing through a set of payment term Validator
    contracts. Validators can do any arbitrary logic on the parameters of an incoming stream, and
    return a computed streaming rate that is aggregated across all the validators and becomes the
    streaming rate that the Stream will vest funds to the `controller` at.

    Anyone (not just the stream `owner`) can add more paid time to a Stream. Streams can be cancel-
    led by the `owner` at any point after `MIN_STREAM_LIFE` has elapsed, which is a parameter de-
    signed to enforce the amount it takes to provision the product or service being fascilitated by
    this contract.

    The purpose of these Streams is usually as an optimistic payment method for an off-chain good
    or service, so the security properties of this contract reflect that. As such, in all extra-
    ordinary situations, the `controller` should have the ability or right to create and enforce
    the terms that the payment is for, this contract simply streamlines the creation and payment of
    those defined goods or services.
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
    """
    @dev Begin the transfer of the `controller` role to `new_controller`.
    @notice This action is very dangerous! Can only be performed by the `controller`. After the
        transition is initiated, the `new_controller` must wait `CONTROLLER_ACCEPTANCE_DELAY`
        before they are able to accept via `accept_control()`.
    @param new_controller The address of the proposed new `controller` for this contract.
    """
    # NOTE: can revoke transfer at any time calling this method with `self.controller`
    assert msg.sender == self.controller  # dev: not controller

    log NewControllerProposed(msg.sender, new_controller)

    self.new_controller = new_controller
    self.new_controller_proposed = block.timestamp


@external
def accept_control():
    """
    @dev Accept `controller` role and responsibilities.
    @notice This action is very dangerous! Can only be accepted by `new_controller` after waiting
        for a period of `CONTROLLER_ACCEPTANCE_DELAY`. Once accepted, all Streams claimed in the
        future will be routed to the new `controller` instead of the previous one. They also will
        have full and unconditional control over access capabilities for any other address. Note
        that `controller` can prevent this action at any time up to `CONTROLLER_ACCEPTANCE_DELAY`
        by executing `transfer_control()` with themselves (or a different address) as the proposed.
    """
    assert msg.sender == self.new_controller  # dev: not proposed controller
    assert block.timestamp - self.new_controller_proposed >= CONTROLLER_ACCEPTANCE_DELAY

    log NewControllerAccepted(self.controller, msg.sender)

    self.controller = msg.sender
    self.new_controller = empty(address)


@external
def set_capabilities(account: address, capabilities: Ability):
    """
    @dev Set the `capabilities` of `account`.
    @notice This action is very dangerous! Can only be executed by the `controller`, or by another
        account that has the `MODFIY_ACCESS` capability. Please note that any capabilities granted
        go into effect immediately. Any capability can be reverted at any time, but please note
        if granting the `MODFIY_ACCESS` capability to any account, they will have the capability to
        themselves grant that (and any other role) to any other account, presenting a potential
        DDoS risk to the `controller`, and of course other dangerous capabilities that could lead
        to security risks of other natures (such as malcious tokens, validators which cause DDoS).
    @param account The address of the account to grant or revoke `capabilities` to.
    @param capabilities The new set of abilities that `account` should have access to.
    """
    if Ability.MODFIY_ACCESS not in self.capabilities[msg.sender]:
        assert msg.sender == self.controller  # dev: insufficient capability

    self.capabilities[account] = capabilities


@external
def set_validators(validators: DynArray[Validator, MAX_VALIDATORS]):
    """
    @dev Assign the set of validators that should be executed on Stream creation.
    @notice This can only be called by the controller or someone with the MODFIY_VALIDATORS
        capability. It is suggested to ensure that the array contains all unique entries, lest
        unpredictable or actively harmful conditions may happen.
    @param validators The array of validators to assign for this contract.
    """
    if Ability.MODFIY_VALIDATORS not in self.capabilities[msg.sender]:
        assert msg.sender == self.controller  # dev: insufficient capability

    # TODO: Ensure uniqueness using Set
    self.validators = validators


@external
def set_token_accepted(token: IERC20, is_accepted: bool):
    """
    @dev Set whether `token` is accepted by this contract.
    @notice This can only be called by the controller or someone with the MODFIY_TOKENS capability.
        *Please* make sure to be careful with the decimals of the token you add, since those with
        very small values can cause problems since this contracts works with streaming rates of
        token/second. For example, tokens like USDC can cause problems if the value of the product
        is lower than $30/month (vs. USDT which has 18 decimals).
    @param token An ERC20-compatible token to accept or reject.
    @param is_accepted A boolean value that controls whehter `token` is accepted or rejected.
    """
    if Ability.MODFIY_TOKENS not in self.capabilities[msg.sender]:
        assert msg.sender == self.controller  # dev: insufficient capability

    self.token_is_accepted[token] = is_accepted


@external
def create_stream(
    token: IERC20,
    amount: uint256,
    products: DynArray[bytes32, MAX_PRODUCTS],
    min_stream_life: uint256 = MIN_STREAM_LIFE,
) -> uint256:
    """
    @dev Create a streaming payment to `controller` using the given `token`, pre-funded with
        a given `amount` of `token`, in exchange for the provisiong of `products` to the caller,
        for at least `min_stream_life` length of time.
    @notice This function starts the lifecycle of the Stream datastructure. It cannot be revoked
        once called until at least `MIN_STREAM_LIFE` has passed. The stream's parameters flow
        through a series of `validators` to check for their validity and compute the cost of
        provisiong the `products` in the given `token`. The `token` must be accepted by this
        contract.
    @param token An ERC20-compatible token that this contract allows to create streams for.
    @param amount The amount of `token` that should be pre-funded for this stream.
    @param products An array of the product codes this stream should pay for. The product codes are
        treated as application-specific parameters and have no special treatment by this contract.
        Typically, validators are employted to do the specific processing necessary to compute the
        stream rate for the newly created stream.
    @param min_stream_life A safety parameter designed to ensure that the computed stream rate does
        not exceed the value of `amount / min_stream_life` tokens per second. Defaults to
        `MIN_STREAM_LIFE` and is validated not to be below that amount, which is the minimum length
        *any* new stream can be created for (based on the time it takes provision the `products`).
    @return stream_id The globally unique identifier for the newly created stream.
    """
    assert min_stream_life >= MIN_STREAM_LIFE  # dev: stream life not long enough
    assert self.token_is_accepted[token]  # dev: token not accepted

    assert extcall token.transferFrom(  # dev: transfer fail
        msg.sender, self, amount, default_return_value=True
    )

    # Check all validators for any unacceptable or incorrect stream parameters
    amount_per_second: uint256 = 0
    for validator: Validator in self.validators:
        # NOTE: Validator either raises or returns a funding rate to add to the total
        amount_per_second += extcall validator.validate(msg.sender, token, amount, products)

    # Ensure stream life parameters are acceptable to caller
    # NOTE: div/0 if `amount_per_second` is 0, signaling no supported products found
    stream_life: uint256 = amount // amount_per_second  # dev: no valid products detected
    assert min_stream_life <= stream_life  # dev: stream too expensive

    # Create stream data structure and start streaming
    stream_id: uint256 = self.num_streams
    self.streams[stream_id] = Stream({
        owner: msg.sender,
        token: token,
        amount_per_second: amount_per_second,
        funded_amount: amount,
        start_time: block.timestamp,
        last_claim: block.timestamp,
        products: products,
    })
    self.num_streams = stream_id + 1

    log StreamCreated(stream_id, msg.sender, token, amount_per_second, stream_life, products)

    return stream_id


@external
def set_stream_owner(stream_id: uint256, new_owner: address):
    """
    @dev Update the `owner` of the Stream identified by `stream_id` to `new_owner`.
    @notice This action is dangerous! The `new_owner` of the Stream has the unique ability of being
        able to cancel the Stream at any time, leading to potential service interruptions. This
        action takes effect immediately and can only be performed by the current `owner`.
    @param stream_id The identifier of the Stream to transition ownership from.
    @param new_owner The address of the new `owner` of the Stream that should be assigned.
    """
    assert msg.sender == self.streams[stream_id].owner
    self.streams[stream_id].owner = new_owner

    log StreamOwnershipUpdated(stream_id, msg.sender, new_owner)


@view
def _amount_claimable(stream_id: uint256) -> uint256:
    return min(
        (
            (block.timestamp - self.streams[stream_id].last_claim)
            * self.streams[stream_id].amount_per_second
        ),
        # NOTE: After stream expires, should be this
        self.streams[stream_id].funded_amount,
    )


@view
@external
def amount_claimable(stream_id: uint256) -> uint256:
    """
    @dev Obtain the amount of `token` that can be claimed from `stream_id`.
    @notice This is a utility function.
    @param stream_id The identifier of the Stream to check for the amount of `token` that can be
        claimed.
    @returns amount The total amount of `token` that can be claimed at this moment in time.
    """
    return self._amount_claimable(stream_id)


@view
def _time_left(stream_id: uint256) -> uint256:
    return (
        # NOTE: Max is `.funded_amount`
        (self.streams[stream_id].funded_amount - self._amount_claimable(stream_id))
        # NOTE: Cannot div/0 due to max
        // self.streams[stream_id].amount_per_second
    )


@view
@external
def time_left(stream_id: uint256) -> uint256:
    """
    @dev Obtain the amount of time that is left based on the streaming rate of Stream `stream_id`.
    @notice This is a utility function.
    @param stream_id The identifier of the Stream to check for the amount of time left.
    @returns amount The total amount of time left in Stream `stream_id`.
    """
    return self._time_left(stream_id)


@external
def fund_stream(stream_id: uint256, amount: uint256) -> uint256:
    """
    @dev Add `amount` tokens worth of funding to Stream `stream_id`, to extend it's `time_left`.
    @notice This function is unauthenticated and can be called by anyone. This can allow any
        number of use cases such as allowing service self-payment, handling partial refunds or
        settling disputes, or simply gifting users the gift of more time!
    @param stream_id The identifier of the Stream to add `amount` of tokens for.
    @param amount The total amount of tokens to add for Stream `stream_id`.
    @returns time_left The new amount of time left in Stream `stream_id`.
    """
    # NOTE: Anyone can fund a stream
    token: IERC20 = self.streams[stream_id].token
    assert self.token_is_accepted[token]  # dev: token not accepted
    assert extcall token.transferFrom(
        msg.sender, self, amount, default_return_value=True
    )

    self.streams[stream_id].funded_amount += amount
    log StreamFunded(stream_id, msg.sender, amount)

    return self._time_left(stream_id)


@view
def _stream_is_cancelable(stream_id: uint256) -> bool:
    # Stream owner needs to wait `MIN_STREAM_LIFE` to cancel a stream
    return block.timestamp - self.streams[stream_id].start_time >= MIN_STREAM_LIFE


@view
@external
def stream_is_cancelable(stream_id: uint256) -> bool:
    """
    @dev Check if Stream `stream_id` is able to be cancelled, after `MIN_STREAM_LIFE` has expired.
    @notice This is a utility function.
    @param stream_id The identifier of the Stream to check for the ability to cancel.
    @returns is_cancelable Whether Stream `stream_id` is allowed to be cancelled.
    """
    return self._stream_is_cancelable(stream_id)


@internal
def _claim_stream(stream_id: uint256) -> uint256:
    # NOTE: Anyone can claim a stream (for the Controller)
    funded_amount: uint256 = self.streams[stream_id].funded_amount
    claim_amount: uint256 = self._amount_claimable(stream_id)
    self.streams[stream_id].funded_amount = funded_amount - claim_amount
    self.streams[stream_id].last_claim = block.timestamp

    token: IERC20 = self.streams[stream_id].token
    assert extcall token.transfer(self.controller, claim_amount, default_return_value=True)

    log StreamClaimed(stream_id, msg.sender, funded_amount == claim_amount, claim_amount)

    return claim_amount


@external
def claim_stream(stream_id: uint256) -> uint256:
    """
    @dev Claim all vested tokens from Stream `stream_id` and transfer to `controller`.
    @notice This function is unauthenticated and can be called by anyone. This can allow any number
        of use cases such as allowing automated revenue collection and optimization, or to give the
        gift of gas money to `controller`!
    @param stream_id The identifier of the Stream to claim vested tokens for.
    @returns claim_amount The amount of tokens that have been transferred to `controller`.
    """
    return self._claim_stream(stream_id)


@external
def cancel_stream(stream_id: uint256, reason: bytes32 = empty(bytes32)) -> uint256:
    """
    @dev Suspend the streaming of tokens to `controller` for any given `reason`, sending a
        `refund_amount` back to the `owner` of Stream `stream_id`.
    @notice This function can either be called by the `owner` of the stream after waiting
        `MIN_STREAM_LIFE`, or immediately by the `controller` or any other account that has the
        `CANCEL_STREAMS` ability. Note that calling this function also performs a final claim on
        the Stream to the `controller`. No claims or cancellations should be able to be performed
        after this has been called once.
    @param stream_id The identifier of the Stream to cancel for `reason`.
    @param reason A code explaining why the stream was cancelled. Primarily intended for telling
        the `owner` (or any other impacted party) for what reason the stream was closed, but can
        also be used for the `owner` to communicate to the `controller`. Defaults to an empty
        sequence of 32 bytes meaning "no reason".
    @returns refund_amount The amount of `token` that was refunded to `owner` of Stream.
    """
    stream_owner: address = self.streams[stream_id].owner
    if msg.sender == stream_owner:
        # Creator needs to wait `MIN_STREAM_LIFE` to cancel a stream
        assert self._stream_is_cancelable(stream_id)  # dev: stream not cancellable yet

    elif Ability.CANCEL_STREAMS not in self.capabilities[msg.sender]:
        # Controller (or those with capability to cancel) can cancel at any time
        assert msg.sender == self.controller  # dev: insufficient capability

    # Claim means everything is up to date, and anything that is left is refundable
    self._claim_stream(stream_id)

    # NOTE: reverts if stream doesn't exist, or has already been cancelled, or is expired
    refund_amount: uint256 = self.streams[stream_id].funded_amount
    assert refund_amount > 0  # dev: stream already cancelled or completed

    # NOTE: Stream is now completely exhausted, set to 0 funds available
    self.streams[stream_id].funded_amount = 0

    # Refund Stream owner (not whomever cancelled) and send the rest to the controller
    token: IERC20 = self.streams[stream_id].token
    assert extcall token.transfer(stream_owner, refund_amount, default_return_value=True)

    log StreamCancelled(stream_id, msg.sender, reason, refund_amount)

    return refund_amount
