from aiogram import Router, types, F
from aiogram.filters import CommandStart
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin import AdminDetails
from app.telegram.keyboards.admin import AdminPanel
from app.telegram.keyboards.base import CancelAction, CancelKeyboard
from aiogram.fsm.context import FSMContext
from app.operation import OperatorType
from app.operation.system import SystemOperation
from app.telegram.utils.texts import Message as Texts

system_operator = SystemOperation(OperatorType.TELEGRAM)

router = Router(name="base")


@router.callback_query(CancelKeyboard.Callback.filter(CancelAction.cancel == F.action))
@router.message(CommandStart())
async def command_start_handler(
    event: types.Message | types.CallbackQuery,
    admin: AdminDetails | None,
    state: FSMContext | None = None,
    db: AsyncSession | None = None,
):
    """
    This handler receives messages with `/start` command
    """
    message = (event.message if isinstance(event, types.CallbackQuery) else event)
    messages_to_delete = []
    if state is not None and (await state.get_state() is not None):
        messages_to_delete = await state.get_value("messages_to_delete", [])

    messages_to_delete.append(message.message_id)
    try:
        await event.bot.delete_messages(message.chat.id, messages_to_delete)
    finally:
        await state.clear()
    if admin:
        stats = await system_operator.get_system_stats(db, admin)
        if isinstance(event, types.CallbackQuery):
            return await message.answer(text=Texts.start(stats), reply_markup=AdminPanel().as_markup())
        await message.answer(text=Texts.start(stats), reply_markup=AdminPanel().as_markup())
    else:
        await message.answer(f"Hello, {event.from_user.full_name}!")

