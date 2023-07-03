import io
import math
import re
from datetime import datetime

import qrcode
import sqlalchemy
from dateutil.relativedelta import relativedelta
from telebot import types
from telebot.util import user_link

from app import xray
from app.db import GetDB, crud
from app.models.user import (UserCreate, UserModify, UserResponse, UserStatus,
                             UserStatusModify)
from app.models.user_template import UserTemplateResponse
from app.telegram import bot
from app.telegram.utils.custom_filters import (cb_query_equals,
                                               cb_query_startswith)
from app.telegram.utils.keyboard import BotKeyboard
from app.utils.store import MemoryStorage
from app.utils.system import cpu_usage, memory_usage, readable_size

mem_store = MemoryStorage()


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


def schedule_delete_message(*message_ids: int) -> None:
    messages: list[int] = mem_store.get("messages_to_delete", [])
    for mid in message_ids:
        messages.append(mid)
    mem_store.set("messages_to_delete", messages)


def cleanup_messages(chat_id: int) -> None:
    messages: list[int] = mem_store.get("messages_to_delete", [])
    for message_id in messages:
        bot.delete_message(chat_id, message_id)
    mem_store.set("messages_to_delete", [])


@bot.message_handler(commands=['start', 'help'], is_admin=True)
def help_command(message: types.Message):
    return bot.reply_to(message, """
{user_link} Welcome to Marzban Telegram-Bot Admin Panel.
Here you can manage your users and proxies.
To get started, use the buttons below.
""".format(
        user_link=user_link(message.from_user)
    ), parse_mode="html", reply_markup=BotKeyboard.main_menu())


@bot.callback_query_handler(cb_query_equals('system'), is_admin=True)
def system_command(call: types.CallbackQuery):
    return bot.edit_message_text(
        get_system_info(),
        call.message.chat.id,
        call.message.message_id,
        parse_mode="MarkdownV2",
        reply_markup=BotKeyboard.main_menu()
    )


@bot.callback_query_handler(cb_query_equals('restart'), is_admin=True)
def restart_command(call: types.CallbackQuery):
    bot.edit_message_text(
        '⚠️ Are you sure? This will restart Xray core.',
        call.message.chat.id,
        call.message.message_id,
        reply_markup=BotKeyboard.confirm_action(action='restart')
    )


@bot.callback_query_handler(cb_query_startswith('delete:'), is_admin=True)
def delete_user_command(call: types.CallbackQuery):
    username = call.data.split(':')[1]
    bot.edit_message_text(
        f'⚠️ Are you sure? This will delete user `{username}`.',
        call.message.chat.id,
        call.message.message_id,
        parse_mode="markdown",
        reply_markup=BotKeyboard.confirm_action(
            action='delete', username=username)
    )


@bot.callback_query_handler(cb_query_startswith("suspend:"), is_admin=True)
def suspend_user_command(call: types.CallbackQuery):
    username = call.data.split(":")[1]
    bot.edit_message_text(
        f"⚠️ Are you sure? This will suspend user `{username}`.",
        call.message.chat.id,
        call.message.message_id,
        parse_mode="markdown",
        reply_markup=BotKeyboard.confirm_action(
            action="suspend", username=username),
    )


@bot.callback_query_handler(cb_query_startswith("activate:"), is_admin=True)
def activate_user_command(call: types.CallbackQuery):
    username = call.data.split(":")[1]
    bot.edit_message_text(
        f"⚠️ Are you sure? This will activate user `{username}`.",
        call.message.chat.id,
        call.message.message_id,
        parse_mode="markdown",
        reply_markup=BotKeyboard.confirm_action(
            action="activate", username=username),
    )


