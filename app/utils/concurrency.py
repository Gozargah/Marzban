import logging
from concurrent.futures import Future, ThreadPoolExecutor

import anyio
from fastapi import BackgroundTasks

from config import XRAY_THREAD_POOL_SIZE

logger = logging.getLogger("uvicorn.error")

# Global bounded thread pool for all xray operations (gRPC calls to master/nodes,
# node (re)connects, user add/remove/update). The upstream version spawned a new
# daemon Thread per call — under many users x nodes that meant hundreds of live
# threads (GIL contention, RAM growth, panel freezes). All work now funnels
# through this pool. Pair with node-side timeouts so a hung node can't pin a
# worker forever.
_xray_executor = ThreadPoolExecutor(
    max_workers=XRAY_THREAD_POOL_SIZE, thread_name_prefix="xray-pool"
)


def get_xray_executor() -> ThreadPoolExecutor:
    return _xray_executor


def shutdown_xray_executor(wait: bool = True):
    logger.info("[concurrency] shutting down xray thread pool (wait=%s)", wait)
    _xray_executor.shutdown(wait=wait)


def threaded_function(func):
    """Submit work to the global xray thread pool instead of spawning a Thread
    per call. Returns the Future (current callers ignore it, fire-and-forget)."""
    def wrapper(*args, **kwargs) -> Future:
        return _xray_executor.submit(func, *args, **kwargs)
    wrapper.__wrapped__ = func
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
        _xray_executor.submit(anyio.run, self.bg)

    async def __aenter__(self):
        return self.bg

    async def __aexit__(self, exc_type, exc_value, traceback):
        await self.bg()
