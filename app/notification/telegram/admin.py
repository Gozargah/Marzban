from app.notification.client import send_telegram_message
from app.models.admin import AdminDetails
from app.models.settings import NotificationSettings
from app.settings import notification_settings


async def create_admin(admin: AdminDetails, by: str):
    data = (
        "*#Create_Admin*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** `{admin.username}`\n"
        + f"**Is Sudo:** `{admin.is_sudo}`\n"
        + f"**Is Disabled:** `{admin.is_disabled}`\n"
        + (f"**Telegram ID:** `{admin.telegram_id}` — [mention](tg://user?id={admin.telegram_id})\n" if admin.telegram_id else "")
        + (f"**Discord ID:** `{admin.discord_id}`\n" if admin.discord_id else "")
        + (f"**Discord Webhook:** `{admin.discord_webhook}`\n" if admin.discord_webhook else "")
        + (f"**Sub Domain:** `{admin.sub_domain}`\n" if admin.sub_domain else "")
        + (f"**Sub Template:** `{admin.sub_template}`\n" if admin.sub_template else "")
        + (f"**Profile Title:** `{admin.profile_title}`\n" if admin.profile_title else "")
        + (f"**Support URL:** `{admin.support_url}`\n" if admin.support_url else "")
        + (f"**Total Users:** `{admin.total_users}`\n" if admin.total_users else "")
        + (f"**Used Traffic:** `{admin.used_traffic}`\n" if admin.used_traffic else "")
        + (f"**Lifetime Used Traffic:** `{admin.lifetime_used_traffic}`\n" if admin.lifetime_used_traffic else "")
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_By: #{by}_"
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def modify_admin(admin: AdminDetails, by: str):
    data = (
        "*#Modify_Admin*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** `{admin.username}`\n"
        + f"**Is Sudo:** `{admin.is_sudo}`\n"
        + f"**Is Disabled:** `{admin.is_disabled}`\n"
        + (f"**Telegram ID:** `{admin.telegram_id}` — [mention](tg://user?id={admin.telegram_id})\n" if admin.telegram_id else "")
        + (f"**Discord ID:** `{admin.discord_id}`\n" if admin.discord_id else "")
        + (f"**Discord Webhook:** `{admin.discord_webhook}`\n" if admin.discord_webhook else "")
        + (f"**Sub Domain:** `{admin.sub_domain}`\n" if admin.sub_domain else "")
        + (f"**Sub Template:** `{admin.sub_template}`\n" if admin.sub_template else "")
        + (f"**Profile Title:** `{admin.profile_title}`\n" if admin.profile_title else "")
        + (f"**Support URL:** `{admin.support_url}`\n" if admin.support_url else "")
        + (f"**Total Users:** `{admin.total_users}`\n" if admin.total_users else "")
        + (f"**Used Traffic:** `{admin.used_traffic}`\n" if admin.used_traffic else "")
        + (f"**Lifetime Used Traffic:** `{admin.lifetime_used_traffic}`\n" if admin.lifetime_used_traffic else "")
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_By: #{by}_"
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def remove_admin(username: str, by: str):
    data = "*#Remove_Admin*\n" + f"**Username:** `{username}`\n" + "➖➖➖➖➖➖➖➖➖\n" + f"_By: #{by}_"
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def admin_reset_usage(admin: AdminDetails, by: str):
    data = "*#Admin_Usage_Reset*\n" + f"**Username:** `{admin.username}`\n" + "➖➖➖➖➖➖➖➖➖\n" + f"_By: #{by}_"
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def admin_login(username: str, password: str, client_ip: str, success: bool):
    data = (
        "*#Login_Attempt*\n"
        + "*Status*: "
        + ("Successful\n" if success else "Failed\n")
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** `{username}`\n"
        + f"**Password:** {'🔒' if success else password}\n"
        + f"**IP:** `{client_ip}`\n"
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
