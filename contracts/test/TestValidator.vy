from vyper.interfaces import ERC20

MAX_REASON_SIZE: constant(uint16) = 1024


@external
def validate(
    creator: address,
    token: ERC20,
    amount_per_second: uint256,
    reason: Bytes[MAX_REASON_SIZE],
) -> uint256:
    return max_value(uint256)
