from typing import Dict, List, Union

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app import __version__, xray
from app.db import Session, crud, get_db
from app.models.admin import Admin
from app.models.proxy import InboundUsageCoefficient, ProxyHost, ProxyInbound, ProxyTypes
from app.dependencies import validate_dates
from app.models.system import InboundsUsageResponse, SystemStats
from app.models.user import UserStatus
from app.utils import responses
from app.utils.system import cpu_usage, memory_usage, realtime_bandwidth

router = APIRouter(tags=["System"], prefix="/api", responses={401: responses._401})


@router.get("/version", response_model=Dict[str, str])
def get_version():
    """Return the running Marzban version without requiring authentication."""
    return {"version": __version__}


@router.get("/system", response_model=SystemStats)
def get_system_stats(
    db: Session = Depends(get_db), admin: Admin = Depends(Admin.get_current)
):
    """Fetch system stats including memory, CPU, and user metrics."""
    mem = memory_usage()
    cpu = cpu_usage()
    system = crud.get_system_usage(db)
    dbadmin: Union[Admin, None] = crud.get_admin(db, admin.username)

    total_user = crud.get_users_count(db, admin=dbadmin if not admin.is_sudo else None)
    users_active = crud.get_users_count(
        db, status=UserStatus.active, admin=dbadmin if not admin.is_sudo else None
    )
    users_disabled = crud.get_users_count(
        db, status=UserStatus.disabled, admin=dbadmin if not admin.is_sudo else None
    )
    users_on_hold = crud.get_users_count(
        db, status=UserStatus.on_hold, admin=dbadmin if not admin.is_sudo else None
    )
    users_expired = crud.get_users_count(
        db, status=UserStatus.expired, admin=dbadmin if not admin.is_sudo else None
    )
    users_limited = crud.get_users_count(
        db, status=UserStatus.limited, admin=dbadmin if not admin.is_sudo else None
    )
    online_users = crud.count_online_users(db, 24)
    realtime_bandwidth_stats = realtime_bandwidth()

    return SystemStats(
        version=__version__,
        mem_total=mem.total,
        mem_used=mem.used,
        cpu_cores=cpu.cores,
        cpu_usage=cpu.percent,
        total_user=total_user,
        online_users=online_users,
        users_active=users_active,
        users_disabled=users_disabled,
        users_expired=users_expired,
        users_limited=users_limited,
        users_on_hold=users_on_hold,
        incoming_bandwidth=system.uplink,
        outgoing_bandwidth=system.downlink,
        incoming_bandwidth_speed=realtime_bandwidth_stats.incoming_bytes,
        outgoing_bandwidth_speed=realtime_bandwidth_stats.outgoing_bytes,
    )


@router.get("/inbounds", response_model=Dict[ProxyTypes, List[ProxyInbound]])
def get_inbounds(admin: Admin = Depends(Admin.get_current)):
    """Retrieve inbound configurations grouped by protocol."""
    return {
        protocol: [{**inbound, "usage_coefficient": xray.inbound_coefficients.get(inbound["tag"], 1.0)}
                   for inbound in inbounds]
        for protocol, inbounds in xray.config.inbounds_by_protocol.items()
    }


@router.put("/inbounds/{tag:path}/usage-coefficient", responses={403: responses._403, 404: responses._404})
def set_inbound_usage_coefficient(
    tag: str,
    payload: InboundUsageCoefficient,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Set the traffic multiplier for an inbound (e.g. 2 means 1 GB used counts as 2 GB)."""
    if tag not in xray.config.inbounds_by_tag:
        raise HTTPException(status_code=404, detail=f"Inbound {tag} doesn't exist")

    previous = crud.set_inbound_coefficient(db, tag, payload.usage_coefficient)
    xray.inbound_coefficients.update()
    if previous != payload.usage_coefficient:
        # running cores still hold users under the old emails
        background_tasks.add_task(xray.operations.resync_active_users)
    return {"tag": tag, "usage_coefficient": payload.usage_coefficient}


@router.get("/inbounds/usage", response_model=InboundsUsageResponse)
def get_inbounds_usage(
    start: str = "",
    end: str = "",
    db: Session = Depends(get_db),
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Retrieve per-inbound traffic and its share of total traffic for a date range."""
    start, end = validate_dates(start, end)
    return {"usages": crud.get_inbounds_usage(db, start, end)}


@router.get(
    "/hosts", response_model=Dict[str, List[ProxyHost]], responses={403: responses._403}
)
def get_hosts(
    db: Session = Depends(get_db), admin: Admin = Depends(Admin.check_sudo_admin)
):
    """Get a list of proxy hosts grouped by inbound tag."""
    hosts = {tag: crud.get_hosts(db, tag) for tag in xray.config.inbounds_by_tag}
    return hosts


@router.put(
    "/hosts", response_model=Dict[str, List[ProxyHost]], responses={403: responses._403}
)
def modify_hosts(
    modified_hosts: Dict[str, List[ProxyHost]],
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Modify proxy hosts and update the configuration."""
    for inbound_tag in modified_hosts:
        if inbound_tag not in xray.config.inbounds_by_tag:
            raise HTTPException(
                status_code=400, detail=f"Inbound {inbound_tag} doesn't exist"
            )

    for inbound_tag, hosts in modified_hosts.items():
        crud.update_hosts(db, inbound_tag, hosts)

    xray.hosts.update()

    return {tag: crud.get_hosts(db, tag) for tag in xray.config.inbounds_by_tag}
