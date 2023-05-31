import asyncio

from ape import project
from apepay import StreamManager, Stream


async def wait_stream_finished(q: asyncio.Queue):
    while True:
        stream: Stream = await q.get()

        while stream.time_left.seconds > 0:
            await asyncio.sleep(stream.time_left.seconds)

        print(f"Finished: {stream}")
        q.task_done()


async def watch_cancelled_streams(sm: StreamManager, q: asyncio.Queue):
    async for stream in sm.poll_cancelled_streams():
        print(f"Cancelled: {stream}")
        await q.put(stream)


async def watch_new_streams(sm: StreamManager, q: asyncio.Queue):
    async for stream in sm.poll_new_streams():
        print(f"New: {stream}")
        await q.put(stream)


async def create_stream_manager_tasks(sm: StreamManager):
    queue = asyncio.Queue()

    # Restore from previous sessions (skip already finished)
    for stream in map(lambda s: s.is_active, sm.all_streams()):
        print(f"Previous: {stream}")
        await queue.put(stream)

    tasks = [
        asyncio.create_task(watch_new_streams(sm, queue)),
        asyncio.create_task(watch_cancelled_streams(sm, queue)),
        asyncio.create_task(wait_stream_finished(queue)),
    ]

    return await asyncio.gather(*tasks)


def main():
    sm = project.StreamManager.at(input("StreamManager contract to watch: "))
    asyncio.run(create_stream_manager_tasks(StreamManager(contract=sm)))
