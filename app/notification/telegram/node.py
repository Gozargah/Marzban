from app.notification.client import send_telegram_message
from app.models.node import NodeResponse
from app.models.settings import NotficationSettings
from app.settings import notfication_settings


async def create_node(node: NodeResponse, by: str):
    data = (
        "*#Create_Node*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**ID:** `{node.id}`\n"
        + f"**Name:** `{node.name}`\n"
        + f"**Address:** `{node.address}`\n"
        + f"**Port:** `{node.port}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_By: #{by}_"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def modify_node(node: NodeResponse, by: str):
    data = (
        "*#Modify_Node*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**ID:** `{node.id}`\n"
        + f"**Name:** `{node.name}`\n"
        + f"**Address:** `{node.address}`\n"
        + f"**Port:** `{node.port}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_By: #{by}_"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def remove_node(node: NodeResponse, by: str):
    data = (
        "*#Remove_Node*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**ID:** `{node.id}`\n"
        + f"**Name:** `{node.name}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_By: #{by}_"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def connect_node(node: NodeResponse):
    data = (
        "*#Connect_Node*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Name:** `{node.name}`\n"
        + f"**Node Version:** {node.node_version}\n"
        + f"**Core Version:** {node.xray_version}\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_ID_: `{node.id}`"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def error_node(node: NodeResponse):
    data = (
        "*#Error_Node*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Name:** `{node.name}`\n"
        + f"**Error:** {node.message}\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_ID_: `{node.id}`"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
