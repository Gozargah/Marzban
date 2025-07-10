import httpx
import asyncio

from app.models.settings import NotificationSettings
from app.settings import notification_settings
from app.utils.logger import get_logger
from app import on_startup


client = None


async def define_client():
    """
    Re-create the global httpx.AsyncClient.
    Call this function after changing the proxy setting.
    """
    global client
    if client and not client.is_closed:
        asyncio.create_task(client.aclose())
    client = httpx.AsyncClient(
        http2=True,
        timeout=httpx.Timeout(10),
        proxy=(await notification_settings()).proxy_url,
    )


on_startup(define_client)

logger = get_logger("Notification")


async def send_discord_webhook(json_data, webhook):
    max_retries = (await notification_settings()).max_retries
    retries = 0
    while retries < max_retries:
        try:
            response = await client.post(webhook, json=json_data)
            if response.status_code in [200, 204]:
                logger.debug(f"Discord webhook payload delivered successfully, code {response.status_code}.")
                return
            elif response.status_code == 429:
                retries += 1
                if retries < max_retries:
                    await asyncio.sleep(0.5)
                    continue
            else:
                response_text = response.text
                logger.error(f"Discord webhook failed: {response.status_code} - {response_text}")
                return
        except Exception as err:
            logger.error(f"Discord webhook failed Exception: {str(err)}")
            return

    logger.error(f"Discord webhook failed after {max_retries} retries")


async def send_telegram_message(
    message, chat_id: int | None = None, channel_id: int | None = None, topic_id: int | None = None
):
    """
    Send a message to Telegram based on the available IDs.
    Args:
        message (str): The message to send
        chat_id (int, optional): The chat ID for direct messages
        channel_id (int, optional): The channel ID for channel messages
        topic_id (int, optional): The topic ID for forum topics in channels
    Returns:
        bool: True if message was sent successfully, False otherwise
    """
    # Ensure TELEGRAM_API_TOKEN is available
    settings: NotificationSettings = await notification_settings()
    if not settings.telegram_api_token:
        logger.error("TELEGRAM_API_TOKEN is not defined")
        return

    base_url = f"https://api.telegram.org/bot{settings.telegram_api_token}/sendMessage"
    payload = {"parse_mode": "HTML", "text": message}

    # Determine the target chat/channel/topic
    if topic_id and channel_id:
        payload["chat_id"] = channel_id
        payload["message_thread_id"] = topic_id
    elif channel_id:
        payload["chat_id"] = channel_id
    elif chat_id:
        payload["chat_id"] = chat_id
    else:
        logger.error("At least one of chat_id, channel_id must be provided")
        return

    max_retries = settings.max_retries
    retries = 0
    while retries < max_retries:
        try:
            response = await client.post(base_url, data=payload)
            if response.status_code == 200:
                logger.debug(f"Telegram message sent successfully, code {response.status_code}.")
                return
            elif response.status_code == 429:
                retries += 1
                if retries < max_retries:
                    await asyncio.sleep(0.5)
                    continue
            else:
                response_text = response.text
                logger.error(f"Telegram message failed: {response.status_code} - {response_text}")
                return
        except Exception as err:
            logger.error(f"Telegram message failed: {str(err)}")
            return

    logger.error(f"Telegram message failed after {max_retries} retries")
