from datetime import timedelta

import pytest
from eth_pydantic_types import HashBytes32
from eth_utils import to_bytes

from apepay import StreamManager

ONE_HOUR = timedelta(hours=1)


@pytest.fixture(scope="session")
def controller(accounts):
    return accounts[9]


@pytest.fixture(scope="session")
def payer(accounts):
    return accounts[0]


@pytest.fixture(scope="session")
def create_token(project):
    def create_token(deployer):
        return deployer.deploy(project.TestToken)

    return create_token


@pytest.fixture(scope="session")
def token(create_token, payer):
    return create_token(payer)


@pytest.fixture(scope="session")
def starting_balance(token, payer):
    # NOTE: All tokens start with the same balance
    return token.balanceOf(payer)


@pytest.fixture(scope="session")
def create_validator(project, controller):
    def create_validator():
        return controller.deploy(project.TestValidator)

    return create_validator


@pytest.fixture(scope="session")
def validator(create_validator):
    return create_validator()


@pytest.fixture(scope="session")
def MIN_STREAM_LIFE():
    return ONE_HOUR


@pytest.fixture(scope="session")
def stream_manager_contract(project, controller, token, validator, MIN_STREAM_LIFE):
    return project.StreamManager.deploy(
        controller,
        int(MIN_STREAM_LIFE.total_seconds()),
        [token],
        [validator],
        sender=controller,
    )


@pytest.fixture(scope="session")
def stream_manager(stream_manager_contract):
    return StreamManager(stream_manager_contract)


@pytest.fixture(scope="session", params=["1 product", "2 products", "3 products"])
def products(request):
    return [
        # NOTE: 0x[25 empty bytes]01 ~= 0.00028... tokens/second ~= 1.01... tokens/hr
        #       also, `sum(1, 2, 3, ..., n) = n * (n - 1) / 2`
        HashBytes32(b"\x00" * 25 + to_bytes(product_code) + b"\x00" * 6)
        for product_code in range(1, int(request.param.split(" ")[0]) + 1)
    ]


@pytest.fixture(scope="session", params=["1 hour", "2 hours", "12 hours"])
def stream_duration(request):
    return int(request.param.split(" ")[0]) * ONE_HOUR


@pytest.fixture(scope="session")
def create_stream(chain, stream_manager, token, payer, products, stream_duration):
    # TODO: Remove when https://github.com/ApeWorX/ape/pull/2277 merges
    with chain.isolate():

        def create_stream(amount=None, sender=None, allowance=(2**256 - 1), **txn_args):
            if amount is None:
                amount_per_second = stream_manager.compute_funding_rate(
                    payer, token, allowance, products
                )
                amount = amount_per_second * int(stream_duration.total_seconds())
                assert amount <= token.balanceOf(sender or payer)

            if token.allowance(sender or payer, stream_manager.address) != allowance:
                token.approve(stream_manager.address, allowance, sender=(sender or payer))

            return stream_manager.create(
                token, amount, products, sender=(sender or payer), **txn_args
            )

        yield create_stream


@pytest.fixture(scope="session")
def stream(create_stream):
    return create_stream()
