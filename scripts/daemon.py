import asyncio
import itertools

from apepay import Stream, StreamManager, Status, WARNING_LEVEL, CRITICAL_LEVEL
from silverback import SilverBackApp

# TODO: Load `address` from `os.environ`
SM = StreamManager(address="0x274b028b03A250cA03644E6c578D81f019eE1323")

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
            for stream in itertools.chain(SM.active_streams(), SM.unclaimed_streams())
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
    while stream.status is Status.NORMAL:
        # Wait until we're in warning range
        await asyncio.sleep((stream.time_left - WARNING_LEVEL).total_seconds())

    # Check if stream has been cancelled
    if stream.status is Status.WARNING:
        # TODO: Trigger funding warning notification
        print(f"Warning: only {stream.time_left} left")

    elif stream.status is Status.CRITICAL:
        # TODO: Trigger funding critical notification
        print(f"Critical: only {stream.time_left} left")

    return await create_task_by_status(stream)


@app.broker.task(task_name="stream/warning")
async def stream_funding_warning_level(stream: Stream):
    while stream.status is Status.WARNING:
        # Wait for critical
        await asyncio.sleep((stream.time_left - CRITICAL_LEVEL).total_seconds())

    # Check if stream has been cancelled
    if stream.status is Status.CRITICAL:
        # TODO: Trigger funding critical notification
        print(f"Critical: only {stream.time_left} left")

    return await create_task_by_status(stream)


@app.broker.task(task_name="stream/critical")
async def stream_funding_critical_level(stream: Stream):
    while stream.status is Status.CRITICAL:
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
        stream.withdraw(sender=app.signer)

    return {"claimed": stream.amount_unlocked}
