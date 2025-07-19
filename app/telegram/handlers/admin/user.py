from datetime import datetime as dt, timedelta as td

from aiogram import Router, F
from aiogram.types import CallbackQuery, Message, InlineQuery, InlineQueryResultArticle, InputTextMessageContent
from aiogram.fsm.context import FSMContext
from aiogram.types.reply_keyboard_remove import ReplyKeyboardRemove
from sqlalchemy.ext.asyncio import AsyncSession
from aiogram.exceptions import TelegramBadRequest

from app.db.models import UserStatus
from app.models.user import UserCreate, UserModify, UserStatusModify, CreateUserFromTemplate, ModifyUserByTemplate
from app.models.validators import UserValidator
from app.operation import OperatorType
from app.operation.user import UserOperation
from app.operation.group import GroupOperation
from app.operation.user_template import UserTemplateOperation
from app.telegram.keyboards.group import DoneAction, GroupsSelector
from app.telegram.utils import forms
from app.models.admin import AdminDetails
from app.telegram.keyboards.admin import AdminPanel, AdminPanelAction, InlineQuerySearch
from app.telegram.keyboards.base import CancelKeyboard
from app.telegram.utils.texts import Message as Texts
from app.telegram.keyboards.user import UserPanel, UserPanelAction, ChooseStatus, ChooseTemplate
from app.telegram.utils.shared import add_to_messages_to_delete, delete_messages

user_operations = UserOperation(OperatorType.TELEGRAM)
group_operations = GroupOperation(OperatorType.TELEGRAM)
user_templates = UserTemplateOperation(OperatorType.TELEGRAM)

router = Router(name="user")


@router.callback_query(AdminPanel.Callback.filter(AdminPanelAction.create_user == F.action),)
async def create_user(event: CallbackQuery, state: FSMContext):
    try:
        await event.message.delete()
    except TelegramBadRequest:
        pass
    await state.set_state(forms.CreateUser.username)
    msg = await event.message.answer(Texts.enter_username, reply_markup=CancelKeyboard().as_markup())
    await state.update_data(messages_to_delete=[msg.message_id])


@router.message(forms.CreateUser.username)
async def process_username(event: Message, state: FSMContext, db: AsyncSession, admin: AdminDetails):
    await delete_messages(event, state)
    await add_to_messages_to_delete(state, event)

    username = event.text
    try:
        UserValidator.validate_username(username)
    except ValueError as e:
        msg = await event.reply(f"❌ {e}", reply_markup=CancelKeyboard().as_markup())
        await add_to_messages_to_delete(state, msg)
        return

    try:
        await user_operations.get_validated_user(db, username, admin)
        msg = await event.reply(Texts.username_already_exist, reply_markup=CancelKeyboard().as_markup())
        await add_to_messages_to_delete(state, msg)
        return
    except ValueError:
        pass

    await delete_messages(event, state)
    await state.update_data(username=username)
    await state.set_state(forms.CreateUser.data_limit)
    msg = await event.answer(Texts.enter_data_limit, reply_markup=CancelKeyboard().as_markup())
    await add_to_messages_to_delete(state, msg)


@router.message(forms.CreateUser.data_limit)
async def process_data_limit(event: Message, state: FSMContext):
    await delete_messages(event, state)
    await add_to_messages_to_delete(state, event)

    try:
        data_limit = float(event.text)
        if data_limit < 0:
            raise ValueError
        await state.update_data(data_limit=data_limit)

        await state.set_state(forms.CreateUser.expire)

        await add_to_messages_to_delete(state, event)
        await delete_messages(event, state)

        msg = await event.answer(Texts.enter_duration, reply_markup=CancelKeyboard().as_markup())
        await add_to_messages_to_delete(state, msg)
        return

    except ValueError:
        msg = await event.reply(Texts.data_limit_not_valid, reply_markup=CancelKeyboard().as_markup())
        await add_to_messages_to_delete(state, msg)
        return


