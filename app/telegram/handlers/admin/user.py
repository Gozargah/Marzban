from datetime import datetime
import re
from aiogram import F
from aiogram.types import CallbackQuery, Message, InlineQuery, InlineQueryResultArticle, InputTextMessageContent
from aiogram.fsm.context import FSMContext
from aiogram.types.reply_keyboard_remove import ReplyKeyboardRemove
from dateutil.relativedelta import relativedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import GetDB
from app.models.user import UserCreate, UserModify, UserStatusModify
from app.operation import OperatorType
from app.operation.user import UserOperation
from app.operation.group import GroupOperation
from app.telegram.keyboards.group import DoneAction, GroupsSelector
from app.telegram.utils.forms import CreateUser
from app.models.admin import AdminDetails
from app.telegram.keyboards.admin import AdminPanel, AdminPanelAction, InlineQuerySearch
from app.telegram.keyboards.base import CancelKeyboard
from app.telegram.utils.filters import IsAdminFilter
from . import router
from app.telegram.utils.texts import Message as Texts
from app.telegram.keyboards.user import UserPanel, UserPanelAction

user_operations = UserOperation(OperatorType.TELEGRAM)
group_operations = GroupOperation(OperatorType.TELEGRAM)

USERNAME_PATTERN = re.compile(r"^(?=\w{3,128}\b)[a-zA-Z0-9-_@.]+(?:_[a-zA-Z0-9-_@.]+)*$")


@router.callback_query(
    AdminPanel.Callback.filter(F.action == AdminPanelAction.create_user),
    IsAdminFilter(),
)
async def create_user(query: CallbackQuery, state: FSMContext):
    await state.set_state(CreateUser.username)
    await query.message.reply(
        "please enter the username",
        reply_markup=CancelKeyboard().as_markup(),
    )


@router.message(CreateUser.username)
async def process_username(message: Message, state: FSMContext, admin: AdminDetails):
    username = message.text
    if not USERNAME_PATTERN.match(username):
        return await message.reply(
            "❌ Username only can be 3 to 128 characters and contain a-z, A-Z, 0-9, and underscores in between.",
            reply_markup=CancelKeyboard().as_markup(),
        )
    async with GetDB() as db:
        try:
            await user_operations.get_validated_user(db, username, admin)
            await message.reply(
                "❌ user already exists.",
                reply_markup=CancelKeyboard().as_markup(),
            )
        except ValueError:
            await state.update_data(username=username)
            await state.set_state(CreateUser.data_limit)
            await message.reply(
                "⬆ Enter Data Limit (GB):\n⚠️ Send 0 for unlimited.",
                reply_markup=CancelKeyboard().as_markup(),
            )


@router.message(CreateUser.data_limit)
async def process_data_limit(message: Message, state: FSMContext):
    try:
        data_limit = float(message.text)
        if data_limit < 0:
            return await message.reply(
                "❌ Data limit must be greater or equal to 0.",
                reply_markup=CancelKeyboard().as_markup(),
            )
    except ValueError:
        return await message.reply(
            "❌ Data limit must be a number.",
            reply_markup=CancelKeyboard().as_markup(),
        )
    await state.update_data(data_limit=data_limit)
    await state.set_state(CreateUser.expire)
    await message.reply(
        "⬆ Enter Expire Date (YYYY-MM-DD)\nOr You Can Use Regex Symbol: ^[0-9]{1,3}(M|D) :\n⚠  Send 0 for never expire.",
        reply_markup=CancelKeyboard().as_markup(),
    )


@router.message(CreateUser.expire)
async def process_expire(message: Message, state: FSMContext):
    try:
        now = datetime.now()
        today = datetime(year=now.year, month=now.month, day=now.day, hour=23, minute=59, second=59)
        if re.match(r"^[0-9]{1,3}([MmDd])$", message.text):
            number_pattern = r"^[0-9]{1,3}"
            number = int(re.findall(number_pattern, message.text)[0])
            symbol_pattern = r"([MmDd])$"
            symbol = re.findall(symbol_pattern, message.text)[0].upper()

            if symbol == "M":
                expire_date = today + relativedelta(months=number)
            else:
                expire_date = today + relativedelta(days=number)
        elif message.text == "0":
            expire_date = datetime.strptime(message.text, "%Y-%m-%d")
            if expire_date < today:
                raise ValueError("Expire date must be greater than today.")
        else:
            raise ValueError("Invalid input for onhold status.")
    except ValueError as err:
        error_message = (
            str(err) if str(err) != "Invalid input for onhold status." else "Invalid input. Please try again."
        )
        await state.set_state(CreateUser.expire)
        return await message.reply(f"❌ {error_message}")
    await state.update_data(expire=expire_date)
    await state.set_state(CreateUser.group_ids)
    async with GetDB() as db:
        groups = await group_operations.get_all_groups(db)
    await message.reply(
        "Select Groups:",
        reply_markup=GroupsSelector(groups).as_markup(),
    )


@router.callback_query(GroupsSelector.SelectorCallback.filter(), CreateUser.group_ids)
async def process_groups(query: CallbackQuery, state: FSMContext, callback_data: GroupsSelector.SelectorCallback):
    group_ids = await state.get_value("group_ids")
    if isinstance(group_ids, list):
        if callback_data.group_id in group_ids:
            group_ids.remove(callback_data.group_id)
        else:
            group_ids.append(callback_data.group_id)
    else:
        group_ids = [callback_data.group_id]

    await state.update_data(group_ids=group_ids)

    async with GetDB() as db:
        all_groups = await group_operations.get_all_groups(db)

    await query.message.edit_reply_markup(
        reply_markup=GroupsSelector(groups=all_groups, selected_groups=group_ids).as_markup()
    )