@bot.callback_query_handler(cb_query_startswith("edit:"), is_admin=True)
def edit_command(call: types.CallbackQuery):
    username = call.data.split(":")[1]
    with GetDB() as db:
        dbuser = crud.get_user(db, username)
        if not dbuser:
            return bot.answer_callback_query(
                call.id,
                '❌ User not found.',
                show_alert=True
            )
        user = UserResponse.from_orm(dbuser)
    mem_store.set('username', username)
    mem_store.set('data_limit', dbuser.data_limit)
    mem_store.set('expire_date', datetime.fromtimestamp(dbuser.expire)
                  if dbuser.expire else None)
    mem_store.set('protocols', {
        protocol.value: inbounds for protocol, inbounds in dbuser.inbounds.items()})
    bot.edit_message_text(
        f"📝 Editing user `{username}`",
        call.message.chat.id,
        call.message.message_id,
        parse_mode="markdown",
        reply_markup=BotKeyboard.select_protocols(
            user.inbounds,
            "edit",
            username=username,
            data_limit=dbuser.data_limit,
            expire_date=mem_store.get("expire_date"),
        )
    )


@bot.callback_query_handler(cb_query_startswith('help_edit:'), is_admin=True)
def help_edit_command(call: types.CallbackQuery):
    action = call.data.split(":")[1]
    if action == "data":
        text = "❕Press the 'Edit' button to edit the Data limit!"
    elif action == "expire":
        text = "❕Press the 'Edit' button to edit the Expire date!"

    bot.answer_callback_query(
        call.id,
        text=text,
        show_alert=True
    )


@bot.callback_query_handler(cb_query_equals('cancel'), is_admin=True)
def cancel_command(call: types.CallbackQuery):
    return bot.edit_message_text(
        get_system_info(),
        call.message.chat.id,
        call.message.message_id,
        parse_mode="MarkdownV2",
        reply_markup=BotKeyboard.main_menu()
    )


@bot.callback_query_handler(cb_query_startswith('edit_user:'), is_admin=True)
def edit_user_command(call: types.CallbackQuery):
    _, username, action = call.data.split(":")
    schedule_delete_message(call.message.message_id)
    if action == "data":
        msg = bot.send_message(
            call.message.chat.id,
            '⬆️ Enter Data Limit (GB):\n⚠️ Send 0 for unlimited.',
            reply_markup=BotKeyboard.cancel_action()
        )
        mem_store.set("edit_msg_text", call.message.text)
        bot.register_next_step_handler(
            call.message, edit_user_data_limit_step, username)
        schedule_delete_message(msg.message_id)
    elif action == "expire":
        msg = bot.send_message(
            call.message.chat.id,
            '⬆️ Enter Expire Date (YYYY-MM-DD)\nOr You Can Use Regex Symbol: ^[0-9]{1,3}(M|Y) :\n⚠️ Send 0 for never expire.',
            reply_markup=BotKeyboard.cancel_action())
        mem_store.set("edit_msg_text", call.message.text)
        bot.register_next_step_handler(
            call.message, edit_user_expire_step, username=username)
        schedule_delete_message(msg.message_id)


def edit_user_data_limit_step(message: types.Message, username: str):
    if message.text == 'Cancel':
        return bot.send_message(
            message.chat.id,
            '✅ Cancelled.',
            reply_markup=types.ReplyKeyboardRemove()
        )
    try:
        if float(message.text) < 0:
            wait_msg = bot.send_message(
                message.chat.id,
                '❌ Data limit must be greater or equal to 0.',
                reply_markup=BotKeyboard.cancel_action()
            )
            schedule_delete_message(wait_msg.message_id)
            return bot.register_next_step_handler(wait_msg, edit_user_data_limit_step, username=username)
        data_limit = float(message.text) * 1024 * 1024 * 1024
    except ValueError:
        wait_msg = bot.send_message(
            message.chat.id,
            '❌ Data limit must be a number.',
            reply_markup=BotKeyboard.cancel_action()
        )
        schedule_delete_message(wait_msg.message_id)
        return bot.register_next_step_handler(wait_msg, edit_user_data_limit_step, username=username)
    mem_store.set('data_limit', data_limit)
    schedule_delete_message(message.message_id)
    text = mem_store.get("edit_msg_text")
    mem_store.delete("edit_msg_text")
    bot.send_message(
        message.chat.id,
        text or f"📝 Editing user <code>{username}</code>",
        parse_mode="html",
        reply_markup=BotKeyboard.select_protocols(mem_store.get(
            "protocols"), "edit", username=username, data_limit=data_limit, expire_date=mem_store.get("expire_date"))
    )
    cleanup_messages(message.chat.id)


