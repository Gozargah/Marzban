from aiogram import Dispatcher
from aiogram.utils.chat_action import ChatActionMiddleware

from .acl import ACLMiddleware


def setup_middlewares(dp: Dispatcher) -> None:
    dp.update.outer_middleware(ACLMiddleware())
    dp.message.middleware.register(ChatActionMiddleware())
