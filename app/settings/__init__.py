from aiocache import cached

from app.db import GetDB
from app.db.crud.settings import get_settings
from app.models import settings


@cached()
async def telegram_settings() -> settings.Telegram:
    async with GetDB() as db:
        db_settings = await get_settings(db)

    validated_settings = settings.Telegram.model_validate(db_settings.telegram)
    return validated_settings


@cached()
async def discord_settings() -> settings.Discord:
    async with GetDB() as db:
        db_settings = await get_settings(db)

    validated_settings = settings.Discord.model_validate(db_settings.discord)
    return validated_settings


@cached()
async def webhook_settings() -> settings.Webhook:
    async with GetDB() as db:
        db_settings = await get_settings(db)

    validated_settings = settings.Webhook.model_validate(db_settings.webhook)
    return validated_settings


@cached()
async def notification_settings() -> settings.NotificationSettings:
    async with GetDB() as db:
        db_settings = await get_settings(db)

    validated_settings = settings.NotificationSettings.model_validate(db_settings.notification_settings)
    return validated_settings


@cached()
async def notification_enable() -> settings.NotificationEnable:
    async with GetDB() as db:
        db_settings = await get_settings(db)

    validated_settings = settings.NotificationEnable.model_validate(db_settings.notification_enable)
    return validated_settings


@cached()
async def subscription_settings() -> settings.Subscription:
    async with GetDB() as db:
        db_settings = await get_settings(db)

    validated_settings = settings.Subscription.model_validate(db_settings.subscription)
    return validated_settings


async def refresh_caches():
    await telegram_settings.cache.clear()
    await discord_settings.cache.clear()
    await webhook_settings.cache.clear()
    await notification_settings.cache.clear()
    await notification_enable.cache.clear()
    await subscription_settings.cache.clear()
