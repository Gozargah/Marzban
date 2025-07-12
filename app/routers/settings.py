from fastapi import APIRouter, Depends

from app.db import AsyncSession, get_db
from app.models.settings import General, SettingsSchema
from app.operation import OperatorType
from app.operation.settings import SettingsOperation
from app.utils import responses

from .authentication import check_sudo_admin, get_current

settings_operator = SettingsOperation(operator_type=OperatorType.API)
router = APIRouter(tags=["Settings"], prefix="/api/settings", responses={401: responses._401, 403: responses._403})


@router.get("", response_model=SettingsSchema)
async def get_settings(db: AsyncSession = Depends(get_db), _=Depends(check_sudo_admin)):
    return await settings_operator.get_settings(db)


@router.get("/general", response_model=General)
async def get_general_settings(db: AsyncSession = Depends(get_db), _=Depends(get_current)):
    return await settings_operator.get_general_settings(db)


@router.put("", response_model=SettingsSchema)
async def modify_settings(modify: SettingsSchema, db: AsyncSession = Depends(get_db), _=Depends(check_sudo_admin)):
    return await settings_operator.modify_settings(db, modify)
