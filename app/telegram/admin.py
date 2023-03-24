import math
import re
from datetime import datetime

import sqlalchemy
from dateutil.relativedelta import relativedelta
from telebot import types
from telebot.custom_filters import AdvancedCustomFilter
from telebot.util import user_link

from app import xray
from app.db import GetDB, crud
from app.models.user import UserCreate, UserResponse, UserStatus, UserModify, UserStatusModify
from app.telegram import bot
from app.telegram.keyboard import BotKeyboard
from app.utils.store import MemoryStorage
from app.utils.system import cpu_usage, memory_usage, readable_size
from app.utils.xray import (xray_add_user, xray_config_include_db_clients,
                            xray_remove_user)
from config import TELEGRAM_ADMIN_ID

mem_store = MemoryStorage()


class IsAdminFilter(AdvancedCustomFilter):
    key = 'is_admin'

    def check(self, message, text):
        """
        :meta private:
        """
        if isinstance(message, types.CallbackQuery):
            return message.from_user.id == TELEGRAM_ADMIN_ID
        return message.chat.id == TELEGRAM_ADMIN_ID


bot.add_custom_filter(IsAdminFilter())


def get_system_info():
    mem = memory_usage()
    cpu = cpu_usage()
    with GetDB() as db:
        bandwidth = crud.get_system_usage(db)
        total_users = crud.get_users_count(db)
        users_active = crud.get_users_count(db, UserStatus.active)
    return """⚙️ System statistics:
*CPU Cores*: `{cpu_cores}`
*CPU Usage*: `{cpu_percent}%`
➖➖➖➖➖➖➖
*Total Memory*: `{total_memory}`
*In Use Memory*: `{used_memory}`
*Free Memory*: `{free_memory}`
➖➖➖➖➖➖➖
*Total Bandwidth Usage*: `{total_bandwidth}`
*Upload Bandwidth Usage*: `{up_bandwidth}`
*Download Bandwidth Usage*: `{down_bandwidth}`
➖➖➖➖➖➖➖
*Total Users*: `{total_users}`
*Active Users*: `{active_users}`
*Deactive Users*: `{deactive_users}`
""".format(
        cpu_cores=cpu.cores,
        cpu_percent=cpu.percent,
        total_memory=readable_size(mem.total),
        used_memory=readable_size(mem.used),
        free_memory=readable_size(mem.free),
        total_bandwidth=readable_size(bandwidth.uplink + bandwidth.downlink),
        up_bandwidth=readable_size(bandwidth.uplink),
        down_bandwidth=readable_size(bandwidth.downlink),
        total_users=total_users,
        active_users=users_active,
        deactive_users=total_users - users_active
    )


@bot.message_handler(commands=['start', 'help'], is_admin=True)
def help_command(message: types.Message):
    return bot.reply_to(message, """
{user_link} Welcome to Marzban Telegram-Bot Admin Panel.
Here you can manage your users and proxies.
To get started, use the buttons below.
""".format(
        user_link=user_link(message.from_user)
    ), parse_mode="html", reply_markup=BotKeyboard.main_menu())


@bot.callback_query_handler(func=lambda call: call.data == 'system', is_admin=True)
def system_command(call: types.CallbackQuery):
    return bot.edit_message_text(
        get_system_info(),
        call.message.chat.id,
        call.message.message_id,
        parse_mode="MarkdownV2",
        reply_markup=BotKeyboard.main_menu()
    )


@bot.callback_query_handler(func=lambda call: call.data == 'restart', is_admin=True)
def restart_command(call: types.CallbackQuery):
    bot.edit_message_text(
        '⚠️ Are you sure? This will restart Xray core.',
        call.message.chat.id,
        call.message.message_id,
        reply_markup=BotKeyboard.confirm_action(action='restart')
    )


@bot.callback_query_handler(func=lambda call: call.data.startswith('delete:'), is_admin=True)
def delete_user_command(call: types.CallbackQuery):
    username = call.data.split(':')[1]
    bot.edit_message_text(
        f'⚠️ Are you sure? This will delete user `{username}`.',
        call.message.chat.id,
        call.message.message_id,
        parse_mode="markdown",
        reply_markup=BotKeyboard.confirm_action(action='delete', username=username)
    )


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("suspend:"), is_admin=True
)
def suspend_user_command(call: types.CallbackQuery):
    username = call.data.split(":")[1]
    bot.edit_message_text(
        f"⚠️ Are you sure? This will suspend user `{username}`.",
        call.message.chat.id,
        call.message.message_id,
        parse_mode="markdown",
        reply_markup=BotKeyboard.confirm_action(action="suspend", username=username),
    )


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("activate:"), is_admin=True
)
def activate_user_command(call: types.CallbackQuery):
    username = call.data.split(":")[1]
    bot.edit_message_text(
        f"⚠️ Are you sure? This will activate user `{username}`.",
        call.message.chat.id,
        call.message.message_id,
        parse_mode="markdown",
        reply_markup=BotKeyboard.confirm_action(action="activate", username=username),
    )

