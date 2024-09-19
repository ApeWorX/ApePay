from ethereum.ercs import IERC20

from .. import Validator
implements: Validator

MAX_PRODUCTS: constant(uint8) = 20

owner: public(address)
is_allowed: public(HashMap[address, bool])

event Allowed:
    user: indexed(address)

event Denied:
    user: indexed(address)


@deploy
def __init__(allowed: DynArray[address, 100]):
    self.owner = msg.sender
    for user: address in allowed:
        self.is_allowed[user] = True
        log Allowed(user)


@external
def allow(allowed: DynArray[address, 100]):
    assert msg.sender == self.owner

    for user: address in allowed:
        self.is_allowed[user] = True
        log Allowed(user)


@external
def deny(denied: DynArray[address, 100]):
    assert msg.sender == self.owner

    for user: address in denied:
        self.is_allowed[user] = False
        log Denied(user)


@external
def validate(
    creator: address,
    token: IERC20,
    amount_per_second: uint256,
    products: DynArray[bytes32, MAX_PRODUCTS],
) -> uint256:
    assert self.is_allowed[creator]
    return max_value(uint256)
