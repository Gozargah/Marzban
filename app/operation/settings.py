import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Settings
from app.db.crud import get_settings, modify_settings
from app.models.settings import SettingsSchema
from app.settings import refresh_caches
from app.notification.client import define_client
from app.notification.webhook import queue as webhook_queue
from . import BaseOperation


class SettingsOperation(BaseOperation):
    @staticmethod
    async def reset_services(old_settings: SettingsSchema, new_settings: SettingsSchema):
        if new_settings.telegram != old_settings.telegram:
            pass
        if new_settings.discord != old_settings.discord:
            pass
        if old_settings.webhook and new_settings.webhook is None or not new_settings.webhook.enable:
            webhook_queue.empty()
        if old_settings.notfication_settings.proxy_url != new_settings.notfication_settings.proxy_url:
            await define_client()

    async def get_settings(self, db: AsyncSession) -> Settings:
        return await get_settings(db)

    async def modify_settings(self, db: AsyncSession, modify: SettingsSchema) -> SettingsSchema:
        db_settings = await get_settings(db)

        old_settings_dict = {
            "telegram": db_settings.telegram,
            "discord": db_settings.discord,
            "webhook": db_settings.webhook,
            "notfication_settings": db_settings.notfication_settings,
            "notfication_enable": db_settings.notfication_enable,
            "subscription": db_settings.subscription,
        }
        old_settings = SettingsSchema.model_validate(old_settings_dict)

        db_settings = await modify_settings(db, db_settings, modify)
        new_settings = SettingsSchema.model_validate(db_settings)
        await refresh_caches()

        asyncio.create_task(self.reset_services(old_settings, new_settings))

        return new_settings
