import asyncio
import threading
from datetime import timedelta
from typing import AsyncIterator, Iterator


def async_wrap_iter(it: Iterator) -> AsyncIterator:
    """Wrap blocking iterator into an asynchronous one"""
    loop = asyncio.get_event_loop()
    q = asyncio.Queue(1)
    exception = None
    _END = object()

    async def yield_queue_items():
        while True:
            next_item = await q.get()
            if next_item is _END:
                break
            yield next_item
        if exception is not None:
            # the iterator has raised, propagate the exception
            raise exception

    def iter_to_queue():
        nonlocal exception
        try:
            for item in it:
                # This runs outside the event loop thread, so we
                # must use thread-safe API to talk to the queue.
                asyncio.run_coroutine_threadsafe(q.put(item), loop).result()
        except Exception as e:
            exception = e
        finally:
            asyncio.run_coroutine_threadsafe(q.put(_END), loop).result()

    threading.Thread(target=iter_to_queue).start()
    return yield_queue_items()


def coerce_time_unit(time: str) -> str:
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


def time_unit_to_timedelta(time_unit: str) -> timedelta:
    return timedelta(**{coerce_time_unit(time_unit): 1})
