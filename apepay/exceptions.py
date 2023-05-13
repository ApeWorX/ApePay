from datetime import timedelta


class ApePayException(Exception):
    pass


class MissingCreationReceipt(ApePayException, NotImplementedError):
    def __init__(self):
        super().__init__(
            "Missing creation transaction for stream. Functionality unavailabie."
        )


class StreamNotCancellable(ApePayException):
    def __init__(self, time_left: timedelta):
        super().__init__(f"Stream not cancelable yet. Please wait: {time_left}")


class FundsNotWithdrawable(ApePayException):
    def __init__(self):
        super().__init__("Stream has no funds left to withdraw.")


class TokenNotAccepted(ApePayException, ValueError):
    def __init__(self, token_details: str):
        super().__init__(f"Token '{token_details}' not accepted.")
