# pragma version ^0.4
from ethereum.ercs import IERC20

from .. import Validator

MAX_REASON_SIZE: constant(uint16) = 1024

implements: Validator

@external
def validate(
    creator: address,
    token: IERC20,
    amount_per_second: uint256,
    reason: Bytes[MAX_REASON_SIZE],
) -> uint256:
    return max_value(uint256)
