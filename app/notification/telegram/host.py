from html import escape

from app.notification.client import send_telegram_message
from app.models.host import BaseHost
from app.models.settings import NotificationSettings
from app.settings import notification_settings
from app.utils.helpers import escape_tg_html

from .utils import escape_html_host
from . import messages


async def create_host(host: BaseHost, by: str):
    remark, address, tag, by = escape_html_host(host, by)
    data = messages.CREATE_HOST.format(remark=remark, address=address, tag=tag, port=host.port, id=host.id, by=by)
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def modify_host(host: BaseHost, by: str):
    remark, address, tag, by = escape_html_host(host, by)
    data = messages.MODIFY_HOST.format(remark=remark, address=address, tag=tag, port=host.port, id=host.id, by=by)
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def remove_host(host: BaseHost, by: str):
    remark, by = escape_tg_html((host.remark, by))
    data = messages.REMOVE_HOST.format(remark=remark, id=host.id, by=by)
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def modify_hosts(by: str):
    data = messages.MODIFY_HOSTS.format(by=escape(by))
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
