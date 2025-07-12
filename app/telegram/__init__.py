from asyncio import Lock

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramNetworkError, TelegramRetryAfter, TelegramBadRequest
from python_socks._errors import ProxyConnectionError

from app import on_shutdown, on_startup
from app.models.settings import Telegram
from app.settings import telegram_settings
from app.utils.logger import get_logger

from .handlers import include_routers
from .middlewares import setup_middlewares

logger = get_logger("telegram-bot")


_bot = None
_dp = None
_lock = Lock()


def get_bot():
    return _bot


def get_dispatcher():
    return _dp


async def startup_telegram_bot():
    logger.info("Telegram bot starting")
    global _bot
    global _dp

    if _bot:
        await shutdown_telegram_bot()

    async with _lock:
        settings: Telegram = await telegram_settings()
        if settings.enable:
            session = AiohttpSession(proxy=settings.proxy_url)
            _bot = Bot(
                token=settings.token,
                session=session,
                default=DefaultBotProperties(parse_mode=ParseMode.HTML)
            )
            _dp = Dispatcher()

            try:
                # register handlers
                include_routers(_dp)
                # register middlewares
                setup_middlewares(_dp)
            except RuntimeError:
                pass

            # register webhook
            webhook_address = f"{settings.webhook_url}/api/tghook"
            logger.info(webhook_address)
            try:
                await _bot.set_webhook(
                    webhook_address,
                    secret_token=settings.webhook_secret,
                    allowed_updates=["message", "callback_query", "inline_query"],
                )
                logger.info("telegram bot started successfully.")
            except (TelegramNetworkError, ProxyConnectionError, TelegramBadRequest) as err:
                if hasattr(err, "message"):
                    logger.error(err.message)
                else:
                    logger.error(err)


async def shutdown_telegram_bot():
    global _bot
    global _dp

    async with _lock:
        if isinstance(_bot, Bot):
            try:
                await _bot.delete_webhook(drop_pending_updates=True)
            except (TelegramNetworkError, TelegramRetryAfter, ProxyConnectionError) as err:
                if hasattr(err, "message"):
                    logger.error(err.message)
                else:
                    logger.error(err)

            await _dp.storage.close()

            if _bot.session:
                await _bot.session.close()

            try:
                await _bot.close()
            except (TelegramNetworkError, TelegramRetryAfter, ProxyConnectionError) as err:
                if hasattr(err, "message"):
                    logger.error(err.message)
                else:
                    logger.error(err)

            _bot = None
            _dp = None


on_startup(startup_telegram_bot)
on_shutdown(shutdown_telegram_bot)
