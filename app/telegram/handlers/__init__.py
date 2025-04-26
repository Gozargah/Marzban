from aiogram import Dispatcher

from . import admin, base, error_handler

handlers = (
    base,
    admin,  # keep this last one and before error_handler
    error_handler,
)


def include_routers(dp: Dispatcher) -> None:
    for handler in handlers:
        if hasattr(handler, "init_handler"):
            handler.init_handler()
        if hasattr(handler, "router"):
            dp.include_router(handler.router)
