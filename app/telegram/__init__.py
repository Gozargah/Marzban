from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums.parse_mode import ParseMode
from aiogram.utils.token import TokenValidationError
from aiogram.exceptions import TelegramAPIError

from config import TELEGRAM_API_TOKEN
from app import app, logger

class TelegramBot:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.bot = None
            cls._instance.dp = None
        return cls._instance

    async def initialize(self):
        if not TELEGRAM_API_TOKEN:
            return False

        try:
            self.bot = Bot(
                token=TELEGRAM_API_TOKEN,
                default=DefaultBotProperties(
                    parse_mode=ParseMode.HTML,
                    link_preview_is_disabled=True
                )
            )
            self.dp = Dispatcher()
            logger.info("Telegram bot initialized successfully")
            return True
        except TokenValidationError:
            logger.error("Invalid Telegram bot token")
        except Exception as e:
            logger.error(f"Error initializing Telegram bot: {e}")
        return False

    async def start(self):
        if not self.bot or not self.dp:
            logger.error("Telegram bot not initialized")
            return

        try:
            logger.info("Starting Telegram bot")
            await self.bot.delete_webhook(drop_pending_updates=True)
            await self.dp.start_polling(self.bot)
        except TelegramAPIError as e:
            logger.error(f"Telegram API error while starting bot: {e}")
        except Exception as e:
            logger.error(f"Unexpected error while starting Telegram bot: {e}")

    async def stop(self):
        if self.dp:
            logger.info("Stopping Telegram bot")
            await self.dp.stop_polling()
        if self.bot:
            await self.bot.session.close()
        self.bot = None
        self.dp = None
        logger.info("Telegram bot stopped")

tgbot = TelegramBot()

@app.on_event("startup")
async def start_bot():
    if await tgbot.initialize():
        await tgbot.start()

@app.on_event("shutdown")
async def stop_bot():
    await tgbot.stop()