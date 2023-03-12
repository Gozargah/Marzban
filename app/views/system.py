from typing import Dict, List, Union

from app import app, xray
from app.db import Session, crud, get_db
from app.models.admin import Admin
from app.models.proxy import ProxyHost, ProxyInbound, ProxyTypes
from app.models.system import SystemStats
from app.models.user import UserStatus
from app.utils.system import memory_usage
from app.utils.store import XrayStore
from fastapi import Depends, HTTPException


@app.get("/api/system", tags=["System"], response_model=SystemStats)
def get_system_stats(db: Session = Depends(get_db), admin: Admin = Depends(Admin.get_current)):
    mem = memory_usage()
    system = crud.get_system_usage(db)
    dbadmin: Union[Admin, None] = crud.get_admin(db, admin.username)

    total_user = crud.get_users_count(db, admin=dbadmin)
    users_active = crud.get_users_count(db, status=UserStatus.active, admin=dbadmin)

    return SystemStats(
        mem_total=mem.total,
        mem_used=mem.used,
        total_user=total_user,
        users_active=users_active,
        incoming_bandwidth=system.uplink,
        outgoing_bandwith=system.downlink,
    )


@app.get('/api/inbounds', tags=["System"], response_model=Dict[ProxyTypes, List[ProxyInbound]])
def get_inbounds(admin: Admin = Depends(Admin.get_current)):
    return xray.config.inbounds_by_protocol


@app.get('/api/hosts', tags=["System"], response_model=Dict[str, List[ProxyHost]])
def get_hosts(db: Session = Depends(get_db), admin: Admin = Depends(Admin.get_current)):
    hosts = {}
    for inbound_tag in xray.config.inbounds_by_tag:
        hosts[inbound_tag] = crud.get_hosts(db, inbound_tag)

    return hosts


@app.put('/api/hosts', tags=["System"], response_model=Dict[str, List[ProxyHost]])
def modify_hosts(modified_hosts: Dict[str, List[ProxyHost]],
                 db: Session = Depends(get_db),
                 admin: Admin = Depends(Admin.get_current)):
    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    # validate
    for inbound_tag, hosts in modified_hosts.items():
        if not xray.config.inbounds_by_tag.get(inbound_tag):
            raise HTTPException(status_code=400, detail=f"Inbound {inbound_tag} doesn't exist")
        if not hosts:
            raise HTTPException(status_code=400, detail=f"Inbound {inbound_tag} hosts cannot be empty")

    for inbound_tag, hosts in modified_hosts.items():
        crud.update_hosts(db, inbound_tag, hosts)

    XrayStore.update_hosts()

    hosts = {}
    for inbound_tag in xray.config.inbounds_by_tag:
        hosts[inbound_tag] = crud.get_hosts(db, inbound_tag)

    return hosts
