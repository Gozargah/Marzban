from io import BytesIO

from aiogram import Router, F
from aiogram.types import BufferedInputFile
from aiogram.types import Message
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import ConfigFormat
from app.operation import OperatorType
from app.operation.subscription import SubscriptionOperation
from app.operation.user import UserOperation
from app.telegram.utils.texts import Message as Texts

user_operations = UserOperation(OperatorType.TELEGRAM)
subscription_operations = SubscriptionOperation(OperatorType.TELEGRAM)

router = Router(name="show_info")


@router.message(F.text)
async def get_user(event: Message, db: AsyncSession):
    """get exact user, otherwise not found"""
    token = event.text.strip("/").split("/")[-1]
    try:
        db_user = await user_operations.get_validated_sub(db, token)
        user = await user_operations.validate_user(db_user)
        user_with_inbounds = await subscription_operations.validated_user(db_user)
        configs = (await subscription_operations.fetch_config(user_with_inbounds, ConfigFormat.links))[0]
    except ValueError:
        return await event.reply(Texts.user_not_found)

    if configs:
        if len(configs) < 4085:  # Telegram message limit (including formatting)
            await event.reply(Texts.client_user_details(user))
            await event.answer(f"<pre>{configs}</pre>")
        else:
            file = BytesIO(configs.encode('utf-8'))
            await event.answer_document(
                BufferedInputFile(file.read(), f"{user.username}.txt"),
                caption=Texts.client_user_details(user)
            )
    else:
        await event.reply(Texts.client_user_details(user))
