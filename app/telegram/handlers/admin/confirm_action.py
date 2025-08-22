from aiogram import Router
from aiogram.types import CallbackQuery
from sqlalchemy.ext.asyncio.session import AsyncSession

from app.models.admin import AdminDetails
from app.operation import OperatorType
from app.operation.user import UserOperation
from app.telegram.keyboards.confim_action import ConfirmAction
from app.telegram.keyboards.user import UserPanel, UserPanelAction
from app.telegram.utils.texts import Message as Texts


router = Router(name="confirm_action")

user_operations = UserOperation(OperatorType.TELEGRAM)


@router.callback_query(ConfirmAction.Callback.filter())
async def confirm_action(
        event: CallbackQuery,
        callback_data: ConfirmAction.Callback,
        db: AsyncSession,
        admin: AdminDetails
):
    text = Texts.confirm
    if callback_data.action.startswith(UserPanel.Callback.__prefix__):
        action = UserPanel.Callback.unpack(callback_data.action)
        user = await user_operations.get_user_by_id(db, action.user_id, admin)
        match action.action:
            case UserPanelAction.disable:
                text = Texts.confirm_disable_user(user.username)
            case UserPanelAction.enable:
                text = Texts.confirm_enable_user(user.username)
            case UserPanelAction.delete:
                text = Texts.confirm_delete_user(user.username)
            case UserPanelAction.revoke_sub:
                text = Texts.confirm_revoke_sub(user.username)
            case UserPanelAction.reset_usage:
                text = Texts.confirm_reset_usage(user.username)
            case UserPanelAction.activate_next_plan:
                text = Texts.confirm_activate_next_plan(user.username)

    await event.message.edit_text(
        text,
        reply_markup=ConfirmAction(confirm_action=callback_data.action, cancel_action=callback_data.cancel).as_markup(),
    )
