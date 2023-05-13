import json
from datetime import datetime, timedelta
from functools import partial
from typing import Any, Iterator, List, Optional, Union, cast

from ape.api import ReceiptAPI
from ape.contracts.base import ContractInstance, ContractTransactionHandler
from ape.types import AddressType, HexBytes
from ape.utils import ManagerAccessMixin, cached_property


class Stream(ManagerAccessMixin):
    def __init__(
        self,
        contract: ContractInstance,
        creator: AddressType,
        stream_id: int,
        creation_receipt: Optional[ReceiptAPI] = None,
        transaction_hash: Optional[HexBytes] = None,
    ):
        self.contract = contract
        self.creator = creator
        self.stream_id = stream_id
        self.creation_receipt = creation_receipt
        self.transaction_hash = transaction_hash

    def transaction_created(self) -> ReceiptAPI:
        if self.creation_receipt:
            return self.creation_receipt

        if self.transaction_hash:
            return self.chain_manager.get_receipt(self.transaction_hash)

        raise

    def __repr__(self) -> str:
        return (
            f"<apepay_sdk.Stream address={self.contract.address} "
            f"creator={self.creator} stream_id={self.stream_id}>"
        )

    @property
    def info(self):
        return self.contract.streams(self.creator, self.stream_id)

    @cached_property
    def token(self) -> ContractInstance:
        return self.chain_manager.contracts.instance_at(self.info.token)

    @cached_property
    def amount_per_second(self) -> int:
        return self.info.amount_per_second

    @cached_property
    def start_time(self) -> datetime:
        return datetime.fromtimestamp(self.info.start_time)

    @cached_property
    def reason(self) -> Union[HexBytes, str, dict]:
        try:
            reason_str = self.info.reason.decode("utf-8")

        except Exception:
            return self.info.reason

        try:
            return json.loads(reason_str)

        except Exception:
            return reason_str

    @property
    def last_pull(self) -> datetime:
        return datetime.fromtimestamp(self.info.last_pull)

    @property
    def amount_unlocked(self) -> int:
        return self.contract.amount_unlocked(self.creator, self.stream_id)

    @property
    def time_left(self) -> datetime:
        return datetime.fromtimestamp(
            self.contract.time_left(self.creator, self.stream_id)
        )

    @property
    def add_funds(self) -> ContractTransactionHandler:
        return cast(
            ContractTransactionHandler,
            partial(self.contract.add_funds, self.creator, self.stream_id),
        )

    @property
    def is_cancelable(self) -> bool:
        return self.contract.stream_is_cancelable(self.creator, self.stream_id)

    @property
    def cancel(self) -> ContractTransactionHandler:
        if not self.is_cancelable:
            raise

        return cast(
            ContractTransactionHandler,
            partial(self.contract.cancel_stream, self.stream_id),
        )

    @property
    def withdraw(self) -> ContractTransactionHandler:
        if not self.amount_unlocked > 0:
            raise

        return cast(
            ContractTransactionHandler,
            partial(self.contract.withdraw, self.creator, self.stream_id),
        )


class StreamManager(ManagerAccessMixin):
    def __init__(
        self,
        contract: ContractInstance,
    ):
        self.contract = contract

    def __repr__(self) -> str:
        return f"<apepay_sdk.StreamManager address={self.contract.address}>"

    def is_accepted(self, token: Union[ContractInstance, str, AddressType]):
        return self.contract.token_is_accepted(token)

    def create(
        self,
        token: ContractInstance,
        amount_per_second: Union[str, int],
        reason: Union[HexBytes, bytes, str, dict, None] = None,
        start_time: Union[datetime, int, None] = None,
        **txn_kwargs,
    ) -> Stream:
        if not self.contract.token_is_accepted(token):
            raise

        if isinstance(amount_per_second, str):
            value, time = amount_per_second.split("/")

            def coerce_time_unit(time):
                time = time.strip().lower()
                if time in ("week", "day", "hour", "minute", "second"):
                    return f"{time}s"

                shorthand = {
                    "wk": "weeks",
                    "d": "days",
                    "h": "hours",
                    "hr": "hours",
                    "m": "minutes",
                    "min": "minutes",
                    "mins": "minutes",
                    "s": "seconds",
                    "sec": "seconds",
                    "secs": "seconds",
                }

                if time in shorthand:
                    return shorthand[time]

                return time

            amount_per_second = int(
                self.conversion_manager.convert(value.strip(), int)
                / timedelta(**{coerce_time_unit(time): 1}).total_seconds()
            )

        args: List[Any] = [token, amount_per_second]

        if reason is not None:
            if isinstance(reason, dict):
                reason = json.dumps(reason)

            if isinstance(reason, str):
                reason = reason.encode("utf-8")

            args.append(reason)

        if start_time is not None:
            if len(args) == 2:
                args.append(b"")  # Add empty reason string

            if isinstance(start_time, datetime):
                args.append(int(start_time.timestamp()))

            elif isinstance(start_time, int) and start_time < 0:
                args.append(self.chain_manager.pending_timestamp + start_time)

            else:
                args.append(start_time)

        tx = self.contract.create_stream(*args, **txn_kwargs)
        event = tx.events.filter(self.contract.StreamCreated)[0]
        return Stream(
            self.contract, event.creator, event.stream_id, creation_receipt=tx
        )

    def streams_by_creator(self, creator: AddressType) -> Iterator[Stream]:
        for stream_id in range(self.contract.num_streams(creator)):
            yield Stream(self.contract, creator, stream_id)

    def all_streams(self) -> Iterator[Stream]:
        for stream_created_event in self.contract.StreamCreated:
            yield Stream(
                self.contract,
                stream_created_event.creator,
                stream_created_event.stream_id,
                transaction_hash=stream_created_event.transaction_hash,
            )

    def poll_new_streams(self, **polling_kwargs) -> Iterator[Stream]:
        for stream_created_event in self.contract.StreamCreated.poll_logs(
            **polling_kwargs
        ):
            yield Stream(
                self.contract,
                stream_created_event.creator,
                stream_created_event.stream_id,
                transaction_hash=stream_created_event.transaction_hash,
            )

    def poll_cancelled_streams(self, **polling_kwargs) -> Iterator[Stream]:
        for stream_cancelled_event in self.contract.StreamCancelled.poll_logs(
            **polling_kwargs
        ):
            yield Stream(
                self.contract,
                stream_cancelled_event.creator,
                stream_cancelled_event.stream_id,
            )
