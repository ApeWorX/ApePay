import pytest

from apepay import StreamManager


@pytest.fixture(scope="session")
def owner(accounts):
    return accounts[0]


@pytest.fixture(scope="session")
def payer(accounts):
    return accounts[1]


@pytest.fixture(scope="session")
def token(payer, project):
    return payer.deploy(project.TestToken)


@pytest.fixture(scope="session")
def stream_manager_contract(owner, project, token):
    return owner.deploy(project.StreamManager, owner, [token])


@pytest.fixture(scope="session")
def stream_manager(stream_manager_contract):
    return StreamManager(stream_manager_contract)


@pytest.fixture(scope="session")
def stream(stream_manager, token, payer):
    return stream_manager.create(token, 1000, sender=payer)