@bot.callback_query_handler(func=lambda call: call.data == 'cancel', is_admin=True)
def cancel_command(call: types.CallbackQuery):
    return bot.edit_message_text(
        get_system_info(),
        call.message.chat.id,
        call.message.message_id,
        parse_mode="MarkdownV2",
        reply_markup=BotKeyboard.main_menu()
    )


@bot.callback_query_handler(func=lambda call: call.data.startswith('users:'), is_admin=True)
def users_command(call: types.CallbackQuery):
    page = int(call.data.split(':')[1]) if len(call.data.split(':')) > 1 else 1
    with GetDB() as db:
        total_pages = math.ceil(crud.get_users_count(db) / 10)
        users = crud.get_users(db, offset=(page - 1) * 10, limit=10)
        text = """👥 Users: (Page {page}/{total_pages})
✅ Active
❌ Disabled
🕰 Expired
📵 Limited""".format(page=page, total_pages=total_pages)

    bot.edit_message_text(
        text,
        call.message.chat.id,
        call.message.message_id,
        parse_mode="Markdown",
        reply_markup=BotKeyboard.user_list(users, page, total_pages=total_pages)
    )


@bot.callback_query_handler(func=lambda call: call.data.startswith('user:'), is_admin=True)
def user_command(call: types.CallbackQuery):
    username = call.data.split(':')[1]
    page = int(call.data.split(':')[2]) if len(call.data.split(':')) > 2 else 1
    with GetDB() as db:
        dbuser = crud.get_user(db, username)
        if not dbuser:
            return bot.answer_callback_query(
                call.id,
                '❌ User not found.',
                show_alert=True
            )
        user = UserResponse.from_orm(dbuser)
    text = """
📊 User Info:
┌ Username: <b>{username}</b>
├ Usage Limit: <b>{usage_limit}</b>
├ Used Traffic: <b>{usage}</b>
├ Expiry Date <b>{expire_date}</b>
├ Protocols: {protocols}
└ Subscription URL: <code>{url}</code>
        """.format(
        username=user.username,
        usage=readable_size(user.used_traffic) if user.used_traffic else "Unlimited",
        usage_limit=readable_size(user.data_limit) if user.data_limit else "Unlimited",
        expire_date=datetime.fromtimestamp(user.expire).strftime("%Y-%m-%d") if user.expire else "Never",
        protocols=",".join([proxy for proxy in user.proxies]),
        url=user.subscription_url
    )
    bot.edit_message_text(
        text,
        call.message.chat.id,
        call.message.message_id,
        parse_mode="HTML",
        reply_markup=BotKeyboard.user_menu({
            'username': user.username,
            'status': user.status,
        }, page=page)
    )


@bot.callback_query_handler(func=lambda call: call.data == 'add_user', is_admin=True)
def add_user_command(call: types.CallbackQuery):
    try:
        bot.delete_message(call.message.chat.id, call.message.message_id)
    except:  # noqa
        pass
    username_msg = bot.send_message(
        call.message.chat.id,
        '👤 Enter username:\n⚠️Username only can be 3 to 32 characters and contain a-z, 0-9, and underscores in '
        'between.',
        reply_markup=BotKeyboard.cancel_action()
    )
    bot.register_next_step_handler(username_msg, add_user_username_step)


def add_user_username_step(message: types.Message):
    if message.text == 'Cancel':
        return bot.send_message(
            message.chat.id,
            '✅ Cancelled.',
            reply_markup=BotKeyboard.main_menu()
        )
    if not message.text:
        wait_msg = bot.send_message(
            message.chat.id,
            '❌ Username can not be empty.',
            reply_markup=BotKeyboard.cancel_action()
        )
        return bot.register_next_step_handler(wait_msg, add_user_username_step)
    if not re.match(r'^[a-z0-9_]{3,32}$', message.text):
        wait_msg = bot.send_message(
            message.chat.id,
            '❌ Username only can be 3 to 32 characters and contain a-z, 0-9, and underscores in between.',
            reply_markup=BotKeyboard.cancel_action()
        )
        return bot.register_next_step_handler(wait_msg, add_user_username_step)
    with GetDB() as db:
        if crud.get_user(db, message.text):
            wait_msg = bot.send_message(
                message.chat.id,
                '❌ Username already exists.',
                reply_markup=BotKeyboard.cancel_action()
            )
            return bot.register_next_step_handler(wait_msg, add_user_username_step)
    bot.send_message(
        message.chat.id,
        '⬆️ Enter Data Limit (GB):\n⚠️ Send 0 for unlimited.',
        reply_markup=BotKeyboard.cancel_action()
    )
    bot.register_next_step_handler(message, add_user_data_limit_step, username=message.text)


