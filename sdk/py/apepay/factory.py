from typing import Any

from ape.contracts import ContractInstance
from ape.types import AddressType, BaseInterfaceModel
from pydantic import field_validator

from .exceptions import NoFactoryAvailable
from .manager import StreamManager
from .package import MANIFEST


class StreamFactory(BaseInterfaceModel):
    address: AddressType

    def __init__(self, address=None, /, *args, **kwargs):
        if address is not None:
            kwargs["address"] = address

        elif len(MANIFEST.StreamFactory.deployments) == 0:
            raise NoFactoryAvailable()

        else:
            kwargs["address"] = MANIFEST.StreamFactory.deployments[-1]

        super().__init__(*args, **kwargs)

    def __hash__(self) -> int:
        return self.address.__hash__()

    @field_validator("address", mode="before")
    def normalize_address(cls, value: Any) -> AddressType:
        return cls.conversion_manager.convert(value, AddressType)

    @property
    def contract(self) -> ContractInstance:
        return MANIFEST.StreamFactory.at(self.address)

    def get_deployment(self, deployer: Any) -> StreamManager:
        # TODO: Add product selection to the factory using `product=` kwarg (defaults to empty)
        return StreamManager(self.contract.deployments(deployer))


class Releases:
    def __getitem__(self, release: int) -> StreamFactory:
        if (
            len(MANIFEST.StreamFactory.deployments) < release
            or len(MANIFEST.StreamFactory.deployments) == 0
        ):
            raise IndexError("release index out of range") from NoFactoryAvailable()

        return StreamFactory(MANIFEST.StreamFactory.deployments[release])

    @property
    def latest(self) -> StreamFactory:
        return StreamFactory()


releases = Releases()
