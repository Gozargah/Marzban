import datetime
from datetime import datetime

from telebot.apihelper import ApiTelegramException
from telebot.formatting import escape_html

from app import logger, settings
from app.telegram import bot
from app.telegram.utils.keyboard import BotKeyboard
from app.utils.system import readable_size


def report(message: str, parse_mode="html", keyboard=None):
    if bot.is_running:
        if settings.get("telegram_logs_channel_id"):
            try:
                bot.send_message(settings["telegram_logs_channel_id"], message, parse_mode=parse_mode)
            except ApiTelegramException as e:
                logger.error(e)
        elif settings.get("telegram_admins"):
            for admin in settings['telegram_admins']:
                try:
                    bot.send_message(admin, message, parse_mode=parse_mode, reply_markup=keyboard)
                except ApiTelegramException as e:
                    logger.error(e)


def report_new_user(user_id: int, username: str, by: str, expire_date: int, data_limit: int, proxies: list):
    text = '''\
🆕 <b>#Created</b>
➖➖➖➖➖➖➖➖➖
<b>Username :</b> <code>{username}</code>
<b>Traffic Limit :</b> <code>{data_limit}</code>
<b>Expire Date :</b> <code>{expire_date}</code>
<b>Proxies :</b> <code>{proxies}</code>
➖➖➖➖➖➖➖➖➖
<b>By :</b> <b>#{by}</b>'''.format(
        by=escape_html(by),
        username=escape_html(username),
        data_limit=readable_size(data_limit) if data_limit else "Unlimited",
        expire_date=datetime.fromtimestamp(expire_date).strftime("%H:%M:%S %Y-%m-%d") if expire_date else "Never",
        proxies="" if not proxies else ", ".join([escape_html(proxy) for proxy in proxies])
    )

    return report(
        text,
        keyboard=BotKeyboard.user_menu({
            'username': username,
            'id': user_id,
            'status': 'active'
        }, with_back=False)
    )


def report_user_modification(username: str, expire_date: int, data_limit: int, proxies: list, by: str):
    text = '''\
✏️ <b>#Modified</b>
➖➖➖➖➖➖➖➖➖
<b>Username :</b> <code>{username}</code>
<b>Traffic Limit :</b> <code>{data_limit}</code>
<b>Expire Date :</b> <code>{expire_date}</code>
<b>Protocols :</b> <code>{protocols}</code>
➖➖➖➖➖➖➖➖➖
<b>By :</b> <b>#{by}</b>\
    '''.format(
        by=escape_html(by),
        username=escape_html(username),
        data_limit=readable_size(data_limit) if data_limit else "Unlimited",
        expire_date=datetime.fromtimestamp(expire_date).strftime("%H:%M:%S %Y-%m-%d") if expire_date else "Never",
        protocols=', '.join([p for p in proxies])
    )

    return report(text, keyboard=BotKeyboard.user_menu({
        'username': username,
        'status': 'active'
    }, with_back=False))


def report_user_deletion(username: str, by: str):
    text = '''\
🗑 <b>#Deleted</b>
➖➖➖➖➖➖➖➖➖
<b>Username</b> : <code>{username}</code>
➖➖➖➖➖➖➖➖➖
<b>By</b> : <b>#{by}</b>\
    '''.format(
        by=escape_html(by),
        username=escape_html(username)
    )
    return report(text)


def report_status_change(username: str, status: str):
    _status = {
        'active': '✅ <b>#Activated</b>',
        'disabled': '❌ <b>#Disabled</b>',
        'limited': '🪫 <b>#Limited</b>',
        'expired': '🕔 <b>#Expired</b>'
    }
    text = '''\
{status}
➖➖➖➖➖➖➖➖➖
<b>Username</b> : <code>{username}</code>\
    '''.format(
        username=escape_html(username),
        status=_status[status]
    )
    return report(text)


def report_user_usage_reset(username: str, by: str):
    text = """  
🔁 <b>#Reset</b>
➖➖➖➖➖➖➖➖➖
<b>Username</b> : <code>{username}</code>
➖➖➖➖➖➖➖➖➖
<b>By</b> : <b>#{by}</b>\
    """.format(
        by=escape_html(by),
        username=escape_html(username)
    )

    return report(text)


def report_user_subscription_revoked(username: str, by: str):
    text = """  
🔁 <b>#Revoked</b>
➖➖➖➖➖➖➖➖➖
<b>Username</b> : <code>{username}</code>
➖➖➖➖➖➖➖➖➖
<b>By</b> : <b>#{by}</b>\
    """.format(
        by=escape_html(by),
        username=escape_html(username)
    )

    return report(text)
