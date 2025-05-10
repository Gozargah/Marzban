from app.notification.client import send_discord_webhook
from app.models.admin import AdminDetails
from app.models.settings import NotficationSettings
from app.settings import notfication_settings
from . import colors


async def create_admin(admin: AdminDetails, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Create Admin",
                "description": f"**Username:** {admin.username}\n"
                + f"**Is Sudo:** {admin.is_sudo}\n"
                + f"**Is Disabled:** {admin.is_disabled}\n"
                + f"**Used Traffic:** {admin.used_traffic}\n",
                "color": colors.GREEN,
                "footer": {"text": f"By: {by}"},
            }
        ],
    }
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def modify_admin(admin: AdminDetails, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Modify Admin",
                "description": f"**Username:** {admin.username}\n"
                + f"**Is Sudo:** {admin.is_sudo}\n"
                + f"**Is Disabled:** {admin.is_disabled}\n"
                + f"**Used Traffic:** {admin.used_traffic}\n",
                "color": colors.YELLOW,
                "footer": {"text": f"By: {by}"},
            }
        ],
    }
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def remove_admin(username: str, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Remove Admin",
                "description": f"**Username:** {username}\n",
                "color": colors.RED,
                "footer": {"text": f"By: {by}"},
            }
        ],
    }
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def admin_reset_usage(admin: AdminDetails, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Admin Reset Usage",
                "description": f"**Username:** {admin.username}\n",
                "color": colors.CYAN,
                "footer": {"text": f"By: {by}"},
            }
        ],
    }
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def admin_login(username: str, password: str, client_ip: str, success: bool):
    data = {
        "embeds": [
            {
                "title": "Login Attempt",
                "description": f"**Username:** {username}\n"
                f"**Password:** {'🔒' if success else password}\n"
                f"**IP:** {client_ip}",
                "color": colors.GREEN if success else colors.RED,
                "footer": {"text": "Successful" if success else "Failed"},
            }
        ]
    }
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
