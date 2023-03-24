import datetime

from app import logger
from app.telegram import bot
from telebot.apihelper import ApiTelegramException
from datetime import datetime
from app.telegram.utils.keyboard import BotKeyboard
from app.utils.system import readable_size
from config import TELEGRAM_ADMIN_ID
from telebot.formatting import escape_html


def report(message: str, parse_mode="html", keyboard=None):
    if bot and TELEGRAM_ADMIN_ID:
        try:
            bot.send_message(TELEGRAM_ADMIN_ID, message, parse_mode=parse_mode, reply_markup=keyboard)
        except ApiTelegramException as e:
            logger.error(e)


def report_new_user(user_id: int, username: str, by: str, expire_date: int, usage: str, proxies: list):
    text = """
⨁ New User Added by <b>{by}</b>
➖➖➖➖➖➖➖
┌ Username: <b>{username}</b>
├ Usage: <b>{usage}</b>
└ Expiry Date <b>{expire_date}</b>
┌ Created Proxies:
{proxies}
    """.format(
        by=escape_html(by),
        username=escape_html(username),
        usage=readable_size(usage) if usage else "Unlimited",
        expire_date=datetime.fromtimestamp(expire_date).strftime("%H:%M:%S %Y-%m-%d") if expire_date else "Never",
        proxies="" if not proxies else "\n".join([
            "├ {}".format(
                escape_html(proxy.type),
            ) for proxy in proxies
        ])
    )

    return report(
        text,
        keyboard=BotKeyboard.user_menu({
            'username': username,
            'id': user_id,
            'status': 'active'
        }, with_back=False)
    )


def report_user_modification(username: str, expire_date: int, usage: str, proxies: list, by: str):
    text = """
⨀ User Modified by <b>{by}</b>
➖➖➖➖➖➖➖
┌ Username: <b>{username}</b>
├ Usage: <b>{usage}</b>
├ Expiry Date <b>{expire_date}</b>
└ Protocols: {protocols}
    """.format(
        by=escape_html(by),
        username=escape_html(username),
        usage=readable_size(usage) if usage else "Unlimited",
        expire_date=datetime.fromtimestamp(expire_date).strftime("%H:%M:%S %Y-%m-%d") if expire_date else "Never",
        protocols=', '.join([p.type for p in proxies])
    )

    return report(text, keyboard=BotKeyboard.user_menu({
        'username': username,
        'status': 'active'
    }, with_back=False))


def report_user_deletion(username: str, by: str):
    text = """
⨂ User Deleted by <b>{by}</b>
➖➖➖➖➖➖➖
┌ Username: <b>{username}</b>
    """.format(
        by=escape_html(by),
        username=escape_html(username)
    )
    return report(text)


def report_status_change(username: str, status: str):
    text = """
⨀ User Status Changed
➖➖➖➖➖➖➖
┌ Username: <b>{username}</b>
└ Status: <b>{status}</b>
    """.format(
        username=escape_html(username),
        status=status.capitalize()
    )
    return report(text)
