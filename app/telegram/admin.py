from app.utils.readable import readable_size
from datetime import datetime
from app import xray
from app.db import GetDB, crud
from app.models.user import UserResponse, UserStatus
from app.telegram import bot
from app.utils.system import cpu_usage, memory_usage
from config import TELEGRAM_ADMIN_ID
from pytz import UTC
from telebot.custom_filters import ChatFilter
from telebot.util import extract_arguments
from telebot.formatting import escape_markdown

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
                              total_bandwidth=readable_size(bandwidth.uplink + bandwidth.downlink),
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
            return bot.reply_to(message, "No user found with this username")
        user = UserResponse.from_orm(dbuser)

        text = get_user_text.format(
            username=user.username,
            status=user.status,
            traffic_limit=readable_size(user.data_limit) if user.data_limit else '-',
            used_traffic=readable_size(user.used_traffic),
            expires_at=datetime.fromtimestamp(user.expire, UTC).strftime('%m/%d/%Y') if user.expire else '-',
            created_at=user.created_at.strftime('%m/%d/%Y'),
            protocols=','.join(user.proxies.keys()),
            subscription_url=escape_markdown(user.subscription_url),
            links=escape_markdown('\n'.join(user.links))
        )

    return bot.reply_to(message, text, parse_mode='MarkdownV2')
