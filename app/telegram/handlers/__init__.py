from aiogram import Dispatcher

from . import admin, base, error_handler, client


def include_routers(dp: Dispatcher) -> None:
    dp.include_router(base.router)
    dp.include_router(admin.router)   # keep these last one
    dp.include_router(client.router)  # and before error_handler

    dp.include_router(error_handler.router)
