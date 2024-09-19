# pragma version ^0.4
from ethereum.ercs import IERC20

from .. import Validator
implements: Validator

MAX_PRODUCTS: constant(uint8) = 20


@external
def validate(
    creator: address,
    token: IERC20,
    amount_per_second: uint256,
    products: DynArray[bytes32, MAX_PRODUCTS],
) -> uint256:
    return max_value(uint256)
