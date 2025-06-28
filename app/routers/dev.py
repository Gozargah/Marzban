from fastapi import APIRouter, Depends

from app.db import AsyncSession, get_db
from app.db.crud import dev as crud
from app.models.admin import AdminDetails
from app.utils import responses
from config import DEBUG

from .authentication import check_sudo_admin

try:
    from faker import Faker

    fake = Faker()
except Exception:
    pass

router = APIRouter(tags=["Dev"], prefix="/api/dev", responses={401: responses._401, 403: responses._403})


@router.post("/generate/nodes-logs")
async def nodes_logs(db: AsyncSession = Depends(get_db), _: AdminDetails = Depends(check_sudo_admin)):
    """
    generate node logs for developers
    """
    print("node-generator")
    if not DEBUG:
        return {"message": "u are not a developer"}
    await crud.generate_node_usage(db, fake, 200)
    return {"message": "Done"}


@router.post("/generate/users-logs")
async def node_users_usage_logs(db: AsyncSession = Depends(get_db), _: AdminDetails = Depends(check_sudo_admin)):
    """
    generate user logs for developers
    """
    if not DEBUG:
        return {"message": "u are not a developer"}
    await crud.generate_node_user_usage(db, fake, 200)
    return {"message": "Done"}
