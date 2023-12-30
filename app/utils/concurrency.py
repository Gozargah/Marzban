from threading import Thread

import anyio
from fastapi import BackgroundTasks


def threaded_function(func):
    def wrapper(*args, **kwargs):
        thread = Thread(target=func, args=args, daemon=True, kwargs=kwargs)
        thread.start()
    return wrapper


class GetBG:
    """
    context manager for fastapi.BackgroundTasks
    """

    def __init__(self):
        self.bg = BackgroundTasks()

    def __enter__(self):
        return self.bg

    def __exit__(self, exc_type, exc_value, traceback):
        Thread(target=anyio.run, args=(self.bg,), daemon=True).start()

    async def __aenter__(self):
        return self.bg

    async def __aexit__(self, exc_type, exc_value, traceback):
        await self.bg()