@router.message(forms.CreateUser.expire)
async def process_expire(event: Message, state: FSMContext, db: AsyncSession):
    await delete_messages(event, state)
    await add_to_messages_to_delete(state, event)

    try:
        duration = int(event.text)
        if duration < 0:
            raise ValueError
    except ValueError:
        msg = await event.reply(text=Texts.duration_not_valid, reply_markup=CancelKeyboard().as_markup())
        await add_to_messages_to_delete(state, msg)
        return

    await state.update_data(duration=duration)
    await delete_messages(event, state)
    if duration:
        await state.set_state(forms.CreateUser.status)
        return await event.answer(Texts.choose_status, reply_markup=ChooseStatus().as_markup())
    else:
        await state.update_data(status=UserStatus.active.value)
        await state.set_state(forms.CreateUser.group_ids)
        groups = await group_operations.get_all_groups(db)
        return await event.answer(Texts.select_groups, reply_markup=GroupsSelector(groups).as_markup())


@router.callback_query(ChooseStatus.Callback.filter())
async def process_status(
    event: CallbackQuery, db: AsyncSession, state: FSMContext, callback_data: ChooseStatus.Callback
):
    await state.update_data(status=callback_data.status)

    await add_to_messages_to_delete(state, event.message)
    await delete_messages(event, state)

    if callback_data.status == UserStatus.on_hold.value:
        await state.set_state(forms.CreateUser.on_hold_timeout)
        msg = await event.message.answer(Texts.enter_on_hold_timeout, reply_markup=CancelKeyboard().as_markup())
        await add_to_messages_to_delete(state, msg)
    else:
        await state.set_state(forms.CreateUser.group_ids)
        groups = await group_operations.get_all_groups(db)
        await event.message.answer(Texts.select_groups, reply_markup=GroupsSelector(groups).as_markup())


@router.message(forms.CreateUser.on_hold_timeout)
async def process_on_hold_timeout(event: Message, state: FSMContext, db: AsyncSession):
    await delete_messages(event, state)
    await add_to_messages_to_delete(state, event)

    try:
        timeout = int(event.text)
        if timeout < 0:
            raise ValueError
    except ValueError:
        msg = await event.reply(text=Texts.duration_not_valid, reply_markup=CancelKeyboard().as_markup())
        await add_to_messages_to_delete(state, msg)
        return

    await state.update_data(on_hold_timeout=timeout)
    await state.set_state(forms.CreateUser.group_ids)
    groups = await group_operations.get_all_groups(db)

    await add_to_messages_to_delete(state, event)
    await delete_messages(event, state)

    await event.answer(Texts.select_groups, reply_markup=GroupsSelector(groups).as_markup())


@router.callback_query(GroupsSelector.SelectorCallback.filter(), forms.CreateUser.group_ids)
async def process_groups(
    event: CallbackQuery, db: AsyncSession, state: FSMContext, callback_data: GroupsSelector.SelectorCallback
):
    group_ids = await state.get_value("group_ids")
    if isinstance(group_ids, list):
        if callback_data.group_id in group_ids:
            group_ids.remove(callback_data.group_id)
        else:
            group_ids.append(callback_data.group_id)
    else:
        group_ids = [callback_data.group_id]

    await state.update_data(group_ids=group_ids)
    all_groups = await group_operations.get_all_groups(db)

    await event.message.edit_reply_markup(
        reply_markup=GroupsSelector(groups=all_groups, selected_groups=group_ids).as_markup()
    )


@router.callback_query(GroupsSelector.DoneCallback.filter(DoneAction.done == F.action))
async def process_done(event: CallbackQuery, db: AsyncSession, admin: AdminDetails, state: FSMContext):
    data = await state.get_data()
    if not data.get("group_ids", []):
        return await event.answer(Texts.select_a_group, show_alert=True)

    duration = data.get("duration")
    if data.get("status") == UserStatus.on_hold.value:
        data["status"] = UserStatus.on_hold
        data["on_hold_expire_duration"] = td(days=duration).total_seconds() if duration else 0
        timeout = data.get("on_hold_timeout")
        data["on_hold_timeout"] = (dt.now() + td(days=timeout)) if timeout else None
    else:
        data["status"] = UserStatus.active
        data["expire"] = (dt.now() + td(days=duration)) if duration else None

    data["data_limit"] *= 1024**3

    await delete_messages(event, state)
    await state.clear()

    del data["messages_to_delete"]
    del data["duration"]

    new_user = UserCreate(**data)
    user = await user_operations.create_user(db, new_user, admin)
    groups = await user_operations.validate_all_groups(db, user)
    await event.answer(Texts.user_created)
    return await event.message.edit_text(Texts.user_details(user, groups), reply_markup=UserPanel(user).as_markup())


