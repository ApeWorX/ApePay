# pragma version ^0.4
from ethereum.ercs import IERC20

from .. import Validator
implements: Validator

MAX_PRODUCTS: constant(uint8) = 20


@external
def validate(
    creator: address,
    token: IERC20,
    amount: uint256,
    products: DynArray[bytes32, MAX_PRODUCTS],
) -> uint256:
    rate: uint256 = 0

    for product: bytes32 in products:
        # NOTE: Tokens per second
        rate += convert(product, uint256)

    return amount // rate
