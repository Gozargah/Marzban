from app.notification.client import send_discord_webhook
from app.models.host import BaseHost
from app.models.settings import NotificationSettings
from app.settings import notification_settings
from . import colors


async def create_host(host: BaseHost, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Create Host",
                "description": f"**Remark:** {host.remark}\n"
                + f"**Address:** {host.address}\n"
                + f"**Inbound Tag:** {host.inbound_tag}\n"
                + f"**Port:** {host.port}",
                "color": colors.GREEN,
                "footer": {"text": f"ID: {host.id}\nBy: {by}"},
            }
        ],
    }
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def modify_host(host: BaseHost, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Modify Host",
                "description": f"**Remark:** {host.remark}\n"
                + f"**Address:** {host.address}\n"
                + f"**Inbound Tag:** {host.inbound_tag}\n"
                + f"**Port:** {host.port}",
                "color": colors.YELLOW,
                "footer": {"text": f"ID: {host.id}\nBy: {by}"},
            }
        ],
    }
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def remove_host(host: BaseHost, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Remove Host",
                "description": f"**Remark:** {host.remark}",
                "color": colors.RED,
                "footer": {"text": f"ID: {host.id}\nBy: {by}"},
            }
        ],
    }
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def modify_hosts(by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Modify Hosts",
                "description": f"All hosts has been updated by **{by}**",
                "color": colors.CYAN,
            }
        ],
    }
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
