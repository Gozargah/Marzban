from aiogram import Router, types, F
from aiogram.filters import CommandStart
from app.models.admin import AdminDetails
from app.telegram.keyboards.admin import AdminPanel
from app.telegram.keyboards.base import CancelAction, CancelKeyboard
from aiogram.fsm.context import FSMContext

router = Router(name="base")


@router.callback_query(CancelKeyboard.Callback.filter(CancelAction.cancel == F.action))
@router.message(CommandStart())
async def command_start_handler(
    event: types.Message | types.CallbackQuery,
    admin: AdminDetails | None,
    state: FSMContext | None = None,
) -> None:
    """
    This handler receives messages with `/start` command
    """
    if (state is not None) and (await state.get_state() is not None):
        await state.clear()
    if admin:
        await (event.message if isinstance(event, types.CallbackQuery) else event).reply(
            text="Hello, admin!", reply_markup=AdminPanel().as_markup()
        )
    else:
        await (event.message if isinstance(event, types.CallbackQuery) else event).reply(
            f"Hello, {event.from_user.full_name}!"
        )