def edit_user_expire_step(message: types.Message, username: str,):
    if message.text == 'Cancel':
        return bot.send_message(
            message.chat.id,
            '✅ Cancelled.',
            reply_markup=types.ReplyKeyboardRemove()
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
            schedule_delete_message(wait_msg.message_id)
            return bot.register_next_step_handler(
                wait_msg, edit_user_expire_step, username=username)
    except ValueError:
        wait_msg = bot.send_message(
            message.chat.id,
            '❌ Expire date must be in YYYY-MM-DD format.\nOr You Can Use Regex Symbol: ^[0-9]{1,3}(M|Y)',
            reply_markup=BotKeyboard.cancel_action()
        )
        schedule_delete_message(wait_msg.message_id)
        return bot.register_next_step_handler(wait_msg, edit_user_expire_step, username=username)

    mem_store.set('expire_date', expire_date)
    schedule_delete_message(message.message_id)
    text = mem_store.get("edit_msg_text")
    mem_store.delete("edit_msg_text")
    bot.send_message(
        message.chat.id,
        text or f"📝 Editing user <code>{username}</code>",
        parse_mode="html",
        reply_markup=BotKeyboard.select_protocols(mem_store.get(
            "protocols"), "edit", username=username, data_limit=mem_store.get("data_limit"), expire_date=expire_date)
    )
    cleanup_messages(message.chat.id)


@bot.callback_query_handler(cb_query_startswith('users:'), is_admin=True)
def users_command(call: types.CallbackQuery):
    page = int(call.data.split(':')[1]) if len(call.data.split(':')) > 1 else 1
    with GetDB() as db:
        total_pages = math.ceil(crud.get_users_count(db) / 10)
        users = crud.get_users(db, offset=(page - 1) * 10, limit=10, sort=[crud.UsersSortingOptions["-created_at"]])
        text = """👥 Users: (Page {page}/{total_pages})
✅ Active
❌ Disabled
🕰 Expired
📵 Limited""".format(page=page, total_pages=total_pages)

    bot.edit_message_text(
        text,
        call.message.chat.id,
        call.message.message_id,
        parse_mode="HTML",
        reply_markup=BotKeyboard.user_list(
            users, page, total_pages=total_pages)
    )


def get_user_info_text(
        username: str, sub_url: str, inbounds: dict, data_limit: int | None = None, usage: int | None = None, expire: int |
        None = None) -> str:
    protocols = ""
    for p, inbounds in inbounds.items():
        protocols += f"\n├─ <b>{p.upper()}</b>\n"
        protocols += "├───" + ", ".join([f"<code>{i}</code>" for i in inbounds])
    text = f"""
📊 User Info:
┌ Username: <b>{username}</b>
├ Usage Limit: <b>{readable_size(data_limit) if data_limit else 'Unlimited'}</b>
├ Used Traffic: <b>{readable_size(usage) if usage else "-"}</b>
├ Expiry Date <b>{datetime.fromtimestamp(expire).strftime('%Y-%m-%d') if expire else 'Never'}</b>
├ Protocols: {protocols}
└ Subscription URL: <code>{sub_url}</code>
        """
    return text


def get_template_info_text(
        id: int, data_limit: int, expire_duration: int, username_prefix: str, username_suffix: str, inbounds: dict):
    protocols = ""
    for p, inbounds in inbounds.items():
        protocols += f"\n├─ <b>{p.upper()}</b>\n"
        protocols += "├───" + ", ".join([f"<code>{i}</code>" for i in inbounds])
    text = f"""
📊 Template Info:
┌ ID: <b>{id}</b>
├ Data Limit: <b>{readable_size(data_limit) if data_limit else 'Unlimited'}</b>
├ Expire Date: <b>{(datetime.today() + relativedelta(seconds=expire_duration)).strftime('%Y-%m-%d') if expire_duration else 'Never'}</b>
├ Username Prefix: <b>{username_prefix if username_prefix else '🚫'}</b>
├ Username Suffix: <b>{username_suffix if username_suffix else '🚫'}</b>
├ Protocols: {protocols}
        """
    return text


@bot.callback_query_handler(cb_query_startswith('user:'), is_admin=True)
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

    text = get_user_info_text(
        username=username, sub_url=user.subscription_url, inbounds=user.inbounds,
        data_limit=user.data_limit, usage=user.used_traffic, expire=user.expire),
    bot.edit_message_text(
        text,
        call.message.chat.id, call.message.message_id, parse_mode="HTML",
        reply_markup=BotKeyboard.user_menu(
            {'username': user.username, 'status': user.status, },
            page=page))


@bot.callback_query_handler(cb_query_startswith("links:"), is_admin=True)
def links_command(call: types.CallbackQuery):
    username = call.data.split(":")[1]

    with GetDB() as db:
        dbuser = crud.get_user(db, username)
        if not dbuser:
            return bot.answer_callback_query(call.id, "User not found!", show_alert=True)

        user = UserResponse.from_orm(dbuser)

    text = ""
    for link in user.links:
        text += f"<code>{link}</code>\n\n"

    bot.edit_message_text(
        text,
        call.message.chat.id,
        call.message.message_id,
        parse_mode="HTML",
        reply_markup=BotKeyboard.show_links(username)
    )


@bot.callback_query_handler(cb_query_startswith("genqr:"), is_admin=True)
def genqr_command(call: types.CallbackQuery):
    username = call.data.split(":")[1]

    with GetDB() as db:
        dbuser = crud.get_user(db, username)
        if not dbuser:
            return bot.answer_callback_query(call.id, "User not found!", show_alert=True)

        user = UserResponse.from_orm(dbuser)

    bot.answer_callback_query(call.id, "Generating Qr code...")

    for link in user.links:
        f = io.BytesIO()
        qr = qrcode.QRCode(border=6)
        qr.add_data(link)
        qr.make_image().save(f)
        f.seek(0)
        bot.send_photo(
            call.message.chat.id,
            photo=f,
            caption=f"<code>{link}</code>",
            parse_mode="HTML"
        )


@bot.callback_query_handler(cb_query_equals('template_add_user'), is_admin=True)
def add_user_from_template_command(call: types.CallbackQuery):
    with GetDB() as db:
        templates = crud.get_user_templates(db)
        if not templates:
            return bot.answer_callback_query(call.id, "You don't have any User Templates!")

    bot.edit_message_text(
        "❕Select a Template to create user from:",
        call.message.chat.id,
        call.message.message_id,
        reply_markup=BotKeyboard.templates_menu({template.name: template.id for template in templates})
    )


@bot.callback_query_handler(cb_query_startswith('template_add_user:'), is_admin=True)
def add_user_command(call: types.CallbackQuery):
    id = int(call.data.split(":")[1])
    with GetDB() as db:
        template = crud.get_user_template(db, id)
        if not template:
            return bot.answer_callback_query(call.id, "Template not found!", show_alert=True)
        template = UserTemplateResponse.from_orm(template)

    text = get_template_info_text(
        id, data_limit=template.data_limit, expire_duration=template.expire_duration,
        username_prefix=template.username_prefix, username_suffix=template.username_suffix,
        inbounds=template.inbounds)
    if template.username_prefix:
        text += f"\n⚠️ Username will be prefixed with <code>{template.username_prefix}</code>"
    if template.username_suffix:
        text += f"\n⚠️ Username will be suffixed with <code>{template.username_suffix}</code>"

    mem_store.set("template_id", template.id)
    template_msg = bot.edit_message_text(
        text,
        call.message.chat.id,
        call.message.message_id,
        parse_mode="HTML",
        reply_markup=BotKeyboard.inline_cancel_action(callback_data="template_add_user")
    )
    text = '👤 Enter username:\n⚠️ Username only can be 3 to 32 characters and contain a-z, 0-9, and underscores in between.'
    bot.send_message(
        call.message.chat.id,
        text,
        parse_mode="HTML",
        reply_markup=BotKeyboard.cancel_action()
    )
    schedule_delete_message(template_msg.message_id)
    bot.register_next_step_handler(template_msg, add_user_from_template_username_step)


def add_user_from_template_username_step(message: types.Message):
    template_id = mem_store.get("template_id")
    if template_id is None:
        return bot.send_message(message.chat.id, "An error occured in the process! try again.")

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
        schedule_delete_message(wait_msg.message_id, message.message_id)
        return bot.register_next_step_handler(wait_msg, add_user_from_template_username_step)

    with GetDB() as db:
        match = re.match(r'^[a-z0-9_]+$', message.text)
        if not match:
            wait_msg = bot.send_message(
                message.chat.id,
                '❌ Username only can be 3 to 32 characters and contain a-z, 0-9, and underscores in between.',
                reply_markup=BotKeyboard.cancel_action()
            )
            schedule_delete_message(wait_msg.message_id, message.message_id)
            return bot.register_next_step_handler(wait_msg, add_user_from_template_username_step)

        template = crud.get_user_template(db, template_id)

        username = message.text
        if template.username_prefix:
            username = template.username_prefix + username
        if template.username_suffix:
            username += template.username_suffix

        if len(username) < 3:
            wait_msg = bot.send_message(
                message.chat.id,
                f"❌ Username can't be generated because is shorter than 32 characters! username: <code>{username}</code>",
                parse_mode="HTML", reply_markup=BotKeyboard.cancel_action())
            schedule_delete_message(wait_msg.message_id, message.message_id)
            return bot.register_next_step_handler(wait_msg, add_user_from_template_username_step)
        elif len(username) > 32:
            wait_msg = bot.send_message(
                message.chat.id,
                f"❌ Username can't be generated because is longer than 32 characters! username: <code>{username}</code>",
                parse_mode="HTML", reply_markup=BotKeyboard.cancel_action())
            schedule_delete_message(wait_msg.message_id, message.message_id)
            return bot.register_next_step_handler(wait_msg, add_user_from_template_username_step)

        if crud.get_user(db, username):
            wait_msg = bot.send_message(
                message.chat.id,
                '❌ Username already exists.',
                reply_markup=BotKeyboard.cancel_action()
            )
            schedule_delete_message(wait_msg.message_id, message.message_id)
            return bot.register_next_step_handler(wait_msg, add_user_from_template_username_step)
        template = UserTemplateResponse.from_orm(template)
    mem_store.set("username", username)
    mem_store.set("data_limit", template.data_limit)
    mem_store.set("protocols", template.inbounds)
    expire_date = None
    if template.expire_duration:
        expire_date = datetime.today() + relativedelta(seconds=template.expire_duration)
    mem_store.set("expire_date", expire_date)

    text = f"📝 Creating user <code>{username}</code>\n" + get_template_info_text(
        id=template.id, data_limit=template.data_limit, expire_duration=template.expire_duration,
        username_prefix=template.username_prefix, username_suffix=template.username_suffix, inbounds=template.inbounds)

    bot.send_message(
        message.chat.id,
        text,
        parse_mode="HTML",
        reply_markup=BotKeyboard.select_protocols(
            template.inbounds,
            "create_from_template",
            username=username,
            data_limit=template.data_limit,
            expire_date=expire_date,
        )
    )
    cleanup_messages(message.chat.id)


@bot.callback_query_handler(cb_query_equals('add_user'), is_admin=True)
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
    bot.register_next_step_handler(
        message, add_user_data_limit_step, username=message.text)


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
    bot.register_next_step_handler(
        message, add_user_expire_step, username=username, data_limit=data_limit)


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
            readable_size(mem_store.get('data_limit')) if mem_store.get(
                'data_limit') else "Unlimited",
            mem_store.get('expire_date').strftime(
                "%Y-%m-%d") if mem_store.get('expire_date') else 'Never'
        ),
        reply_markup=BotKeyboard.select_protocols({}, action="create")
    )


