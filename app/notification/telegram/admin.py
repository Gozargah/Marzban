from app.notification.client import send_telegram_message
from app.models.admin import AdminDetails
from app.models.settings import NotficationSettings
from app.settings import notfication_settings


async def create_admin(admin: AdminDetails, by: str):
    data = (
        "*#Create_Admin*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** `{admin.username}`\n"
        + f"**Is Sudo:** `{admin.is_sudo}`\n"
        + f"**Is Disabled:** `{admin.is_disabled}`\n"
        + f"**Used Traffic:** `{admin.used_traffic}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_By: #{by}_"
    )
    settings: NotficationSettings = await notfication_settings()
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
        + f"**Is Disabled:** {admin.is_disabled}\n"
        + f"**Used Traffic:** {admin.used_traffic}\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_By: #{by}_"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def remove_admin(username: str, by: str):
    data = "*#Remove_Admin*\n" + f"**Username:** `{username}`\n" + "➖➖➖➖➖➖➖➖➖\n" + f"_By: #{by}_"
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def admin_reset_usage(admin: AdminDetails, by: str):
    data = "*#Admin_Usage_Reset*\n" + f"**Username:** `{admin.username}`\n" + "➖➖➖➖➖➖➖➖➖\n" + f"_By: #{by}_"
    settings: NotficationSettings = await notfication_settings()
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
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
