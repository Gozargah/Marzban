from app.notification.client import send_telegram_message
from app.models.user_template import UserTemplateResponse
from app.models.settings import NotificationSettings
from app.settings import notification_settings
from app.utils.helpers import escape_tg_html

from .utils import escape_html_template
from . import messages


async def create_user_template(user_template: UserTemplateResponse, by: str):
    name, prefix, suffix, by = escape_html_template(user_template, by)
    data = messages.CREATE_USER_TEMPLATE.format(
        name=name,
        data_limit=user_template.data_limit,
        expire_duration=user_template.expire_duration,
        username_prefix=prefix,
        username_suffix=suffix,
        by=by,
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def modify_user_template(user_template: UserTemplateResponse, by: str):
    name, prefix, suffix, by = escape_html_template(user_template, by)
    data = messages.MODIFY_USER_TEMPLATE.format(
        name=name,
        data_limit=user_template.data_limit,
        expire_duration=user_template.expire_duration,
        username_prefix=prefix,
        username_suffix=suffix,
        by=by,
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def remove_user_template(name: str, by: str):
    name, by = escape_tg_html((name, by))
    data = messages.REMOVE_USER_TEMPLATE.format(name=name, by=by)
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