@router.callback_query(GroupsSelector.DoneCallback.filter(F.action == DoneAction.done))
async def process_done(
    query: CallbackQuery, admin: AdminDetails, state: FSMContext, callback_data: GroupsSelector.DoneCallback
):
    data = await state.get_data()
    if not data.get("group_ids", []):
        return await query.answer("you have to select at least one groups", True)

    await state.clear()
    new_user = UserCreate(**data)
    async with GetDB() as db:
        try:
            await user_operations.create_user(db, new_user, admin)
            await query.message.answer("user created successfully")
        except Exception:
            pass


@router.callback_query(GroupsSelector.DoneCallback.filter(F.action == DoneAction.cancel))
async def process_cancel(query: CallbackQuery, state: FSMContext):
    await state.clear()
    await query.message.answer("operation canceled", reply_markup=ReplyKeyboardRemove())


@router.callback_query(UserPanel.Callback.filter(UserPanelAction.disable == F.action))
async def disable_user(event: CallbackQuery, admin: AdminDetails, db: AsyncSession, callback_data: UserPanel.Callback):
    user = await user_operations.get_user(db, callback_data.username, admin)
    modified_user = UserModify(**user.model_dump())
    modified_user.status = UserStatusModify.disabled
    user = await user_operations.modify_user(db, callback_data.username, modified_user, admin)
    await event.answer(f"User {callback_data.username} has been disabled.")
    await event.message.edit_text(Texts.user_details(user), reply_markup=UserPanel(user).as_markup())


@router.callback_query(UserPanel.Callback.filter(UserPanelAction.enable == F.action))
async def enable_user(event: CallbackQuery, admin: AdminDetails, db: AsyncSession, callback_data: UserPanel.Callback):
    user = await user_operations.get_user(db, callback_data.username, admin)
    modified_user = UserModify(**user.model_dump())
    modified_user.status = UserStatusModify.active
    user = await user_operations.modify_user(db, callback_data.username, modified_user, admin)
    await event.answer(f"User {callback_data.username} has been enabled.")
    await event.message.edit_text(Texts.user_details(user), reply_markup=UserPanel(user).as_markup())


@router.callback_query(UserPanel.Callback.filter(UserPanelAction.revoke_sub == F.action))
async def revoke_sub(event: CallbackQuery, admin: AdminDetails, db: AsyncSession, callback_data: UserPanel.Callback):
    user = await user_operations.revoke_user_sub(db, callback_data.username, admin)
    await event.answer(f"User {callback_data.username} Subscription has been revoked.")
    await event.message.edit_text(Texts.user_details(user), reply_markup=UserPanel(user).as_markup())


@router.callback_query(UserPanel.Callback.filter(UserPanelAction.reset_usage == F.action))
async def reset_usage(event: CallbackQuery, admin: AdminDetails, db: AsyncSession, callback_data: UserPanel.Callback):
    user = await user_operations.reset_user_data_usage(db, callback_data.username, admin)
    await event.answer(f"User {callback_data.username} Usage has been reset.")
    await event.message.edit_text(Texts.user_details(user), reply_markup=UserPanel(user).as_markup())


@router.callback_query(UserPanel.Callback.filter(UserPanelAction.activate_next_plan == F.action))
async def activate_next_plan(
    event: CallbackQuery, admin: AdminDetails, db: AsyncSession, callback_data: UserPanel.Callback
):
    user = await user_operations.active_next_plan(db, callback_data.username, admin)
    await event.answer(f"User {callback_data.username} Next plan has been activated.")
    await event.message.edit_text(Texts.user_details(user), reply_markup=UserPanel(user).as_markup())


@router.message()
@router.callback_query(UserPanel.Callback.filter(UserPanelAction.show == F.action))
async def get_user(event: Message | CallbackQuery, admin: AdminDetails, db: AsyncSession, **kwargs):
    """get exact user, otherwise not found"""
    username = event.text if isinstance(event, Message) else kwargs["callback_data"].username
    try:
        user = await user_operations.get_user(db, username, admin)
    except ValueError:
        return await event.reply(Texts.user_not_found, reply_markup=InlineQuerySearch(username).as_markup())

    if isinstance(event, Message):
        await event.reply(Texts.user_details(user), reply_markup=UserPanel(user).as_markup())
    else:
        await event.message.edit_text(Texts.user_details(user), reply_markup=UserPanel(user).as_markup())


@router.inline_query()
async def search_user(event: InlineQuery, admin: AdminDetails, db: AsyncSession):
    result = []
    if event.query.strip():
        search = await user_operations.get_users(db, admin, search=event.query.strip(), limit=50)
        result = [
            InlineQueryResultArticle(
                id=str(user.id),
                title=f"{Texts.status_emoji(user.status)}{user.username}",
                description=Texts.user_short_detail(user),
                url=user.subscription_url if user.subscription_url.startswith("https://") else None,
                input_message_content=InputTextMessageContent(message_text=user.username),
            )
            for user in search.users
        ]
        if not result:
            result = [
                InlineQueryResultArticle(
                    id="1",
                    title=Texts.user_not_found,
                    input_message_content=InputTextMessageContent(message_text="/start"),
                )
            ]
    await event.answer(result, cache_time=5)


@router.callback_query()
async def debug(event: CallbackQuery):
    await event.answer(event.data, show_alert=True)
