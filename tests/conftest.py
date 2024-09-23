import pytest

from apepay import StreamManager


@pytest.fixture(scope="session")
def owner(accounts):
    return accounts[0]


@pytest.fixture(scope="session")
def payer(accounts):
    return accounts[1]


@pytest.fixture(scope="session")
def create_token(project):
    def create_token(deployer):
        return deployer.deploy(project.TestToken)

    return create_token


@pytest.fixture(scope="session", params=["0 tokens", "1 token", "2 tokens"])
def tokens(create_token, payer, request):
    return [create_token(payer) for _ in range(int(request.param.split(" ")[0]) + 1)]


@pytest.fixture(scope="session")
def token(tokens):
    if len(tokens) == 0:
        pytest.skip("No valid tokens")

    return tokens[0]


@pytest.fixture(scope="session")
def starting_balance(token, payer):
    # NOTE: All tokens start with the same balance
    return token.balanceOf(payer)


@pytest.fixture(scope="session")
def create_validator(owner, project):
    def create_validator():
        return owner.deploy(project.TestValidator)

    return create_validator


@pytest.fixture(scope="session", params=["0 validators", "1 validator", "2 validators"])
def validators(create_validator, request):
    return [create_validator() for _ in range(int(request.param.split(" ")[0]) + 1)]


@pytest.fixture(scope="session")
def MIN_STREAM_LIFE():
    return 60 * 60  # 1 hour in seconds


@pytest.fixture(scope="session")
def stream_manager_contract(owner, project, MIN_STREAM_LIFE, validators, tokens):
    return owner.deploy(project.StreamManager, owner, MIN_STREAM_LIFE, validators, tokens)


@pytest.fixture(scope="session")
def stream_manager(stream_manager_contract):
    return StreamManager(stream_manager_contract)


@pytest.fixture(scope="session")
def stream(stream_manager, token, payer):
    return stream_manager.create(token, 1000, sender=payer)
