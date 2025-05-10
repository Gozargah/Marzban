from app.notification.client import send_discord_webhook
from app.models.node import NodeResponse
from app.models.settings import NotficationSettings
from app.settings import notfication_settings
from . import colors


async def create_node(node: NodeResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Create Node",
                "description": f"**Name:** {node.name}\n" + f"**Address:** {node.address}\n" + f"**Port:** {node.port}",
                "color": colors.GREEN,
                "footer": {"text": f"ID: {node.id}\nBy: {by}"},
            }
        ],
    }
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def modify_node(node: NodeResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Modify Node",
                "description": f"**Name:** {node.name}\n" + f"**Address:** {node.address}\n" + f"**Port:** {node.port}",
                "color": colors.YELLOW,
                "footer": {"text": f"ID: {node.id}\nBy: {by}"},
            }
        ],
    }
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def remove_node(node: NodeResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Remove Node",
                "description": f"**Name:** {node.name}\n" + f"**Address:** {node.address}\n" + f"**Port:** {node.port}",
                "color": colors.RED,
                "footer": {"text": f"ID: {node.id}\nBy: {by}"},
            }
        ],
    }
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def connect_node(node: NodeResponse):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Connect Node",
                "description": f"**Name:** {node.name}\n"
                + f"**Node Version:** {node.node_version}\n"
                + f"**Core Version:** {node.xray_version}",
                "color": colors.GREEN,
                "footer": {"text": f"ID: {node.id}"},
            }
        ],
    }
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def error_node(node: NodeResponse):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Error Node",
                "description": f"**Name:** {node.name}\n" + f"**Error:** {node.message}",
                "color": colors.RED,
                "footer": {"text": f"ID: {node.id}"},
            }
        ],
    }
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
