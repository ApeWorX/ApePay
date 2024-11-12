from typing import TYPE_CHECKING, Any

from ape.contracts.base import ContractInstance
from ape.types import AddressType
from ape.utils import BaseInterfaceModel
from eth_utils import to_int
from pydantic import field_validator

from .package import MANIFEST

if TYPE_CHECKING:
    from .manager import StreamManager


class Validator(BaseInterfaceModel):
    """
    Wrapper class around a Validator contract that is connected with a specific
    `stream_manager` on chain.
    """

    address: AddressType
    manager: "StreamManager"

    def __init__(self, address: str | AddressType, /, *args, **kwargs):
        kwargs["address"] = address
        super().__init__(*args, **kwargs)

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}({self.address})"

    @field_validator("address", mode="before")
    def normalize_address(cls, value: Any) -> AddressType:
        if isinstance(value, Validator):
            return value.address

        return cls.conversion_manager.convert(value, AddressType)

    @property
    def contract(self) -> ContractInstance:
        return self.chain_manager.contracts.instance_at(
            self.address,
            contract_type=MANIFEST.Validator.contract_type,
        )

    def __hash__(self) -> int:
        # NOTE: So `set` works
        return self.address.__hash__()

    def __gt__(self, other: Any) -> bool:
        # NOTE: So `sorted` works
        if isinstance(other, (Validator, ContractInstance)):
            return to_int(hexstr=self.address.lower()) > to_int(hexstr=other.address.lower())

        return NotImplemented

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, (Validator, ContractInstance)):
            return self.address == other.address

        # Try __eq__ from the other side.
        return NotImplemented

    def __call__(self, *args, **kwargs) -> int:
        return self.contract._mutable_methods_["validate"].call(
            *args,  # NOTE: These must be properly formed downstream before calling
            # NOTE: Imitate that the call is coming from the connected StreamManager, because a
            #       validator can be connected to >1 StreamManagers so context may be important.
            sender=self.manager.address,
            **kwargs,  # NOTE: Do last so it can override above (if necessary)
        )  # Sum of product cost(s) for this particular validator
