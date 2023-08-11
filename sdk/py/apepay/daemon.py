import asyncio
import os
from datetime import timedelta
from enum import Enum

import click
from ape.types import AddressType
from apepay import Stream, StreamManager
from silverback import SilverBackApp

from .settings import Settings

settings = Settings()


class Status(Enum):
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"
    INACTIVE = "inactive"

    @classmethod
    def from_time_left(cls, time_left: timedelta) -> "Status":
        if time_left > settings.WARNING_LEVEL:
            return cls.NORMAL

        elif time_left > settings.CRITICAL_LEVEL:
            return cls.WARNING

        elif time_left.total_seconds() > 0:
            return cls.CRITICAL

        else:
            return cls.INACTIVE


SM = StreamManager(
    address=os.environ.get("APEPAY_CONTRACT_ADDRESS")
    or click.prompt("What address to use?", type=AddressType)
)

app = SilverBackApp()


async def create_task_by_status(stream: Stream):
    time_left = stream.time_left
    stream_status = Status.from_time_left(time_left)

    task = {
        Status.NORMAL: stream_funding_normal_level,
        Status.WARNING: stream_funding_warning_level,
        Status.CRITICAL: stream_funding_critical_level,
        Status.INACTIVE: stream_cancelled,
    }[stream_status]

    if stream_status is Status.INACTIVE:
        await task.kiq(stream.to_event())

    else:
        await task.kicker().with_labels(time_left=time_left).kiq(stream)

    return {"status": stream_status.value}


@app.on_startup()
async def app_started(state):
    return await asyncio.gather(
        # Start watching all active streams and claim any completed but unclaimed streams
        *(
            create_task_by_status(stream)
            for stream in SM.all_streams()
            if stream.is_active or stream.amount_unlocked > 0
        )
    )


@app.on_(SM.contract.StreamCreated)
async def stream_created(event):
    stream = Stream.from_event(
        manager=SM,
        event=event,
        is_creation_event=True,
    )

    return await create_task_by_status(stream)


@app.broker.task(task_name="stream/normal")
async def stream_funding_normal_level(stream: Stream):
    while Status.from_time_left(stream.time_left) is Status.NORMAL:
        # Wait until we're in warning range
        await asyncio.sleep((stream.time_left - settings.WARNING_LEVEL).total_seconds())

    # Check if stream has been cancelled
    if Status.from_time_left(stream.time_left) is Status.WARNING:
        # TODO: Trigger funding warning notification
        print(f"Warning: only {stream.time_left} left")

    elif Status.from_time_left(stream.time_left) is Status.CRITICAL:
        # TODO: Trigger funding critical notification
        print(f"Critical: only {stream.time_left} left")

    return await create_task_by_status(stream)


@app.broker.task(task_name="stream/warning")
async def stream_funding_warning_level(stream: Stream):
    while Status.from_time_left(stream.time_left) is Status.WARNING:
        # Wait for critical
        await asyncio.sleep((stream.time_left - settings.CRITICAL_LEVEL).total_seconds())

    # Check if stream has been cancelled
    if Status.from_time_left(stream.time_left) is Status.CRITICAL:
        # TODO: Trigger funding critical notification
        print(f"Critical: only {stream.time_left} left")

    return await create_task_by_status(stream)


@app.broker.task(task_name="stream/critical")
async def stream_funding_critical_level(stream: Stream):
    while Status.from_time_left(stream.time_left) is Status.CRITICAL:
        # Wait until there's no time left
        await asyncio.sleep(stream.time_left.total_seconds())

    return await create_task_by_status(stream)


@app.on_(SM.contract.StreamCancelled)
async def stream_cancelled(event):
    stream = Stream(
        manager=SM,
        creator=event.creator,
        stream_id=event.stream_id,
    )
    if app.signer and stream.amount_unlocked > 0:
        stream.claim(sender=app.signer)

    return {"claimed": stream.amount_unlocked}
