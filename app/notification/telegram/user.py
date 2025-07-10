from app.notification.client import send_telegram_message
from app.models.user import UserNotificationResponse
from app.utils.system import readable_size
from app.models.settings import NotificationSettings
from app.settings import notification_settings

from .utils import escape_html_user
from . import messages

_status = {
    "active": "<b>✅ #Activated</b>",
    "on_hold": "<b>🕔 #On_Hold</b>",
    "disabled": "<b>❌ #Disabled</b>",
    "limited": "<b>🪫 #Limited</b>",
    "expired": "<b>📅 #Expired</b>",
}


async def user_status_change(user: UserNotificationResponse, by: str):
    username, admin_username, by = escape_html_user(user, by)
    data = messages.USER_STATUS_CHANGE.format(
        status=_status[user.status.value],
        username=username,
        admin_username=admin_username,
        by=by,
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def create_user(user: UserNotificationResponse, by: str):
    username, admin_username, by = escape_html_user(user, by)
    data = messages.CREATE_USER.format(
        username=username,
        data_limit=readable_size(user.data_limit) if user.data_limit else "Unlimited",
        expire_date=user.expire if user.expire else "Never",
        data_limit_reset_strategy=user.data_limit_reset_strategy.value,
        has_next_plan=bool(user.next_plan),
        admin_username=admin_username,
        by=by,
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def modify_user(user: UserNotificationResponse, by: str):
    username, admin_username, by = escape_html_user(user, by)
    data = messages.MODIFY_USER.format(
        username=username,
        data_limit=readable_size(user.data_limit) if user.data_limit else "Unlimited",
        expire_date=user.expire if user.expire else "Never",
        data_limit_reset_strategy=user.data_limit_reset_strategy.value,
        has_next_plan=bool(user.next_plan),
        admin_username=admin_username,
        by=by,
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def remove_user(user: UserNotificationResponse, by: str):
    username, admin_username, by = escape_html_user(user, by)
    data = messages.REMOVE_USER.format(
        username=username,
        admin_username=admin_username,
        by=by,
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def reset_user_data_usage(user: UserNotificationResponse, by: str):
    username, admin_username, by = escape_html_user(user, by)
    data = messages.RESET_USER_DATA_USAGE.format(
        username=username,
        data_limit=readable_size(user.data_limit) if user.data_limit else "Unlimited",
        admin_username=admin_username,
        by=by,
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def user_data_reset_by_next(user: UserNotificationResponse, by: str):
    username, admin_username, by = escape_html_user(user, by)
    data = messages.USER_DATA_RESET_BY_NEXT.format(
        username=username,
        data_limit=readable_size(user.data_limit) if user.data_limit else "Unlimited",
        expire_date=user.expire if user.expire else "Never",
        admin_username=admin_username,
        by=by,
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def user_subscription_revoked(user: UserNotificationResponse, by: str):
    username, admin_username, by = escape_html_user(user, by)
    data = messages.USER_SUBSCRIPTION_REVOKED.format(
        username=username,
        admin_username=admin_username,
        by=by,
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)
