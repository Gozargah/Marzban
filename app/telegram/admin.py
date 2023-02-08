import math
from datetime import datetime
import time

from app import xray, logger
from app import telegram
from app.db import GetDB, crud
from app.models.user import UserCreate, UserResponse, UserStatus
from app.telegram import bot
from app.utils.system import cpu_usage, memory_usage
from config import TELEGRAM_ADMIN_ID
from pytz import UTC
from telebot.custom_filters import ChatFilter
from telebot.util import extract_arguments
from telebot.formatting import escape_markdown
from app.xray import INBOUNDS
import sqlalchemy

bot.add_custom_filter(ChatFilter())


commands_text = """🚀 Marzban's bot commands:

/system
_\- Get system info_

/restart
_\- Restart Xray core_

/user \<username\>
_\- Get user information_
"""

system_text = """⚙️ System statistics

*CPU Cores*: `{cpu_cores}`
*CPU Usage*: `{cpu_percent}%`

*Total Memory*: `{total_memory}`
*In Use Memory*: `{used_memory}`
*Free Memory*: `{free_memory}`

*Total Bandwidth Usage*: `{total_bandwidth}`
*Upload Bandwidth Usage*: `{up_bandwidth}`
*Download Bandwidth Usage*: `{down_bandwidth}`

*Total Users*: `{total_users}`
*Active Users*: `{active_users}`
*Deactive Users*: `{deactive_users}`
"""


get_user_text = """
*Username*: `{username}`
*Status*: `{status}`
*Traffic limit*: `{traffic_limit}`
*Used traffic*: `{used_traffic}`
*Expiry date*: `{expires_at}`
*Created at*: `{created_at}`
*Proxy protocols*: `{protocols}`

*Subscription link*: `{subscription_url}`

*Links*:
`{links}`
"""


def readable_size(size_bytes):
    if size_bytes == 0:
        return "0B"
    size_name = ("B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB")
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    return f'{s} {size_name[i]}'


@bot.message_handler(commands=['start', 'help'], chat_id=[TELEGRAM_ADMIN_ID])
def help_command(message):
    return bot.reply_to(message, commands_text, parse_mode="MarkdownV2")


@bot.message_handler(commands=['system'], chat_id=[TELEGRAM_ADMIN_ID])
def system_command(message):
    mem = memory_usage()
    cpu = cpu_usage()
    with GetDB() as db:
        bandwidth = crud.get_system_usage(db)
        total_users = crud.get_users_count(db)
        users_active = crud.get_users_count(db, UserStatus.active)

    text = system_text.format(cpu_cores=cpu.cores,
                              cpu_percent=cpu.percent,
                              total_memory=readable_size(mem.total),
                              used_memory=readable_size(mem.used),
                              free_memory=readable_size(mem.free),
                              total_bandwidth=readable_size(
                                  bandwidth.uplink + bandwidth.downlink),
                              up_bandwidth=readable_size(bandwidth.uplink),
                              down_bandwidth=readable_size(bandwidth.downlink),
                              total_users=total_users,
                              active_users=users_active,
                              deactive_users=total_users - users_active)

    return bot.reply_to(message, text, parse_mode='MarkdownV2')


@bot.message_handler(commands=['restart'], chat_id=[TELEGRAM_ADMIN_ID])
def restart_command(message):
    m = bot.reply_to(message, '🔄 Restarting...')
    xray.core.restart()
    bot.edit_message_text('✅ Xray core restarted.', m.chat.id, m.message_id)


@bot.message_handler(commands=['user'], chat_id=[TELEGRAM_ADMIN_ID])
def user_command(message):
    username = extract_arguments(message.text)
    if not username:
        return bot.reply_to(message, 'Usage: `/user <username>`', parse_mode='MarkdownV2')

    with GetDB() as db:
        dbuser = crud.get_user(db, username)

        if not dbuser:
            return bot.reply_to(message, "No user found with this username. if you want to create one, use /create command")
        user = UserResponse.from_orm(dbuser)

        links_shortened: str = ""

        if len(user.links) < 5:
            links_shortened = escape_markdown('\n'.join(user.links))
        if len(user.links) > 5:
            links_shortened = "Too many Proxies, use the subscription link instead."

        text = get_user_text.format(
            username=user.username,
            status=user.status,
            traffic_limit=readable_size(
                user.data_limit) if user.data_limit else '-',
            used_traffic=readable_size(user.used_traffic),
            expires_at=datetime.fromtimestamp(user.expire, UTC).strftime(
                '%m/%d/%Y') if user.expire else '-',
            created_at=user.created_at.strftime('%m/%d/%Y'),
            protocols=','.join(user.proxies.keys()),
            subscription_url=escape_markdown(user.subscription_url),
            links=links_shortened
        )

    return bot.reply_to(message, text, parse_mode='MarkdownV2')


@bot.message_handler(commands=['create'], chat_id=[TELEGRAM_ADMIN_ID])
def create_user_command(message):
    splitted = (message.text).split(" ")
    username = splitted[1]
    protocols = splitted[2].split(",")
    expire_date = 0
    traffic = 0
    if len(splitted) > 2:
        if splitted[3].startsWith("e:"):
            days_to_expire = splitted[3].replace("e:", "")
            expire_date = time.time() + (days_to_expire * 24 * 60 * 60)
        if splitted[4].startsWith("e:"):
            days_to_expire = splitted[4].replace("e:", "")
            expire_date = time.time() + (days_to_expire * 24 * 60 * 60)

        if splitted[3].startsWith("t:"):
            traffic_in_gb = splitted[3].replace("t:", "")
            traffic = (traffic_in_gb * 1024 * 1024 * 1024 * 1024)
        if splitted[4].startsWith("t:"):
            traffic_in_gb = splitted[4].replace("t:", "")
            traffic = (traffic_in_gb * 1024 * 1024 * 1024 * 1024)
    if not username:
        return bot.reply_to(message, 'Usage: `/create <username> <protocols> [e:<expire_date>] [t:<traffic>]`', parse_mode='MarkdownV2')

    with GetDB() as db:
        dbuser = crud.get_user(db, username)

        if dbuser:
            return bot.reply_to(message, "Already Exists")

        proxies = {}
        for proto in protocols:
            proxies[proto] = {}

        new_user = UserCreate(
            username=username, data_limit=traffic, expire=expire_date, proxies=proxies,
        )

        try:
            [INBOUNDS[t] for t in new_user.proxies]
        except KeyError as exc:
            raise bot.reply_to(
                message, f"Protocol {exc.args[0]} is disabled on your server")

        try:
            dbuser = crud.create_user(db, new_user)
        except sqlalchemy.exc.IntegrityError:
            raise bot.reply_to(message, "Already Exists")

        for proxy_type in new_user.proxies:
            account = new_user.get_account(proxy_type)
            for inbound in INBOUNDS.get(proxy_type, []):
                try:
                    xray.api.add_inbound_user(tag=inbound['tag'], user=account)
                except xray.exc.EmailExistsError:
                    pass

        telegram.report_new_user(dbuser.username, "TELEGRAM_BOT")
        logger.info(f"New user \"{dbuser.username}\" added")

    return bot.reply_to(message, "Created.", parse_mode='MarkdownV2')
