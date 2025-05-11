from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramNetworkError

from app import on_shutdown, on_startup
from app.utils.logger import get_logger
from config import TELEGRAM_API_TOKEN, TELEGRAM_PROXY_URL, TELEGRAM_WEBHOOK_SECRET_KEY, TELEGRAM_WEBHOOK_URL

from .handlers import include_routers
from .middlewares import setup_middlewares

logger = get_logger("telegram-bot")


bot = None
dp = None
if TELEGRAM_API_TOKEN:
    session = AiohttpSession(proxy=TELEGRAM_PROXY_URL)
    bot = Bot(token=TELEGRAM_API_TOKEN, session=session, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()


@on_startup
async def initial_telegram_bot():
    if not TELEGRAM_API_TOKEN:
        return

    # register handlers
    include_routers(dp)
    # register middlewares
    setup_middlewares(dp)
    # register webhook
    webhook_address = f"{TELEGRAM_WEBHOOK_URL}/api/tghook"
    logger.info(webhook_address)
    try:
        await bot.set_webhook(
            webhook_address,
            secret_token=TELEGRAM_WEBHOOK_SECRET_KEY,
            allowed_updates=["message", "callback_query", "inline_query"],
        )
        logger.info("telegram bot started successfully.")
    except TelegramNetworkError as err:
        logger.error(err.message)


@on_shutdown
async def bot_down():
    if not TELEGRAM_API_TOKEN:
        return
    try:
        await bot.delete_webhook(drop_pending_updates=True)
    except TelegramNetworkError as err:
        logger.error(err.message)
    await dp.storage.close()
