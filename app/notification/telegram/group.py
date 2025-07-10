from html import escape

from app.notification.client import send_telegram_message
from app.models.group import GroupResponse
from app.models.settings import NotificationSettings
from app.settings import notification_settings
from app.utils.helpers import escape_tg_html
from . import messages


async def create_group(group: GroupResponse, by: str):
    name, by = escape_tg_html((group.name, by))
    data = messages.CREATE_GROUP.format(
        name=name, inbound_tags=group.inbound_tags, is_disabled=group.is_disabled, id=group.id, by=by
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def modify_group(group: GroupResponse, by: str):
    name, by = escape_tg_html((group.name, by))
    data = messages.MODIFY_GROUP.format(
        name=name, inbound_tags=group.inbound_tags, is_disabled=group.is_disabled, id=group.id, by=by
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def remove_group(group_id: int, by: str):
    data = messages.REMOVE_GROUP.format(id=group_id, by=escape(by))
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
