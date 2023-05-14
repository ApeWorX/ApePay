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

MAX_REASON_SIZE: constant(uint16) = 1024
MIN_STREAM_LIFE: public(immutable(uint256))


# Permit2 by Uniswap
# See https://docs.uniswap.org/contracts/permit2/reference/signature-transfer

struct TokenPermissions:
    token: address
    amount: uint256


struct PermitTransferFrom:
    permitted: TokenPermissions
    nonce: uint256
    deadline: uint256


struct SignatureTransferDetails:
    receiver: address
    requestedAmount: uint256


interface Permit2:
    def permitTransferFrom(
        permit: PermitTransferFrom,
        transferDetails: SignatureTransferDetails,
        owner: address,
        signature: Bytes[65],
    ): nonpayable


# NOTE: Make this public just so you know what it is for testing
PERMIT2: public(immutable(Permit2))


struct Stream:
    token: ERC20
    amount_per_second: uint256
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
    accepted_tokens: DynArray[ERC20, 20],
):
    # NOTE: Need to make immutable due to Vyper bug disallowing interface constants
    # See https://github.com/vyperlang/vyper/issues/3407
    PERMIT2 = Permit2(0x000000000022D473030F116dDEE9F6B43aC78BA3)
    self.owner = owner
    MIN_STREAM_LIFE = min_stream_life

    for token in accepted_tokens:
        self.token_is_accepted[token] = True


@external
def add_token(token: ERC20):
    assert msg.sender == self.owner
    self.token_is_accepted[token] = True


@external
def remove_token(token: ERC20):
    assert msg.sender == self.owner
    self.token_is_accepted[token] = False


@internal
def _create_stream(
    token: ERC20,
    funded_amount: uint256,
    amount_per_second: uint256,
    reason: Bytes[MAX_REASON_SIZE],
    start_time: uint256,
) -> uint256:
    assert self.token_is_accepted[token]
    assert start_time <= block.timestamp

    assert funded_amount >= max(MIN_STREAM_LIFE, block.timestamp - start_time) * amount_per_second

    stream_id: uint256 = self.num_streams[msg.sender]
    self.streams[msg.sender][stream_id] = Stream({
        token: token,
        amount_per_second: amount_per_second,
        funded_amount: funded_amount,
        start_time: start_time,
        last_pull: start_time,
        reason: reason,
    })
    self.num_streams[msg.sender] = stream_id + 1

    log StreamCreated(token, msg.sender, stream_id, amount_per_second, start_time, reason)

    return stream_id


@external
def create_stream(
    token: ERC20,
    amount_per_second: uint256,
    reason: Bytes[MAX_REASON_SIZE] = b"",
    start_time: uint256 = block.timestamp,
) -> uint256:
    funded_amount: uint256 = token.allowance(msg.sender, self)
    if funded_amount == max_value(uint256):
        funded_amount = token.balanceOf(msg.sender)

    assert token.transferFrom(msg.sender, self, funded_amount, default_return_value=True)

    return self._create_stream(token, funded_amount, amount_per_second, reason, start_time)


@external
def create_stream_with_permit2(
    token: ERC20,
    funded_amount: uint256,
    nonce: uint256,
    deadline: uint256,
    signature: Bytes[65],
    amount_per_second: uint256,
    reason: Bytes[MAX_REASON_SIZE] = b"",
    start_time: uint256 = block.timestamp,
) -> uint256:
    PERMIT2.permitTransferFrom(
        PermitTransferFrom({
            permitted: TokenPermissions({
                token: token.address,
                amount: funded_amount,
            }),
            nonce: nonce,
            deadline: deadline,
        }),
        SignatureTransferDetails({
            receiver: self,
            requestedAmount: funded_amount,
        }),
        msg.sender,
        signature,
    )

    return self._create_stream(token, funded_amount, amount_per_second, reason, start_time)


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
    return self._time_left(creator, stream_id)


@external
def add_funds(creator: address, stream_id: uint256, amount: uint256) -> uint256:
    token: ERC20 = self.streams[creator][stream_id].token
    assert token.transferFrom(msg.sender, self, amount, default_return_value=True)
    self.streams[creator][stream_id].funded_amount += amount
    log StreamFunded(creator, stream_id, amount)
    return self._time_left(creator, stream_id)


@view
@external
def stream_is_cancelable(creator: address, stream_id: uint256) -> bool:
    return self.streams[creator][stream_id].start_time + MIN_STREAM_LIFE <= block.timestamp


@external
def cancel_stream(
    stream_id: uint256,
    reason: Bytes[MAX_REASON_SIZE] = b"",
    creator: address = msg.sender,
) -> uint256:
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
    funded_amount: uint256 = self.streams[creator][stream_id].funded_amount
    withdrawal_amount: uint256 = min(
        self._amount_unlocked(creator, stream_id),
        funded_amount,
    )

    token: ERC20 = self.streams[creator][stream_id].token
    assert token.transfer(self.owner, withdrawal_amount, default_return_value=True)

    self.streams[creator][stream_id].funded_amount = funded_amount - withdrawal_amount
    self.streams[creator][stream_id].last_pull = block.timestamp

    log Withdrawn(creator, stream_id, funded_amount == withdrawal_amount, withdrawal_amount)

    return withdrawal_amount
