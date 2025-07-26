from aiogram import Router, types, F
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import CommandStart
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin import AdminDetails
from app.telegram.keyboards.admin import AdminPanel
from app.telegram.keyboards.base import CancelAction, CancelKeyboard
from aiogram.fsm.context import FSMContext
from app.operation import OperatorType
from app.operation.system import SystemOperation
from app.telegram.utils.texts import Message as Texts
from app.telegram.utils.shared import delete_messages
from app.settings import telegram_settings

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
    message = event.message if isinstance(event, types.CallbackQuery) else event

    if state is not None and (await state.get_state() is not None):
        await delete_messages(event, state)
        await state.clear()

    settings = await telegram_settings()

    if admin:
        stats = await system_operator.get_system_stats(db, admin)
        if isinstance(event, types.CallbackQuery):
            try:
                return await message.edit_text(
                    text=Texts.start(stats),
                    reply_markup=AdminPanel(
                        is_sudo=admin.is_sudo,
                        panel_url=settings.mini_app_web_url if settings.mini_app_login else None,
                    ).as_markup(),
                )
            except TelegramBadRequest:
                pass
        await message.answer(
            text=Texts.start(stats),
            reply_markup=AdminPanel(
                is_sudo=admin.is_sudo, panel_url=settings.mini_app_web_url if settings.mini_app_login else None
            ).as_markup(),
        )
    else:
        await message.answer(f"Hello, {event.from_user.full_name}!")
