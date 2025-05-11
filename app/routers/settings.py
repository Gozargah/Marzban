from fastapi import APIRouter, Depends

from app.db import AsyncSession, get_db
from .authentication import check_sudo_admin
from app.models.settings import SettingsSchema
from app.operation.settings import SettingsOperation
from app.operation import OperatorType
from app.utils import responses


settings_operator = SettingsOperation(operator_type=OperatorType.API)
router = APIRouter(tags=["Settings"], prefix="/api/settings", responses={401: responses._401, 403: responses._403})


@router.get("", response_model=SettingsSchema)
async def get_settings(db: AsyncSession = Depends(get_db), _=Depends(check_sudo_admin)):
    return await settings_operator.get_settings(db)


@router.put("", response_model=SettingsSchema)
async def modify_settings(modify: SettingsSchema, db: AsyncSession = Depends(get_db), _=Depends(check_sudo_admin)):
    return await settings_operator.modify_settings(db, modify)
