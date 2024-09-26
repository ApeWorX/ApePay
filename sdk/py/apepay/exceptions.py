from datetime import timedelta

from ape.types import AddressType


class ApePayException(Exception):
    pass


class NoFactoryAvailable(ApePayException, RuntimeError):
    def __init__(self):
        super().__init__(
            "No deployment of 'StreamFactory' on this chain, please use an explicit address."
        )


class ManagerDoesNotExist(ApePayException, ValueError):
    def __init__(self):
        super().__init__(
            "Contract does not exist on this chain, please check the address you are using."
        )


class TokenNotAccepted(ApePayException, ValueError):
    def __init__(self, token_details: str):
        super().__init__(f"Token '{token_details}' not accepted.")


class FundsNotClaimable(ApePayException):
    def __init__(self):
        super().__init__("Stream has no funds left to claim.")


class NotEnoughAllowance(ApePayException, ValueError):
    def __init__(self, manager: AddressType):
        super().__init__(f"Not enough allownace, please approve {manager}")


class StreamLifeInsufficient(ApePayException, ValueError):
    def __init__(self, stream_life: timedelta, min_stream_life: timedelta):
        super().__init__(
            f"Stream life is {stream_life}, which is not sufficient to create stream. "
            f"Expected at least {min_stream_life} of life for the stream to be created. "
            "Please increase stream funding amount in order to successfully proceed."
        )


class NoValidProducts(ApePayException, ValueError):
    def __init__(self):
        super().__init__("No valid products in stream creation")
