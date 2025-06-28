from typing import Any, Awaitable, Callable, Dict

from aiogram import BaseMiddleware
from aiogram.types import Update

from app.db import GetDB
from app.db.crud.admin import get_admin_by_telegram_id
from app.models.admin import AdminDetails


class ACLMiddleware(BaseMiddleware):
    async def __call__(
        self, handler: Callable[[Update, Dict[str, Any]], Awaitable[Any]], event: Update, data: Dict[str, Any]
    ) -> Any:
        message_obj = event.message or event.callback_query or event.inline_query
        user_id = message_obj.from_user.id
        async with GetDB() as db:
            admin = await get_admin_by_telegram_id(db, user_id)
            if admin:
                if admin.is_disabled:
                    await message_obj.reply("your account hase been disabled.")
                    data["admin"] = None
                else:
                    admin = AdminDetails.model_validate(admin)
                    data["admin"] = admin
            else:
                data["admin"] = None

            data["db"] = db
            return await handler(event, data)