@bot.callback_query_handler(cb_query_startswith('select_inbound:'), is_admin=True)
def select_inbounds(call: types.CallbackQuery):
    if not (username := mem_store.get('username')):
        return bot.answer_callback_query(call.id, '❌ No user selected.', show_alert=True)
    protocols: dict[str, list[str]] = mem_store.get('protocols', {})
    _, inbound, action = call.data.split(':')
    for protocol, inbounds in xray.config.inbounds_by_protocol.items():
        for i in inbounds:
            if i['tag'] != inbound:
                continue
            if not inbound in protocols[protocol]:
                protocols[protocol].append(inbound)
            else:
                protocols[protocol].remove(inbound)
            if len(protocols[protocol]) < 1:
                del protocols[protocol]

    mem_store.set('protocols', protocols)

    if action in ["edit", "create_from_template"]:
        return bot.edit_message_text(
            call.message.text,
            call.message.chat.id,
            call.message.message_id,
            reply_markup=BotKeyboard.select_protocols(
                protocols,
                "edit",
                username=username,
                data_limit=mem_store.get("data_limit"),
                expire_date=mem_store.get("expire_date"))
        )
    bot.edit_message_text(
        call.message.text,
        call.message.chat.id,
        call.message.message_id,
        reply_markup=BotKeyboard.select_protocols(protocols, "create")
    )


