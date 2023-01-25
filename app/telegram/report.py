from app import logger
from app.telegram import bot
from telebot.apihelper import ApiTelegramException
from config import TELEGRAM_ADMIN_ID
from telebot.formatting import escape_markdown


def report(message: str, parse_mode="MarkdownV2"):
    if bot and TELEGRAM_ADMIN_ID:
        try:
            bot.send_message(TELEGRAM_ADMIN_ID, message, parse_mode=parse_mode)
        except ApiTelegramException as e:
            logger.error(e)


def report_new_user(username: str, by: str):
    return report(f"New user *{escape_markdown(username)}* added by *{escape_markdown(by)}*")


def report_user_modification(username: str, by: str):
    return report(f"User *{escape_markdown(username)}* modified by *{escape_markdown(by)}*")


def report_user_deletion(username: str, by: str):
    return report(f"User *{escape_markdown(username)}* deleted by *{escape_markdown(by)}*")


def report_status_change(username: str, status: str):
    return report(f"User *{escape_markdown(username)}*'s status has changed to _{status}_")
