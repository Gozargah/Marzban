from app import xray
import math
from app.db import GetDB, crud
from app.models.user import UserStatus
from app.telegram import bot
from app.utils.system import cpu_usage, memory_usage
from config import TELEGRAM_ADMIN_ID
from telebot.custom_filters import ChatFilter

bot.add_custom_filter(ChatFilter())


commands_text = """🚀 Marzban's bot commands:

/system
_\- Get system info_

/restart
_\- Restart Xray core_
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
