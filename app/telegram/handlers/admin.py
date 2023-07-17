import io
import math
import re
import string
import random
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
from app.utils.system import cpu_usage, memory_usage, readable_size, realtime_bandwidth, get_public_ip

from config import XRAY_SUBSCRIPTION_URL_PREFIX, UVICORN_PORT, TELEGRAM_LOGGER_CHANNEL_ID

SUBSCRIPTION_URL = f"{XRAY_SUBSCRIPTION_URL_PREFIX or f'http://{get_public_ip()}:{UVICORN_PORT}'}"

mem_store = MemoryStorage()


def get_system_info():
    mem = memory_usage()
    cpu = cpu_usage()
    with GetDB() as db:
        bandwidth = crud.get_system_usage(db)
        total_users = crud.get_users_count(db)
        users_active = crud.get_users_count(db, UserStatus.active)
    return """\
🎛 *CPU Cores*: `{cpu_cores}`
🖥 *CPU Usage*: `{cpu_percent}%`
➖➖➖➖➖➖➖
📊 *Total Memory*: `{total_memory}`
📈 *In Use Memory*: `{used_memory}`
📉 *Free Memory*: `{free_memory}`
➖➖➖➖➖➖➖
⬇️ *Download Usage*: `{down_bandwidth}`
⬆️ *Upload Usage*: `{up_bandwidth}`
↕️ *Total Usage*: `{total_bandwidth}`
➖➖➖➖➖➖➖
👥 *Total Users*: `{total_users}`
🟢 *Active Users*: `{active_users}`
🔴 *Deactivate Users*: `{deactivate_users}`
➖➖➖➖➖➖➖
⏫ *Upload Speed*: `{up_speed}`
⏬ *Download Speed*: `{down_speed}`
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
        deactivate_users=total_users - users_active,
        up_speed=readable_size(realtime_bandwidth().outgoing_bytes),
        down_speed=readable_size(realtime_bandwidth().outgoing_bytes)
    )


def schedule_delete_message(*message_ids: int) -> None:
    messages: list[int] = mem_store.get("messages_to_delete", [])
    for mid in message_ids:
        messages.append(mid)
    mem_store.set("messages_to_delete", messages)


def cleanup_messages(chat_id: int) -> None:
    messages: list[int] = mem_store.get("messages_to_delete", [])
    for message_id in messages:
        try: bot.delete_message(chat_id, message_id)
        except: pass
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
        db_user = crud.get_user(db, username)
        if not db_user:
            return bot.answer_callback_query(
                call.id,
                '❌ User not found.',
                show_alert=True
            )
        user = UserResponse.from_orm(db_user)
    mem_store.set('username', username)
    mem_store.set('data_limit', db_user.data_limit)
    mem_store.set('expire_date', datetime.fromtimestamp(db_user.expire)
    if db_user.expire else None)
    mem_store.set('protocols', {
        protocol.value: inbounds for protocol, inbounds in db_user.inbounds.items()})
    bot.edit_message_text(
        f"📝 Editing user `{username}`",
        call.message.chat.id,
        call.message.message_id,
        parse_mode="markdown",
        reply_markup=BotKeyboard.select_protocols(
            user.inbounds,
            "edit",
            username=username,
            data_limit=db_user.data_limit,
            expire_date=mem_store.get("expire_date"),
        )
    )


@bot.callback_query_handler(cb_query_equals('help_edit'), is_admin=True)
def help_edit_command(call: types.CallbackQuery):
    bot.answer_callback_query(
        call.id,
        text="Press the (✏️ Edit) button to edit",
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
            '⬆️ Enter Expire Date (YYYY-MM-DD)\nOr You Can Use Regex Symbol: ^[0-9]{1,3}(M|D) :\n⚠️ Send 0 for never expire.',
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


def edit_user_expire_step(message: types.Message, username: str):
    if message.text == 'Cancel':
        return bot.send_message(
            message.chat.id,
            '✅ Cancelled.',
            reply_markup=types.ReplyKeyboardRemove()
        )
    try:
        now = datetime.now()
        today = datetime(
            year=now.year,
            month=now.month,
            day=now.day,
            hour=23,
            minute=59,
            second=59
        )
        if re.match(r'^[0-9]{1,3}(M|m|D|d)$', message.text):
            expire_date = today
            number_pattern = r'^[0-9]{1,3}'
            number = int(re.findall(number_pattern, message.text)[0])
            symbol_pattern = r'(M|m|D|d)$'
            symbol = re.findall(symbol_pattern, message.text)[0].upper()
            if symbol == 'M':
                expire_date = today + relativedelta(months=number)
            elif symbol == 'D':
                expire_date = today + relativedelta(days=number)
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
            '❌ Expire date must be in YYYY-MM-DD format.\nOr You Can Use Regex Symbol: ^[0-9]{1,3}(M|D)',
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
        status: str, username: str, data_limit: int = None, usage: int = None, expire: int = None) -> str:
    statuses = {
        'active': '✅',
        'expired': '🕰',
        'limited': '📵',
        'disabled': '❌'}
    text = f'''\
┌─{statuses[status]} <b>Status:</b> <code>{status.title()}</code>
│          └─<b>Username:</b> <code>{username}</code>
│
├─🌐 <b>Data limit:</b> <code>{readable_size(data_limit) if data_limit else 'Unlimited'}</code>
│          └─<b>Data Used:</b> <code>{readable_size(usage) if usage else "-"}</code>
│
└─📅 <b>Expiry Date:</b> <code>{datetime.fromtimestamp(expire).date() if expire else 'Never'}</code>
             └─<b>Days left:</b> <code>{(datetime.fromtimestamp(expire or 0) - datetime.now()).days if expire else '-'}</code>'''
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
├ Expire Date: <b>{(datetime.now() + relativedelta(seconds=expire_duration)).strftime('%Y-%m-%d') if expire_duration else 'Never'}</b>
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
        db_user = crud.get_user(db, username)
        if not db_user:
            return bot.answer_callback_query(
                call.id,
                '❌ User not found.',
                show_alert=True
            )
        user = UserResponse.from_orm(db_user)

    text = get_user_info_text(
        status=user.status, username=username,
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
        db_user = crud.get_user(db, username)
        if not db_user:
            return bot.answer_callback_query(call.id, "User not found!", show_alert=True)

        user = UserResponse.from_orm(db_user)

    text = f"<i>{SUBSCRIPTION_URL}{user.subscription_url}</i>\n\n\n"
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
        db_user = crud.get_user(db, username)
        if not db_user:
            return bot.answer_callback_query(call.id, "User not found!", show_alert=True)

        user = UserResponse.from_orm(db_user)

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
    with io.BytesIO() as f:
        qr = qrcode.QRCode(border=6)
        qr.add_data(f"{SUBSCRIPTION_URL}{user.subscription_url}")
        qr.make_image().save(f)
        f.seek(0)
        bot.send_photo(
            call.message.chat.id,
            photo=f,
            caption=f"<i>{SUBSCRIPTION_URL}{user.subscription_url}</i>",
            parse_mode="HTML"
        )
    try:
        bot.delete_message(call.message.chat.id, call.message.message_id)
    except:
        pass

    text = f"<i>{SUBSCRIPTION_URL}{user.subscription_url}</i>\n\n\n"
    for link in user.links:
        text += f"<code>{link}</code>\n\n"

    bot.send_message(
        call.message.chat.id,
        text,
        "HTML",
        reply_markup=BotKeyboard.show_links(username)
    )


@bot.callback_query_handler(cb_query_startswith('template_charge:'), is_admin=True)
def template_charge_command(call: types.CallbackQuery):
    _, template_id, username = call.data.split(":")
    now = datetime.now()
    today = datetime(
        year=now.year,
        month=now.month,
        day=now.day,
        hour=23,
        minute=59,
        second=59
    )
    with GetDB() as db:
        template = crud.get_user_template(db, template_id)
        if not template:
            return bot.answer_callback_query(call.id, "Template not found!", show_alert=True)
        template = UserTemplateResponse.from_orm(template)

        db_user = crud.get_user(db, username)
        if not db_user:
            return bot.answer_callback_query(call.id, "User not found!", show_alert=True)
        user = UserResponse.from_orm(db_user)
        if (user.used_traffic > user.data_limit) or (now > datetime.fromtimestamp(user.expire)):
            crud.reset_user_data_usage(db, db_user)
            expire_date = None
            if template.expire_duration:
                expire_date = today + relativedelta(seconds=template.expire_duration)
            modify = UserModify(
                status='active',
                expire=int(expire_date.timestamp()) if expire_date else 0,
                data_limit=template.data_limit,
            )
            db_user = crud.update_user(db, db_user, modify)

            text = get_user_info_text(
                status='active',
                username=username,
                expire=int(expire_date.timestamp()),
                data_limit=template.data_limit,
                usage=0)
            bot.edit_message_text(
                f'♻️ User Successfully Charged!\n\n{text}',
                call.message.chat.id,
                call.message.message_id,
                parse_mode='html',
                reply_markup=BotKeyboard.user_menu(user_info={
                    'status': 'active',
                    'username': user.username}))
            if TELEGRAM_LOGGER_CHANNEL_ID:
                text = f'''\
♻️ <b>#Charged #Reset #From_Bot</b>
➖➖➖➖➖➖➖➖➖
<b>Template :</b> <code>{template.name}</code>
<b>Username :</b> <code>{user.username}</code>
➖➖➖➖➖➖➖➖➖
<u><b>Last status</b></u>
<b>├Traffic Limit :</b> <code>{readable_size(user.data_limit)}</code>
<b>├Expire Date :</b> <code>{datetime.fromtimestamp(user.expire).strftime('%H:%M:%S %Y-%m-%d')}</code>
➖➖➖➖➖➖➖➖➖
<u><b>New status</b></u>
<b>├Traffic Limit :</b> <code>{readable_size(db_user.data_limit)}</code>
<b>├Expire Date :</b> <code>{datetime.fromtimestamp(db_user.expire).strftime('%H:%M:%S %Y-%m-%d')}</code>
➖➖➖➖➖➖➖➖➖
<b>By :</b> <a href="tg://user?id={call.from_user.id}">{call.from_user.full_name}</a>'''
                try:
                    bot.send_message(TELEGRAM_LOGGER_CHANNEL_ID, text, 'HTML')
                except:
                    pass
        else:
            text = get_user_info_text(
                status='active',
                username=username,
                expire=int(((datetime.fromtimestamp(user.expire) if user.expire else today) +
                            relativedelta(seconds=template.expire_duration)).timestamp()),
                data_limit=(
                            user.data_limit - user.used_traffic + template.data_limit) if user.data_limit else template.data_limit,
                usage=0)
            bot.edit_message_text(
                f'‼️ <b>If add template <u>Bandwidth</u> and <u>Time</u> to the user, the user will be this</b>:\n\n\
    {text}\n\n\
    <b>Add template <u>Bandwidth</u> and <u>Time</u> to user or Reset to <u>Template default</u></b>⁉️',
                call.message.chat.id,
                call.message.message_id,
                parse_mode='html',
                reply_markup=BotKeyboard.charge_add_or_reset(username=username, template_id=template_id))


@bot.callback_query_handler(cb_query_startswith('charge:'), is_admin=True)
def charge_command(call: types.CallbackQuery):
    username = call.data.split(":")[1]
    with GetDB() as db:
        templates = crud.get_user_templates(db)
        if not templates:
            return bot.answer_callback_query(call.id, "You don't have any User Templates!")

        db_user = crud.get_user(db, username)
        if not db_user:
            return bot.answer_callback_query(call.id, "User not found!", show_alert=True)

    bot.edit_message_text(
        f"{call.message.html_text}\n\n🔢 Select <b>User Template</b> to charge:",
        call.message.chat.id,
        call.message.message_id,
        parse_mode='html',
        reply_markup=BotKeyboard.templates_menu(
            {template.name: template.id for template in templates},
            username=username,
        )
    )


@bot.callback_query_handler(cb_query_equals('template_add_user'), is_admin=True)
def add_user_from_template_command(call: types.CallbackQuery):
    with GetDB() as db:
        templates = crud.get_user_templates(db)
        if not templates:
            return bot.answer_callback_query(call.id, "You don't have any User Templates!")

    bot.edit_message_text(
        "<b>Select a Template to create user from</b>:",
        call.message.chat.id,
        call.message.message_id,
        parse_mode='html',
        reply_markup=BotKeyboard.templates_menu({template.name: template.id for template in templates})
    )


@bot.callback_query_handler(cb_query_startswith('template_add_user:'), is_admin=True)
def add_user_command(call: types.CallbackQuery):
    template_id = int(call.data.split(":")[1])
    with GetDB() as db:
        template = crud.get_user_template(db, template_id)
        if not template:
            return bot.answer_callback_query(call.id, "Template not found!", show_alert=True)
        template = UserTemplateResponse.from_orm(template)

    text = get_template_info_text(
        template_id, data_limit=template.data_limit, expire_duration=template.expire_duration,
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
        parse_mode="HTML"
    )
    text = '👤 Enter username:\n⚠️ Username only can be 3 to 32 characters and contain a-z, A-Z, 0-9, and underscores in between.'
    msg = bot.send_message(
        call.message.chat.id,
        text,
        parse_mode="HTML",
        reply_markup=BotKeyboard.cancel_action()
    )
    schedule_delete_message(template_msg.message_id, msg.id)
    bot.register_next_step_handler(template_msg, add_user_from_template_username_step)


def add_user_from_template_username_step(message: types.Message):
    template_id = mem_store.get("template_id")
    if template_id is None:
        return bot.send_message(message.chat.id, "An error occured in the process! try again.")

    if not message.text:
        wait_msg = bot.send_message(
            message.chat.id,
            '❌ Username can not be empty.',
            reply_markup=BotKeyboard.cancel_action()
        )
        schedule_delete_message(wait_msg.message_id, message.message_id)
        return bot.register_next_step_handler(wait_msg, add_user_from_template_username_step)

    elif message.text == 'Cancel':
        return bot.send_message(
            message.chat.id,
            '✅ Cancelled.',
            reply_markup=BotKeyboard.main_menu()
        )
    with GetDB() as db:
        username = message.text
        if message.text == '🔡 Random Username':
            username = random.choice(string.ascii_lowercase) + \
                       ''.join(random.choices(string.ascii_lowercase, k=6)) + \
                       random.choice(string.ascii_lowercase)
        match = re.match(r'^(?![_\d])(?!.*__)(?!.*_$)\w{2,31}[a-z\d]$', username)
        if not match:
            wait_msg = bot.send_message(
                message.chat.id,
                '❌ Username only can be 3 to 32 characters and contain a-z, A-Z, 0-9, and underscores in between.',
                reply_markup=BotKeyboard.cancel_action()
            )
            schedule_delete_message(wait_msg.message_id, message.message_id)
            return bot.register_next_step_handler(wait_msg, add_user_from_template_username_step)

        template = crud.get_user_template(db, template_id)

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
    now = datetime.now()
    today = datetime(
        year=now.year,
        month=now.month,
        day=now.day,
        hour=23,
        minute=59,
        second=59
    )
    expire_date = None
    if template.expire_duration:
        expire_date = today + relativedelta(seconds=template.expire_duration)
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
    schedule_delete_message(message.id)
    cleanup_messages(message.chat.id)


@bot.callback_query_handler(cb_query_equals('add_user'), is_admin=True)
def add_user_command(call: types.CallbackQuery):
    try:
        bot.delete_message(call.message.chat.id, call.message.message_id)
    except:  # noqa
        pass
    username_msg = bot.send_message(
        call.message.chat.id,
        '👤 Enter username:\n⚠️Username only can be 3 to 32 characters and contain a-z, A-Z 0-9, and underscores in '
        'between.',
        reply_markup=BotKeyboard.cancel_action()
    )
    bot.register_next_step_handler(username_msg, add_user_username_step)


def add_user_username_step(message: types.Message):
    username = message.text
    if username == 'Cancel':
        return bot.send_message(
            message.chat.id,
            '✅ Cancelled.',
            reply_markup=BotKeyboard.main_menu()
        )
    if not username:
        wait_msg = bot.send_message(
            message.chat.id,
            '❌ Username can not be empty.',
            reply_markup=BotKeyboard.cancel_action()
        )
        return bot.register_next_step_handler(wait_msg, add_user_username_step)
    if username == '🔡 Random Username':
        username = random.choice(string.ascii_lowercase) + \
                   ''.join(random.choices(string.ascii_lowercase, k=6)) + \
                   random.choice(string.ascii_lowercase)
    if not re.match(r'^(?![_\d])(?!.*__)(?!.*_$)\w{2,31}[a-z\d]$', username):
        wait_msg = bot.send_message(
            message.chat.id,
            '❌ Username only can be 3 to 32 characters and contain a-z, A-Z 0-9, and underscores in between.',
            reply_markup=BotKeyboard.cancel_action()
        )
        return bot.register_next_step_handler(wait_msg, add_user_username_step)
    with GetDB() as db:
        if crud.get_user(db, username):
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
        message, add_user_data_limit_step, username=username)


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
        '⬆️ Enter Expire Date (YYYY-MM-DD)\nOr You Can Use Regex Symbol: ^[0-9]{1,3}(M|D) :\n⚠️ Send 0 for never expire.',
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
        now = datetime.now()
        today = datetime(
            year=now.year,
            month=now.month,
            day=now.day,
            hour=23,
            minute=59,
            second=59
        )
        if re.match(r'^[0-9]{1,3}(M|m|D|d)$', message.text):
            expire_date = today
            number_pattern = r'^[0-9]{1,3}'
            number = int(re.findall(number_pattern, message.text)[0])
            symbol_pattern = r'(M|m|D|d)$'
            symbol = re.findall(symbol_pattern, message.text)[0].upper()
            if symbol == 'M':
                expire_date = today + relativedelta(months=number)
            elif symbol == 'D':
                expire_date = today + relativedelta(days=number)
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
            '❌ Expire date must be in YYYY-MM-DD format.\nOr You Can Use Regex Symbol: ^[0-9]{1,3}(M|D)',
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
    chat_id = call.from_user.id
    full_name = call.from_user.full_name

    if data == 'delete':
        username = call.data.split(':')[2]
        with GetDB() as db:
            db_user = crud.get_user(db, username)
            crud.remove_user(db, db_user)
            xray.operations.remove_user(db_user)

        bot.edit_message_text(
            '✅ User deleted.',
            call.message.chat.id,
            call.message.message_id,
            reply_markup=BotKeyboard.main_menu()
        )
        if TELEGRAM_LOGGER_CHANNEL_ID:
            text = f'''\
🗑 <b>#Deleted #From_Bot</b>
➖➖➖➖➖➖➖➖➖
<b>Username</b> : <code>{username}</code>
➖➖➖➖➖➖➖➖➖
<b>By :</b> <a href="tg://user?id={chat_id}">{full_name}</a>'''
            try:
                bot.send_message(TELEGRAM_LOGGER_CHANNEL_ID, text, 'HTML')
            except:
                pass
    elif data == "suspend":
        username = call.data.split(":")[2]
        with GetDB() as db:
            db_user = crud.get_user(db, username)
            crud.update_user(db, db_user, UserModify(
                status=UserStatusModify.disabled))
            xray.operations.remove_user(db_user)
        bot.edit_message_text(
            get_user_info_text(
                status='disabled',
                username=username,
                data_limit=db_user.data_limit,
                usage=db_user.used_traffic,
                expire=db_user.expire
            ),
            call.message.chat.id,
            call.message.message_id,
            parse_mode='HTML',
            reply_markup=BotKeyboard.user_menu(user_info={
                'status': 'disabled',
                'username': db_user.username
            }))
        if TELEGRAM_LOGGER_CHANNEL_ID:
            text = f'''\
❌ <b>#Disabled  #From_Bot</b>
➖➖➖➖➖➖➖➖➖
<b>Username</b> : <code>{username}</code>
➖➖➖➖➖➖➖➖➖
<b>By :</b> <a href="tg://user?id={chat_id}">{full_name}</a>'''
            try:
                bot.send_message(TELEGRAM_LOGGER_CHANNEL_ID, text, 'HTML')
            except:
                pass
    elif data == "activate":
        username = call.data.split(":")[2]
        with GetDB() as db:
            db_user = crud.get_user(db, username)
            crud.update_user(db, db_user, UserModify(
                status=UserStatusModify.active))
            xray.operations.add_user(db_user)

        bot.edit_message_text(
            get_user_info_text(
                status='active',
                username=username,
                data_limit=db_user.data_limit,
                usage=db_user.used_traffic,
                expire=db_user.expire
            ),
            call.message.chat.id,
            call.message.message_id,
            parse_mode='HTML',
            reply_markup=BotKeyboard.user_menu(user_info={
                'status': 'active',
                'username': db_user.username
            }))
        if TELEGRAM_LOGGER_CHANNEL_ID:
            text = f'''\
✅ <b>#Activated  #From_Bot</b>
➖➖➖➖➖➖➖➖➖
<b>Username</b> : <code>{username}</code>
➖➖➖➖➖➖➖➖➖
<b>By :</b> <a href="tg://user?id={chat_id}">{full_name}</a>'''
            try:
                bot.send_message(TELEGRAM_LOGGER_CHANNEL_ID, text, 'HTML')
            except:
                pass
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

    elif data in ['charge_add', 'charge_reset']:
        _, _, username, template_id = call.data.split(":")
        now = datetime.now()
        today = datetime(
            year=now.year,
            month=now.month,
            day=now.day,
            hour=23,
            minute=59,
            second=59
        )
        with GetDB() as db:
            template = crud.get_user_template(db, template_id)
            if not template:
                return bot.answer_callback_query(call.id, "Template not found!", show_alert=True)
            template = UserTemplateResponse.from_orm(template)

            db_user = crud.get_user(db, username)
            if not db_user:
                return bot.answer_callback_query(call.id, "User not found!", show_alert=True)
            user = UserResponse.from_orm(db_user)

            inbounds = template.inbounds
            proxies = {p.type.value: p.settings for p in db_user.proxies}

            for protocol in xray.config.inbounds_by_protocol:
                if protocol in inbounds and protocol not in db_user.inbounds:
                    proxies.update({protocol: {}})
                elif protocol in db_user.inbounds and protocol not in inbounds:
                    del proxies[protocol]

            crud.reset_user_data_usage(db, db_user)
            if data == 'charge_reset':
                expire_date = None
                if template.expire_duration:
                    expire_date = today + relativedelta(seconds=template.expire_duration)
                modify = UserModify(
                    status='active',
                    expire=int(expire_date.timestamp()) if expire_date else 0,
                    data_limit=template.data_limit,
                )
                db_user = crud.update_user(db, db_user, modify)
            else:
                expire_date = None
                if template.expire_duration:
                    expire_date = datetime.fromtimestamp(user.expire) + relativedelta(seconds=template.expire_duration)
                modify = UserModify(
                    status='active',
                    expire=int(expire_date.timestamp()) if expire_date else 0,
                    data_limit=user.data_limit - user.used_traffic + template.data_limit,
                )
                db_user = crud.update_user(db, db_user, modify)

            text = get_user_info_text(
                status=db_user.status,
                username=username,
                expire=db_user.expire,
                data_limit=db_user.data_limit,
                usage=db_user.used_traffic)

            bot.edit_message_text(
                f'♻️ User Successfully Charged!\n\n{text}',
                call.message.chat.id,
                call.message.message_id,
                parse_mode='html',
                reply_markup=BotKeyboard.user_menu(user_info={
                    'status': user.status,
                    'username': user.username
                }))
            if TELEGRAM_LOGGER_CHANNEL_ID:
                text = f'''\
♻️ <b>#Charged #{data.split('_')[1].title()} #From_Bot</b>
➖➖➖➖➖➖➖➖➖
<b>Template :</b> <code>{template.name}</code>
<b>Username :</b> <code>{user.username}</code>
➖➖➖➖➖➖➖➖➖
<u><b>Last status</b></u>
<b>├Traffic Limit :</b> <code>{readable_size(user.data_limit)}</code>
<b>├Expire Date :</b> <code>{datetime.fromtimestamp(user.expire).strftime('%H:%M:%S %Y-%m-%d')}</code>
➖➖➖➖➖➖➖➖➖
<u><b>New status</b></u>
<b>├Traffic Limit :</b> <code>{readable_size(db_user.data_limit)}</code>
<b>├Expire Date :</b> <code>{datetime.fromtimestamp(db_user.expire).strftime('%H:%M:%S %Y-%m-%d')}</code>
➖➖➖➖➖➖➖➖➖
<b>By :</b> <a href="tg://user?id={chat_id}">{full_name}</a>\
'''
                try:
                    bot.send_message(TELEGRAM_LOGGER_CHANNEL_ID, text, 'HTML')
                except:
                    pass


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
                expire=int(mem_store.get('expire_date').timestamp()) if mem_store.get('expire_date') else 0,
                data_limit=mem_store.get("data_limit"),
                proxies=proxies,
                inbounds=inbounds
            )
            last_user = UserResponse.from_orm(db_user)
            db_user = crud.update_user(db, db_user, modify)

            user = UserResponse.from_orm(db_user)

        if user.status == UserStatus.active:
            xray.operations.update_user(db_user)
        else:
            xray.operations.remove_user(db_user)

        bot.answer_callback_query(call.id, "✅ User updated successfully.")
        text = get_user_info_text(
            status=user.status,
            username=user.username,
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
                'status': db_user.status})
        )
        if TELEGRAM_LOGGER_CHANNEL_ID:
            tag = f'\n➖➖➖➖➖➖➖➖➖ \n<b>By :</b> <a href="tg://user?id={chat_id}">{full_name}</a>'
            if last_user.data_limit != user.data_limit:
                text = f'''\
📶 <b>#Traffic_Change #From_Bot</b>
➖➖➖➖➖➖➖➖➖
<b>Username :</b> <code>{user.username}</code>
<b>Last Traffic Limit :</b> <code>{readable_size(last_user.data_limit)}</code>
<b>New Traffic Limit :</b> <code>{readable_size(user.data_limit)}</code>{tag}'''
                try:
                    bot.send_message(TELEGRAM_LOGGER_CHANNEL_ID, text, 'HTML')
                except:
                    pass
            if last_user.expire != user.expire:
                text = f'''\
📅 <b>#Expiry_Change #From_Bot</b>
➖➖➖➖➖➖➖➖➖
<b>Username :</b> <code>{user.username}</code>
<b>Last Expire Date :</b> <code>{datetime.fromtimestamp(last_user.expire).strftime('%H:%M:%S %Y-%m-%d')}</code>
<b>New Expire Date :</b> <code>{datetime.fromtimestamp(user.expire).strftime('%H:%M:%S %Y-%m-%d')}</code>{tag}'''
                try:
                    bot.send_message(TELEGRAM_LOGGER_CHANNEL_ID, text, 'HTML')
                except:
                    pass
            if list(last_user.inbounds.values())[0] != list(user.inbounds.values())[0]:
                text = f'''\
⚙️ <b>#Inbounds_Change #From_Bot</b>
➖➖➖➖➖➖➖➖➖
<b>Username :</b> <code>{user.username}</code>
<b>Last Proxies :</b> <code>{", ".join(list(last_user.inbounds.values())[0])}</code>
<b>New Proxies :</b> <code>{", ".join(list(user.inbounds.values())[0])}</code>{tag}'''
                try:
                    bot.send_message(TELEGRAM_LOGGER_CHANNEL_ID, text, 'HTML')
                except:
                    pass

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
            expire=int(mem_store.get('expire_date').timestamp()) if mem_store.get('expire_date') else None,
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

        text = f"<i>{SUBSCRIPTION_URL}{user.subscription_url}</i>\n\n\n"
        for link in user.links:
            text += f"<code>{link}</code>\n\n"

        bot.edit_message_text(
            text,
            call.message.chat.id,
            call.message.message_id,
            parse_mode="HTML",
            reply_markup=BotKeyboard.show_links(user.username))

        if TELEGRAM_LOGGER_CHANNEL_ID:
            text = f'''\
🆕 <b>#Created #From_Bot</b>
➖➖➖➖➖➖➖➖➖
<b>Username :</b> <code>{user.username}</code>
<b>Traffic Limit :</b> <code>{readable_size(user.data_limit)}</code>
<b>Expire Date :</b> <code>{datetime.fromtimestamp(user.expire).strftime('%H:%M:%S %Y-%m-%d')}</code>
<b>Proxies :</b> <code>{"" if not proxies else ", ".join([proxy.type for proxy in proxies])}</code>
➖➖➖➖➖➖➖➖➖
<b>By :</b> <a href="tg://user?id={chat_id}">{full_name}</a>'''
            try:
                bot.send_message(TELEGRAM_LOGGER_CHANNEL_ID, text, 'HTML')
            except:
                pass


@bot.message_handler(func=lambda message: True, is_admin=True)
def search(message: types.Message):
    with GetDB() as db:
        db_user = crud.get_user(db, message.text)
        if not db_user:
            return bot.reply_to(message, '❌ User not found.')
        user = UserResponse.from_orm(db_user)
    text = get_user_info_text(
        status=user.status,
        username=user.username,
        expire=user.expire,
        data_limit=user.data_limit,
        usage=user.used_traffic)
    return bot.reply_to(message, text, parse_mode="html", reply_markup=BotKeyboard.user_menu(user_info={
        'status': user.status,
        'username': user.username
    }))
