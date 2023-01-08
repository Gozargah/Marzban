from app import app
from app.db import crud, Session, get_db
from app.models.admin import Admin
from app.models.system import SystemStats
from fastapi import Depends

from app.models.user import UserStatus
from app.utils.system import memory_usage
from app.utils.jwt import current_admin


@app.get("/api/system", tags=["System"], response_model=SystemStats)
def system_stats(db: Session = Depends(get_db), admin: Admin = Depends(current_admin)):
    mem = memory_usage()
    system = crud.get_system_usage(db)
    total_user = crud.get_users_count(db)
    users_active = crud.get_users_count(db, UserStatus.active)

    return SystemStats(
        mem_total=mem.total,
        mem_used=mem.used,
        total_user=total_user,
        users_active=users_active,
        incoming_bandwidth=system.uplink,
        outgoing_bandwith=system.downlink,
    )