@bot.callback_query_handler(cb_query_startswith('select_protocol:'), is_admin=True)
def select_protocols(call: types.CallbackQuery):
    if not (username := mem_store.get('username')):
        return bot.answer_callback_query(call.id, '❌ No user selected.', show_alert=True)
    protocols: dict[str, list[str]] = mem_store.get('protocols', {})
    _, protocol, action = call.data.split(':')
    if protocol in protocols:
        del protocols[protocol]
    else:
        protocols.update(
            {protocol: [inbound['tag'] for inbound in xray.config.inbounds_by_protocol[protocol]]})
    mem_store.set('protocols', protocols)

    if action == ["edit", "create_from_template"]:
        return bot.edit_message_text(
            call.message.text,
            call.message.chat.id,
            call.message.message_id,
            reply_markup=BotKeyboard.select_protocols(
                protocols,
                "edit",
                username=username,
                data_limit=mem_store.get("data_limit"),
                expire_date=mem_store.get("expire_date"))
        )
    bot.edit_message_text(
        call.message.text,
        call.message.chat.id,
        call.message.message_id,
        reply_markup=BotKeyboard.select_protocols(protocols, action="create")
    )


@bot.callback_query_handler(cb_query_startswith('confirm:'), is_admin=True)
def confirm_user_command(call: types.CallbackQuery):
    data = call.data.split(':')[1]

    if data == 'delete':
        username = call.data.split(':')[2]
        with GetDB() as db:
            dbuser = crud.get_user(db, username)
            crud.remove_user(db, dbuser)
            xray.operations.remove_user(dbuser)

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
            crud.update_user(db, dbuser, UserModify(
                status=UserStatusModify.disabled))
            xray.operations.remove_user(dbuser)
        return bot.edit_message_text(
            "✅ User suspended.",
            call.message.chat.id,
            call.message.message_id,
            reply_markup=BotKeyboard.main_menu()
        )
    elif data == "activate":
        username = call.data.split(":")[2]
        with GetDB() as db:
            dbuser = crud.get_user(db, username)
            crud.update_user(db, dbuser, UserModify(
                status=UserStatusModify.active))
            xray.operations.add_user(dbuser)

        return bot.edit_message_text(
            "✅ User activated.",
            call.message.chat.id,
            call.message.message_id,
            reply_markup=BotKeyboard.main_menu()
        )
    elif data == 'restart':
        m = bot.edit_message_text(
            '🔄 Restarting XRay core...', call.message.chat.id, call.message.message_id)
        xray.core.restart(xray.config.include_db_users())
        for node_id, node in list(xray.nodes.items()):
            if node.connected:
                xray.operations.restart_node(node_id, xray.config.include_db_users())
        bot.edit_message_text(
            '✅ XRay core restarted successfully.',
            m.chat.id, m.message_id,
            reply_markup=BotKeyboard.main_menu()
        )

    elif data == 'edit_user':
        if (username := mem_store.get('username')) is None:
            try:
                bot.delete_message(call.message.chat.id,
                                   call.message.message_id)
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
                '❌ No inbounds selected.',
                show_alert=True
            )

        inbounds: dict[str, list[str]] = {
            k: v for k, v in mem_store.get('protocols').items() if v}

        with GetDB() as db:
            db_user = crud.get_user(db, username)
            if not db_user:
                return bot.answer_callback_query(call.id, text=f"User not found!", show_alert=True)

            proxies = {p.type.value: p.settings for p in db_user.proxies}

            for protocol in xray.config.inbounds_by_protocol:
                if protocol in inbounds and protocol not in db_user.inbounds:
                    proxies.update({protocol: {}})
                elif protocol in db_user.inbounds and protocol not in inbounds:
                    del proxies[protocol]

            modify = UserModify(
                expire=mem_store.get('expire_date').timestamp(
                ) if mem_store.get('expire_date') else 0,
                data_limit=mem_store.get("data_limit"),
                proxies=proxies,
                inbounds=inbounds
            )
            db_user = crud.update_user(db, db_user, modify)
            proxies = db_user.proxies

            user = UserResponse.from_orm(db_user)

        if user.status == UserStatus.active:
            xray.operations.update_user(db_user)
        else:
            xray.operations.remove_user(db_user)

        bot.answer_callback_query(call.id, "✅ User updated successfully.")
        text = get_user_info_text(username=user.username,
                                  sub_url=user.subscription_url,
                                  inbounds=user.inbounds,
                                  data_limit=user.data_limit,
                                  usage=user.used_traffic,
                                  expire=user.expire
                                  )
        bot.edit_message_text(
            text,
            call.message.chat.id,
            call.message.message_id,
            parse_mode="HTML",
            reply_markup=BotKeyboard.user_menu({
                'username': db_user.username,
                'id': db_user.id,
                'status': db_user.status
            }, view_user=True)
        )

    elif data == 'add_user':
        if mem_store.get('username') is None:
            try:
                bot.delete_message(call.message.chat.id,
                                   call.message.message_id)
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
                '❌ No inbounds selected.',
                show_alert=True
            )

        inbounds: dict[str, list[str]] = {
            k: v for k, v in mem_store.get('protocols').items() if v}
        new_user = UserCreate(
            username=mem_store.get('username'),
            expire=mem_store.get('expire_date').timestamp(
            ) if mem_store.get('expire_date') else None,
            data_limit=mem_store.get('data_limit') if mem_store.get(
                'data_limit') else None,
            proxies={p: {} for p in inbounds},
            inbounds=inbounds
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
                user = UserResponse.from_orm(db_user)
        except sqlalchemy.exc.IntegrityError:
            db.rollback()
            return bot.answer_callback_query(
                call.id,
                '❌ Username already exists.',
                show_alert=True
            )

        xray.operations.add_user(db_user)

        text = "✅ User added successfully" + get_user_info_text(username=user.username,
                                                                sub_url=user.subscription_url,
                                                                inbounds=user.inbounds,
                                                                data_limit=user.data_limit,
                                                                usage=user.used_traffic,
                                                                expire=user.expire
                                                                )
        bot.edit_message_text(
            text,
            call.message.chat.id,
            call.message.message_id,
            parse_mode="HTML",
            reply_markup=BotKeyboard.user_menu({
                'username': db_user.username,
                'id': db_user.id,
                'status': 'active'
            }, view_user=True)
        )
