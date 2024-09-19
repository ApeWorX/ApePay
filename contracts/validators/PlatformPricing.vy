from ethereum.ercs import IERC20
from ethereum.ercs import IERC20Detailed

from .. import Validator
implements: Validator

MAX_PRODUCTS: constant(uint8) = 20


@view
def _compute_price_v1(product_code: uint256) -> uint256:
    cpu:        uint256 = (product_code >>  8) & 255
    memory:     uint256 = (product_code >> 16) & 255
    networks:   uint256 = (product_code >> 24) & 255
    bots:       uint256 = (product_code >> 32) & 255
    bandwidth:  uint256 = (product_code >> 48) & 255
    history:    uint256 = (product_code >> 56) & 255

    # NOTE: Normalized to dollars in 18 decimal places
    price: uint256 = 13500000000000  # 0.0000135  # base
    price += networks * 13500000000000  # 0.0000135
    price += bots * (
        # NOTE: Fargate costs are way disproportionate, assume average 1% utilization
        (256 * 2**cpu // 1024) * 1700000000000  # 0.0000017
        + memory * 6200000000000  # 0.0000062
    )
    # Recording and Storage
    price += (
        700000000000  # 0.0000007
        * bandwidth // 1024**2
        * 86400 * 30 * history
    )
    # Access (1% average usage of 1k max connections)
    price += bandwidth * 6200000000000  # 0.0000062

    return price


@view
def _compute_price(product_code: uint256) -> uint256:
    if product_code & 255 == 1:
        # NOTE: Underflow if decimals > 18
        return self._compute_price_v1(product_code)

    # else: unsupported version, but don't raise in case it's not a Silverback code
    return 0


@view
@external
def compute_price(token: IERC20Detailed, product_code: bytes32) -> uint256:
    decimals: uint256 = convert(staticcall token.decimals(), uint256)
    return self._compute_price(convert(product_code, uint256)) // 10**(18 - decimals)


@external
def validate(
    creator: address,
    token: IERC20,
    amount_per_second: uint256,
    products: DynArray[bytes32, MAX_PRODUCTS],
) -> uint256:
    decimals: uint256 = convert(staticcall IERC20Detailed(token.address).decimals(), uint256)

    price: uint256 = 0
    for product_code: bytes32 in products:
        price += self._compute_price(convert(product_code, uint256)) // 10**(18 - decimals)

    assert amount_per_second >= price
    # TODO: Account for this inside of StreamManager?
    return max_value(uint256)
