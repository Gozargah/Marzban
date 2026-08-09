from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.db import Session, crud, get_db
from app.models.admin import Admin
from app.models.audit import AuditLogsResponse, AuditMetaResponse
from app.utils import responses
from app.utils.audit import ACTIONS

router = APIRouter(tags=["Audit"], prefix="/api", responses={401: responses._401})


@router.get("/audit-logs", response_model=AuditLogsResponse,
            responses={403: responses._403})
def get_audit_logs(
    offset: Optional[int] = None,
    limit: Optional[int] = 50,
    admin_username: Optional[str] = Query(None, alias="admin"),
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[datetime] = Query(None, alias="from"),
    date_to: Optional[datetime] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Admin action history, newest first (sudo only)."""
    logs, total = crud.get_audit_logs(
        db,
        offset=offset,
        limit=limit,
        admin_username=admin_username,
        action=action,
        target_type=target_type,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )
    return {"logs": logs, "total": total}


@router.get("/audit-logs/meta", response_model=AuditMetaResponse,
            responses={403: responses._403})
def get_audit_meta(
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Filter options for the history view: admins seen and known actions."""
    return {"admins": crud.get_audit_log_admins(db), "actions": list(ACTIONS)}