@router.callback_query(GroupsSelector.DoneCallback.filter(DoneAction.cancel == F.action))
async def process_cancel(event: CallbackQuery, state: FSMContext):
    await delete_messages(event, state)
    await state.clear()
    await event.answer(Texts.canceled)
    await event.message.edit_text(Texts.canceled, reply_markup=ReplyKeyboardRemove())


@router.callback_query(UserPanel.Callback.filter(UserPanelAction.disable == F.action))
async def disable_user(event: CallbackQuery, admin: AdminDetails, db: AsyncSession, callback_data: UserPanel.Callback):
    user = await user_operations.get_user(db, callback_data.username, admin)
    modified_user = UserModify(**user.model_dump())
    modified_user.status = UserStatusModify.disabled
    user = await user_operations.modify_user(db, callback_data.username, modified_user, admin)
    await event.answer(f"User {callback_data.username} has been disabled.")
    groups = await user_operations.validate_all_groups(db, user)
    await event.message.edit_text(Texts.user_details(user, groups), reply_markup=UserPanel(user).as_markup())


@router.callback_query(UserPanel.Callback.filter(UserPanelAction.enable == F.action))
async def enable_user(event: CallbackQuery, admin: AdminDetails, db: AsyncSession, callback_data: UserPanel.Callback):
    user = await user_operations.get_user(db, callback_data.username, admin)
    modified_user = UserModify(**user.model_dump())
    modified_user.status = UserStatusModify.active
    user = await user_operations.modify_user(db, callback_data.username, modified_user, admin)
    await event.answer(f"User {callback_data.username} has been enabled.")
    groups = await user_operations.validate_all_groups(db, user)
    await event.message.edit_text(Texts.user_details(user, groups), reply_markup=UserPanel(user).as_markup())


@router.callback_query(UserPanel.Callback.filter(UserPanelAction.revoke_sub == F.action))
async def revoke_sub(event: CallbackQuery, admin: AdminDetails, db: AsyncSession, callback_data: UserPanel.Callback):
    user = await user_operations.revoke_user_sub(db, callback_data.username, admin)
    await event.answer(f"User {callback_data.username} Subscription has been revoked.")
    groups = await user_operations.validate_all_groups(db, user)
    await event.message.edit_text(Texts.user_details(user, groups), reply_markup=UserPanel(user).as_markup())


@router.callback_query(UserPanel.Callback.filter(UserPanelAction.reset_usage == F.action))
async def reset_usage(event: CallbackQuery, admin: AdminDetails, db: AsyncSession, callback_data: UserPanel.Callback):
    user = await user_operations.reset_user_data_usage(db, callback_data.username, admin)
    await event.answer(f"User {callback_data.username} Usage has been reset.")
    groups = await user_operations.validate_all_groups(db, user)
    await event.message.edit_text(Texts.user_details(user, groups), reply_markup=UserPanel(user).as_markup())


@router.callback_query(UserPanel.Callback.filter(UserPanelAction.activate_next_plan == F.action))
async def activate_next_plan(
    event: CallbackQuery, admin: AdminDetails, db: AsyncSession, callback_data: UserPanel.Callback
):
    user = await user_operations.active_next_plan(db, callback_data.username, admin)
    await event.answer(f"User {callback_data.username} Next plan has been activated.")
    groups = await user_operations.validate_all_groups(db, user)
    await event.message.edit_text(Texts.user_details(user, groups), reply_markup=UserPanel(user).as_markup())


