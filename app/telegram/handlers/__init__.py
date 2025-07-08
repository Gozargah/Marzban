from aiogram import Dispatcher

from app.telegram.utils.filters import IsAdminFilter
from . import admin, base, error_handler


def include_routers(dp: Dispatcher) -> None:
    dp.message.filter(IsAdminFilter())
    dp.callback_query.filter(IsAdminFilter())
    dp.inline_query.filter(IsAdminFilter())
    # if a client side handler added in the future, move these filters into admin handler

    dp.include_router(base.router)
    dp.include_router(admin.router)  # keep this last one and before error_handler
    dp.include_router(error_handler.router)
