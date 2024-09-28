from ethereum.ercs import IERC20

from .. import StreamManager
from .. import Validator
implements: Validator

MAX_PRODUCTS: constant(uint8) = 20

owner: public(address)
is_denied: public(HashMap[address, bool])

event Allowed:
    user: indexed(address)

event Denied:
    user: indexed(address)


@deploy
def __init__(denied: DynArray[address, 100]):
    self.owner = msg.sender
    for user: address in denied:
        self.is_denied[user] = True
        log Allowed(user)


@external
def allow(allowed: DynArray[address, 100]):
    assert msg.sender == self.owner

    for user: address in allowed:
        self.is_denied[user] = False
        log Allowed(user)


@external
def deny(denied: DynArray[address, 100]):
    assert msg.sender == self.owner

    for user: address in denied:
        self.is_denied[user] = True
        log Denied(user)

# TODO: InstantiationException: contracts/StreamManager.vy is not instantiable in calldata
# @external
# def cancel_stream(manager: StreamManager, creator: address, stream_id: uint256):
#     # NOTE: Batch-able via Multicall3
#     assert self.is_denied[creator]
#    extcall manager.cancel_stream(creator, stream_id)


@external
def validate(
    funder: address,
    token: IERC20,
    amount: uint256,
    products: DynArray[bytes32, MAX_PRODUCTS],
) -> uint256:
    assert not self.is_denied[funder]
    return 0  # This validator does not compute any product costs
