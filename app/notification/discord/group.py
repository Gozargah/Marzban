from app.notification.client import send_discord_webhook
from app.models.group import GroupResponse
from app.models.settings import NotficationSettings
from app.settings import notfication_settings
from . import colors


async def create_group(group: GroupResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Create Group",
                "description": f"**Name:** {group.name}\n"
                + f"**Inbound Tags:** {group.inbound_tags}\n"
                + f"**Is Disabled:** {group.is_disabled}\n",
                "color": colors.GREEN,
                "footer": {"text": f"ID: {group.id}\nBy: {by}"},
            }
        ],
    }
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def modify_group(group: GroupResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Modify Group",
                "description": f"**Name:** {group.name}\n"
                + f"**Inbound Tags:** {group.inbound_tags}\n"
                + f"**Is Disabled:** {group.is_disabled}\n",
                "color": colors.YELLOW,
                "footer": {"text": f"ID: {group.id}\nBy: {by}"},
            }
        ],
    }
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def remove_group(group_id: int, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Remove Group",
                "description": f"**ID:** {group_id}",
                "color": colors.RED,
                "footer": {"text": f"By: {by}"},
            }
        ],
    }
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
