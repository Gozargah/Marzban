from typing import Any, Awaitable, Callable, Dict

from aiogram import BaseMiddleware
from aiogram.types import Update

from app.db import GetDB
from app.db.crud.admin import get_admin_by_telegram_id
from app.models.admin import AdminDetails
from app.settings import telegram_settings
from app.models.settings import Telegram


class ACLMiddleware(BaseMiddleware):
    async def __call__(
        self, handler: Callable[[Update, Dict[str, Any]], Awaitable[Any]], event: Update, data: Dict[str, Any]
    ) -> Any:
        message_obj = event.message or event.callback_query or event.inline_query
        user_id = message_obj.from_user.id
        async with GetDB() as db:
            settings: Telegram = await telegram_settings()
            admin = await get_admin_by_telegram_id(db, user_id)
            if admin:
                if admin.is_disabled:
                    if settings.for_admins_only:
                        return
                    data["admin"] = None
                else:
                    admin = AdminDetails.model_validate(admin)
                    data["admin"] = admin
            else:
                if settings.for_admins_only:
                    return
                data["admin"] = None

            data["db"] = db
            return await handler(event, data)