def add_user_data_limit_step(message: types.Message, username: str):
    if message.text == 'Cancel':
        return bot.send_message(
            message.chat.id,
            '✅ Cancelled.',
            reply_markup=BotKeyboard.main_menu()
        )
    try:
        if float(message.text) < 0:
            wait_msg = bot.send_message(
                message.chat.id,
                '❌ Data limit must be greater or equal to 0.',
                reply_markup=BotKeyboard.cancel_action()
            )
            return bot.register_next_step_handler(wait_msg, add_user_data_limit_step, username=username)
        data_limit = float(message.text) * 1024 * 1024 * 1024
    except ValueError:
        wait_msg = bot.send_message(
            message.chat.id,
            '❌ Data limit must be a number.',
            reply_markup=BotKeyboard.cancel_action()
        )
        return bot.register_next_step_handler(wait_msg, add_user_data_limit_step, username=username)
    bot.send_message(
        message.chat.id,
        '⬆️ Enter Expire Date (YYYY-MM-DD)\nOr You Can Use Regex Symbol: ^[0-9]{1,3}(M|Y) :\n⚠️ Send 0 for never expire.',
        reply_markup=BotKeyboard.cancel_action())
    bot.register_next_step_handler(message, add_user_expire_step, username=username, data_limit=data_limit)


def add_user_expire_step(message: types.Message, username: str, data_limit: int):
    if message.text == 'Cancel':
        return bot.send_message(
            message.chat.id,
            '✅ Cancelled.',
            reply_markup=BotKeyboard.main_menu()
        )
    try:
        today = datetime.today()
        if re.match(r'^[0-9]{1,3}(M|m|Y|y)$', message.text):
            expire_date = today
            number_pattern = r'^[0-9]{1,3}'
            number = int(re.findall(number_pattern, message.text)[0])
            symbol_pattern = r'(M|m|Y|y)$'
            symbol = re.findall(symbol_pattern, message.text)[0].upper()
            if symbol == 'M':
                expire_date = today + relativedelta(months=number)
            elif symbol == 'Y':
                expire_date = today + relativedelta(years=number)
        elif message.text != '0':
            expire_date = datetime.strptime(message.text, "%Y-%m-%d")
        else:
            expire_date = None
        if expire_date and expire_date < today:
            wait_msg = bot.send_message(
                message.chat.id,
                '❌ Expire date must be greater than today.',
                reply_markup=BotKeyboard.cancel_action()
            )
            return bot.register_next_step_handler(
                wait_msg, add_user_expire_step, username=username, data_limit=data_limit)
    except ValueError:
        wait_msg = bot.send_message(
            message.chat.id,
            '❌ Expire date must be in YYYY-MM-DD format.\nOr You Can Use Regex Symbol: ^[0-9]{1,3}(M|Y)',
            reply_markup=BotKeyboard.cancel_action()
        )
        return bot.register_next_step_handler(wait_msg, add_user_expire_step, username=username, data_limit=data_limit)
    mem_store.set('username', username)
    mem_store.set('data_limit', data_limit)
    mem_store.set('expire_date', expire_date)

    bot.send_message(
        message.chat.id,
        'Select Protocols:\nUsernames: {}\nData Limit: {}\nExpiry Date {}'.format(
            mem_store.get('username'),
            readable_size(mem_store.get('data_limit')) if mem_store.get('data_limit') else "Unlimited",
            mem_store.get('expire_date').strftime("%Y-%m-%d") if mem_store.get('expire_date') else 'Never'
        ),
        reply_markup=BotKeyboard.select_protocols([])
    )


