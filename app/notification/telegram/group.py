from app.notification.client import send_telegram_message
from app.models.group import GroupResponse
from app.models.settings import NotificationSettings
from app.settings import notification_settings


async def create_group(group: GroupResponse, by: str):
    data = (
        "*#Create_Group*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Name:** `{group.name}`\n"
        + f"**Inbound Tags:** `{group.inbound_tags}`\n"
        + f"**Is Disabled:** `{group.is_disabled}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_ID_: `{group.id}`\n"
        + f"_By: #{by}_"
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def modify_group(group: GroupResponse, by: str):
    data = (
        "*#Modify_Group*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Name:** `{group.name}`\n"
        + f"**Inbound Tags:** `{group.inbound_tags}`\n"
        + f"**Is Disabled:** `{group.is_disabled}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_ID_: `{group.id}`\n"
        + f"_By: #{by}_"
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def remove_group(group_id: int, by: str):
    data = (
        "*#Remove_Group*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**ID:** `{group_id}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_By: #{by}_"
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