@router.callback_query(UserPanel.Callback.filter(UserPanelAction.modify_with_template == F.action))
async def modify_with_template(event: CallbackQuery, db: AsyncSession, callback_data: UserPanel.Callback):
    templates = await user_templates.get_user_templates(db)
    if not templates:
        return event.answer(Texts.there_is_no_template)

    await event.message.edit_text(
        Texts.choose_a_template,
        reply_markup=ChooseTemplate(templates, username=callback_data.username).as_markup()
    )


@router.callback_query(ChooseTemplate.Callback.filter(F.username))
async def modify_with_template_done(
        event: CallbackQuery,
        db: AsyncSession,
        admin: AdminDetails,
        callback_data: ChooseTemplate.Callback
):
    user = await user_operations.modify_user_with_template(
        db,
        callback_data.username,
        ModifyUserByTemplate(user_template_id=callback_data.template_id),
        admin,
    )
    groups = await user_operations.validate_all_groups(db, user)
    return await event.message.edit_text(Texts.user_details(user, groups), reply_markup=UserPanel(user).as_markup())



@router.callback_query(AdminPanel.Callback.filter(AdminPanelAction.create_user_from_template == F.action))
async def create_user_from_template(event: CallbackQuery, db: AsyncSession):
    templates = await user_templates.get_user_templates(db)
    if not templates:
        return event.answer(Texts.there_is_no_template)

    await event.message.edit_text(Texts.choose_a_template, reply_markup=ChooseTemplate(templates).as_markup())


@router.callback_query(ChooseTemplate.Callback.filter(~F.username))
async def create_user_from_template_username(
        event: CallbackQuery,
        state: FSMContext,
        callback_data: ChooseTemplate.Callback
):
    try:
        await event.message.delete()
    except TelegramBadRequest:
        pass

    await state.set_state(forms.CreateUserFromTemplate.username)
    msg = await event.message.answer(Texts.enter_username, reply_markup=CancelKeyboard().as_markup())
    await state.update_data(
        template_id=callback_data.template_id,
        messages_to_delete=[msg.message_id]
    )


@router.message(forms.CreateUserFromTemplate.username)
async def create_user_from_template_choose(event: Message, state: FSMContext, db: AsyncSession, admin: AdminDetails):
    await delete_messages(event, state)
    await add_to_messages_to_delete(state, event)

    username = event.text
    try:
        UserValidator.validate_username(username)
    except ValueError as e:
        msg = await event.reply(f"❌ {e}", reply_markup=CancelKeyboard().as_markup())
        await add_to_messages_to_delete(state, msg)
        return

    template_id = await state.get_value("template_id")
    template = await user_templates.get_validated_user_template(db, template_id)

    try:
        actual_username = template.username_prefix + username + template.username_suffix
        await user_operations.get_validated_user(db, actual_username, admin)
        msg = await event.reply(Texts.username_already_exist, reply_markup=CancelKeyboard().as_markup())
        await add_to_messages_to_delete(state, msg)
        return
    except ValueError:
        pass

    await state.clear()
    await delete_messages(event, state)

    user = await user_operations.create_user_from_template(
        db,
        CreateUserFromTemplate(username=username, user_template_id=template_id),
        admin
    )
    groups = await user_operations.validate_all_groups(db, user)
    return await event.answer(Texts.user_details(user, groups), reply_markup=UserPanel(user).as_markup())



@router.message(F.text)
@router.callback_query(UserPanel.Callback.filter(UserPanelAction.show == F.action))
async def get_user(event: Message | CallbackQuery, admin: AdminDetails, db: AsyncSession, **kwargs):
    """get exact user, otherwise not found"""
    username = event.text if isinstance(event, Message) else kwargs["callback_data"].username
    try:
        user = await user_operations.get_user(db, username, admin)
    except ValueError:
        return await event.reply(Texts.user_not_found, reply_markup=InlineQuerySearch(username).as_markup())

    groups = await user_operations.validate_all_groups(db, user)
    if isinstance(event, Message):
        await event.reply(Texts.user_details(user, groups), reply_markup=UserPanel(user).as_markup())
    else:
        await event.message.edit_text(Texts.user_details(user, groups), reply_markup=UserPanel(user).as_markup())


@router.inline_query()
async def search_user(event: InlineQuery, admin: AdminDetails, db: AsyncSession):
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