@bot.callback_query_handler(func=lambda call: call.data.startswith('select:'), is_admin=True)
def select_protocols(call: types.CallbackQuery):
    if not mem_store.get('username'):
        return bot.answer_callback_query(call.id, '❌ No user selected.', show_alert=True)
    protocols = mem_store.get('protocols', [])
    protocol = call.data.split(':')[1]
    if protocol in protocols:
        protocols.remove(protocol)
    else:
        protocols.append(protocol)
    mem_store.set('protocols', protocols)
    bot.edit_message_text(
        'Select Protocols:\nUsernames: {}\nData Limit: {}\nExpiry Date: {}'.format(
            mem_store.get('username'),
            readable_size(mem_store.get('data_limit')) if mem_store.get('data_limit') else "Unlimited",
            mem_store.get('expire_date').strftime("%Y-%m-%d") if mem_store.get('expire_date') else 'Never'
        ),
        call.message.chat.id,
        call.message.message_id,
        reply_markup=BotKeyboard.select_protocols(protocols)
    )


@bot.callback_query_handler(func=lambda call: call.data.startswith('confirm:'), is_admin=True)
def confirm_user_command(call: types.CallbackQuery):
    data = call.data.split(':')[1]

    if data == 'delete':
        username = call.data.split(':')[2]
        with GetDB() as db:
            dbuser = crud.get_user(db, username)
            crud.remove_user(db, dbuser)
            xray_remove_user(dbuser)

        return bot.edit_message_text(
            '✅ User deleted.',
            call.message.chat.id,
            call.message.message_id,
            reply_markup=BotKeyboard.main_menu()
        )
    elif data == "suspend":
        username = call.data.split(":")[2]
        with GetDB() as db:
            dbuser = crud.get_user(db, username)
            crud.update_user(db, dbuser, UserModify(status=UserStatusModify.disabled))
            xray_remove_user(dbuser)
        return bot.edit_message_text(
            "✅ User suspended.",
            call.message.chat.id,
            call.message.message_id,
            reply_markup=BotKeyboard.main_menu(),
        )
    elif data == "activate":
        username = call.data.split(":")[2]
        with GetDB() as db:
            dbuser = crud.get_user(db, username)
            crud.update_user(db, dbuser, UserModify(status=UserStatusModify.active))
            xray_add_user(dbuser)

        return bot.edit_message_text(
            "✅ User activated.",
            call.message.chat.id,
            call.message.message_id,
            reply_markup=BotKeyboard.main_menu(),
        )
    elif data == 'restart':
        m = bot.edit_message_text('🔄 Restarting XRay core...', call.message.chat.id, call.message.message_id)
        xray.core.restart(
            xray_config_include_db_clients(xray.config)
        )
        bot.edit_message_text(
            '✅ XRay core restarted successfully.',
            m.chat.id, m.message_id,
            reply_markup=BotKeyboard.main_menu()
        )

    elif data == 'add_user':
        if mem_store.get('username') is None:
            try:
                bot.delete_message(call.message.chat.id, call.message.message_id)
            except Exception:
                pass
            return bot.send_message(
                call.message.chat.id,
                '❌ Bot reload detected. Please start over.',
                reply_markup=BotKeyboard.main_menu()
            )

        if not mem_store.get('protocols'):
            return bot.answer_callback_query(
                call.id,
                '❌ No protocols selected.',
                show_alert=True
            )

        new_user = UserCreate(
            username=mem_store.get('username'),
            expire=mem_store.get('expire_date').timestamp() if mem_store.get('expire_date') else None,
            data_limit=mem_store.get('data_limit') if mem_store.get('data_limit') else None,
            proxies={k: {} for k in mem_store.get('protocols')}
        )

        for proxy_type in new_user.proxies:
            if not xray.config.inbounds_by_protocol.get(proxy_type):
                return bot.answer_callback_query(
                    call.id,
                    f'❌ Protocol {proxy_type} is disabled on your server',
                    show_alert=True
                )

        try:
            with GetDB() as db:
                db_user = crud.create_user(db, new_user)
                proxies = db_user.proxies
        except sqlalchemy.exc.IntegrityError:
            return bot.answer_callback_query(
                call.id,
                '❌ Username already exists.',
                show_alert=True
            )

        xray_add_user(new_user)

        text = """
✅ User added successfully.
┌ Username: {}
├ Data Limit: {}
├ Expire Date: {}
└ Protocols: {}
""".format(
            db_user.username,
            readable_size(db_user.data_limit) if db_user.data_limit else "Unlimited",
            mem_store.get('expire_date').strftime("%Y-%m-%d") if db_user.expire else 'Never',
            ', '.join([p.type for p in proxies])
        )
        bot.edit_message_text(
            text,
            call.message.chat.id,
            call.message.message_id,
            reply_markup=BotKeyboard.user_menu({
                'username': db_user.username,
                'id': db_user.id,
                'status': 'active'
            }, view_user=True)
        )