from datetime import datetime as dt, timezone as tz, timedelta as td

from aiogram import Router, F
from aiogram.exceptions import TelegramBadRequest
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin import AdminDetails
from app.models.user import BulkUser
from app.operation import OperatorType
from app.operation.user import UserOperation
from app.telegram.keyboards.admin import AdminPanel, AdminPanelAction
from app.telegram.keyboards.base import CancelKeyboard
from app.telegram.keyboards.bulk_actions import BulkActionPanel, BulkAction
from app.telegram.keyboards.confim_action import ConfirmAction
from app.telegram.utils import forms
from app.telegram.utils.shared import add_to_messages_to_delete, delete_messages
from app.telegram.utils.texts import Message as Texts

user_operations = UserOperation(OperatorType.TELEGRAM)

router = Router(name="bulk_actions")


@router.callback_query(AdminPanel.Callback.filter(AdminPanelAction.bulk_actions == F.action))
async def bulk_actions(event: CallbackQuery):
    await event.message.edit_text(Texts.choose_action, reply_markup=BulkActionPanel().as_markup())


@router.callback_query(BulkActionPanel.Callback.filter((BulkAction.delete_expired == F.action) & ~F.amount))
async def delete_expired(event: CallbackQuery, state: FSMContext):
    try:
        await event.message.delete()
    except TelegramBadRequest:
        pass
    await state.set_state(forms.DeleteExpired.expired_before)
    msg = await event.message.answer(Texts.enter_expire_before, reply_markup=CancelKeyboard().as_markup())
    await state.update_data(messages_to_delete=[msg.message_id])


@router.message(forms.DeleteExpired.expired_before)
async def process_expire_before(event: Message, state: FSMContext):
    await delete_messages(event, state)
    await add_to_messages_to_delete(state, event)

    if not event.text or not event.text.isnumeric():
        msg = await event.reply(text=Texts.duration_not_valid, reply_markup=CancelKeyboard().as_markup())
        await add_to_messages_to_delete(state, msg)
        return

    await state.clear()

    await event.answer(
        Texts.confirm_delete_expired(event.text),
        reply_markup=ConfirmAction(
            confirm_action=BulkActionPanel.Callback(
                action=BulkAction.delete_expired,
                amount=event.text
            ).pack(),
            cancel_action=AdminPanel.Callback(
                action=AdminPanelAction.bulk_actions,
            ).pack(),
        ).as_markup()
    )


@router.callback_query(BulkActionPanel.Callback.filter((BulkAction.delete_expired == F.action) & F.amount))
async def delete_expired_done(
        event: CallbackQuery,
        db: AsyncSession,
        admin: AdminDetails,
        callback_data: BulkActionPanel.Callback
):
    expire_before = dt.now(tz.utc) - td(days=int(callback_data.amount))
    result = await user_operations.delete_expired_users(
        db,
        admin,
        expired_before=expire_before,
        expired_after=dt.fromtimestamp(0, tz.utc),
    )
    await event.answer(Texts.users_deleted(result.count))
    await event.message.edit_text(Texts.choose_action, reply_markup=BulkActionPanel().as_markup())


@router.callback_query(BulkActionPanel.Callback.filter((BulkAction.modify_expiry == F.action) & ~F.amount))
async def modify_expiry(event: CallbackQuery, state: FSMContext):
    try:
        await event.message.delete()
    except TelegramBadRequest:
        pass
    await state.set_state(forms.BulkModify.expiry)
    msg = await event.message.answer(Texts.enter_modify_expiry, reply_markup=CancelKeyboard().as_markup())
    await state.update_data(messages_to_delete=[msg.message_id])


@router.message(forms.BulkModify.expiry)
async def process_expiry(event: Message, state: FSMContext):
    await delete_messages(event, state)
    await add_to_messages_to_delete(state, event)

    try:
        amount = int(event.text)
    except ValueError:
        msg = await event.reply(text=Texts.duration_not_valid, reply_markup=CancelKeyboard().as_markup())
        await add_to_messages_to_delete(state, msg)
        return

    await state.clear()

    await event.answer(
        Texts.confirm_modify_expiry(amount),
        reply_markup=ConfirmAction(
            confirm_action=BulkActionPanel.Callback(
                action=BulkAction.modify_expiry, amount=str(amount)
            ).pack(),
            cancel_action=AdminPanel.Callback(
                action=AdminPanelAction.bulk_actions,
            ).pack(),
        ).as_markup(),
    )


@router.callback_query(BulkActionPanel.Callback.filter((BulkAction.modify_expiry == F.action) & F.amount))
async def modify_expiry_done(
        event: CallbackQuery,
        db: AsyncSession,
        callback_data: BulkActionPanel.Callback
):
    result = await user_operations.bulk_modify_expire(db, BulkUser(amount=int(callback_data.amount) * 86400))
    await event.answer(Texts.users_expiry_changed(result, int(callback_data.amount)))
    await event.message.edit_text(Texts.choose_action, reply_markup=BulkActionPanel().as_markup())


@router.callback_query(BulkActionPanel.Callback.filter((BulkAction.modify_data_limit == F.action) & ~F.amount))
async def modify_data_limit(event: CallbackQuery, state: FSMContext):
    try:
        await event.message.delete()
    except TelegramBadRequest:
        pass
    await state.set_state(forms.BulkModify.data_limit)
    msg = await event.message.answer(Texts.enter_modify_data_limit, reply_markup=CancelKeyboard().as_markup())
    await state.update_data(messages_to_delete=[msg.message_id])


@router.message(forms.BulkModify.data_limit)
async def process_data_limit(event: Message, state: FSMContext):
    await delete_messages(event, state)
    await add_to_messages_to_delete(state, event)

    try:
        amount = int(event.text)
    except ValueError:
        msg = await event.reply(text=Texts.data_limit_not_valid, reply_markup=CancelKeyboard().as_markup())
        await add_to_messages_to_delete(state, msg)
        return

    await state.clear()

    await event.answer(
        Texts.confirm_modify_data_limit(amount),
        reply_markup=ConfirmAction(
            confirm_action=BulkActionPanel.Callback(
                action=BulkAction.modify_data_limit, amount=str(amount)
            ).pack(),
            cancel_action=AdminPanel.Callback(
                action=AdminPanelAction.bulk_actions,
            ).pack(),
        ).as_markup(),
    )


@router.callback_query(BulkActionPanel.Callback.filter((BulkAction.modify_data_limit == F.action) & F.amount))
async def modify_data_limit_done(
        event: CallbackQuery,
        db: AsyncSession,
        callback_data: BulkActionPanel.Callback
):
    result = await user_operations.bulk_modify_datalimit(db, BulkUser(amount=int(callback_data.amount) * (1024**3)))
    await event.answer(Texts.users_data_limit_changed(result, int(callback_data.amount)))
    await event.message.edit_text(Texts.choose_action, reply_markup=BulkActionPanel().as_markup())
