from datetime import datetime
from app.db import GetDB, crud
from app.models.user import UserResponse
from app.telegram import bot
from pytz import UTC
from telebot.custom_filters import ChatFilter
from telebot.util import extract_arguments

from app.utils.system import readable_size

bot.add_custom_filter(ChatFilter())

get_user_text = """
*Username*: `{username}`
*Status*: `{status}`
*Traffic limit*: `{traffic_limit}`
*Used traffic*: `{used_traffic}`
*Expiry date*: `{expires_at}`
*Created at*: `{created_at}`
*Proxy protocols*: `{protocols}`
"""


@bot.message_handler(commands=['usage'])
def usage_command(message):
    username = extract_arguments(message.text)
    if not username:
        return bot.reply_to(message, 'Usage: `/usage <username>`', parse_mode='MarkdownV2')

    with GetDB() as db:
        dbuser = crud.get_user(db, username)

        if not dbuser:
            return bot.reply_to(message, "No user found with this username")
        user = UserResponse.from_orm(dbuser)

        text = get_user_text.format(
            username=user.username,
            status=user.status,
            traffic_limit=readable_size(user.data_limit) if user.data_limit else '-',
            used_traffic=readable_size(user.used_traffic),
            expires_at=datetime.fromtimestamp(user.expire, UTC).strftime('%m/%d/%Y') if user.expire else '-',
            created_at=user.created_at.strftime('%m/%d/%Y'),
            protocols=','.join(user.proxies.keys())
        )

    return bot.reply_to(message, text, parse_mode='MarkdownV2')
