from aiogram import BaseMiddleware
from aiogram.types import Message, CallbackQuery, InlineQuery
from typing import Callable, Dict, Any, Awaitable, Union
from config import TELEGRAM_ADMIN_ID

class AdminOnlyMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[Union[Message, CallbackQuery, InlineQuery], Dict[str, Any]], Awaitable[Any]],
        event: Union[Message, CallbackQuery, InlineQuery],
        data: Dict[str, Any]
    ) -> Any:
        user = event.from_user
        if user and user.id in TELEGRAM_ADMIN_ID:
            return await handler(event, data)
        return None