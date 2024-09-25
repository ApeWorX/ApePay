from datetime import timedelta
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from . import Validator


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


class StreamLifeInsufficient(ApePayException, ValueError):
    def __init__(self, stream_life: timedelta, min_stream_life: timedelta):
        super().__init__(
            f"Stream life is {stream_life}, which is not sufficient to create stream. "
            f"Excepted at least {min_stream_life} of life for the stream to be created. "
            f"Please wait or back-date stream by {min_stream_life - stream_life} amount "
            "of time to succeed, or approve more token allowance for the stream to use."
        )


class ValidatorFailed(ApePayException, ValueError):
    def __init__(self, validator: "Validator"):
        super().__init__(f"Validator failed: {validator.contract}")
