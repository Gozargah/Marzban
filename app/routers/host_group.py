from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.db import Session, crud, get_db
from app.db.models import HostGroup
from app.dependencies import get_validated_user
from app.models.admin import Admin
from app.models.host_group import (
    HostGroupCreate,
    HostGroupModify,
    HostGroupResponse,
    UserGroupLimitSet,
    UserGroupUsageResponse,
)
from app.utils import audit, responses

router = APIRouter(
    tags=["HostGroup"], prefix="/api",
    responses={401: responses._401, 403: responses._403},
)


def _require_sudo(admin: Admin):
    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")


def _check_node_conflicts(db: Session, node_ids, exclude_group_id=None):
    """A node may meter into only one group (DB-unique). Reject early with 409
    instead of letting the unique constraint surface as a 500."""
    if not node_ids:
        return
    owners = crud.get_node_group_map(db)  # node_id -> group_id
    conflict = [nid for nid in node_ids
                if owners.get(nid) not in (None, exclude_group_id)]
    if conflict:
        raise HTTPException(
            status_code=409,
            detail=f"Nodes already metered by another group: {conflict}",
        )


def _group_response(g) -> HostGroupResponse:
    return HostGroupResponse(
        id=g.id,
        name=g.name,
        traffic_limit=g.traffic_limit,
        reset_strategy=g.reset_strategy,
        notice_text=g.notice_text,
        include_master=bool(g.include_master),
        created_at=g.created_at,
        host_ids=[h.id for h in g.hosts],
        node_ids=[n.id for n in g.nodes],
    )


def _check_master_conflict(db: Session, include_master: bool, exclude_group_id=None):
    """Only one group may meter the master node."""
    if not include_master:
        return
    other = db.query(HostGroup.id, HostGroup.name).filter(
        HostGroup.include_master.is_(True), HostGroup.id != exclude_group_id
    ).first()
    if other:
        raise HTTPException(
            status_code=409,
            detail=f"Master node already metered by group '{other[1]}'",
        )


@router.get("/host-candidates")
def host_candidates(
    db: Session = Depends(get_db), admin: Admin = Depends(Admin.get_current)
):
    """Flat list of hosts (with ids) for the group editor's host picker.
    Only hosts whose inbound still exists in the live xray config are returned,
    so hosts orphaned by a deleted inbound don't linger in the picker."""
    from app import xray
    from app.db.models import ProxyHost
    active_tags = set(xray.config.inbounds_by_tag.keys())
    return [
        {"id": h.id, "remark": h.remark, "inbound_tag": h.inbound_tag,
         "address": h.address}
        for h in db.query(ProxyHost).order_by(ProxyHost.inbound_tag, ProxyHost.id).all()
        if h.inbound_tag in active_tags
    ]


@router.get("/host-groups", response_model=List[HostGroupResponse])
def list_host_groups(
    db: Session = Depends(get_db), admin: Admin = Depends(Admin.get_current)
):
    """List all host traffic groups."""
    return [_group_response(g) for g in crud.get_host_groups(db)]


@router.post("/host-group", response_model=HostGroupResponse,
             responses={409: responses._409})
def add_host_group(
    body: HostGroupCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.get_current),
):
    _require_sudo(admin)
    if crud.get_host_group_by_name(db, body.name):
        raise HTTPException(status_code=409, detail="Group already exists")
    _check_node_conflicts(db, body.node_ids)
    _check_master_conflict(db, body.include_master)
    group = crud.create_host_group(db, body)
    audit.detail(target_name=group.name, after=audit.snapshot(_group_response(group)))
    return _group_response(group)


@router.get("/host-group/{group_id}", response_model=HostGroupResponse,
            responses={404: responses._404})
def get_host_group(
    group_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.get_current),
):
    g = crud.get_host_group(db, group_id)
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    return _group_response(g)


@router.put("/host-group/{group_id}", response_model=HostGroupResponse,
            responses={404: responses._404})
def modify_host_group(
    group_id: int,
    body: HostGroupModify,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.get_current),
):
    _require_sudo(admin)
    g = crud.get_host_group(db, group_id)
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    if body.name and body.name != g.name and crud.get_host_group_by_name(db, body.name):
        raise HTTPException(status_code=409, detail="Group name already exists")
    _check_node_conflicts(db, body.node_ids, exclude_group_id=group_id)
    if body.include_master is not None:
        _check_master_conflict(db, body.include_master, exclude_group_id=group_id)
    before = audit.snapshot(_group_response(g))
    updated = crud.update_host_group(db, g, body)
    after = _group_response(updated)
    audit.detail(target_name=updated.name, before=before, after=audit.snapshot(after))
    return after


@router.delete("/host-group/{group_id}", responses={404: responses._404})
def delete_host_group(
    group_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.get_current),
):
    _require_sudo(admin)
    g = crud.get_host_group(db, group_id)
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    audit.detail(target_name=g.name, before=audit.snapshot(_group_response(g)))
    crud.remove_host_group(db, g)
    return {"detail": "Group removed"}


# --- bot-facing / per-user endpoints -----------------------------------------

@router.get("/user/{username}/group-usage",
            response_model=List[UserGroupUsageResponse],
            responses={403: responses._403, 404: responses._404})
def get_user_group_usage(
    dbuser=Depends(get_validated_user),
    db: Session = Depends(get_db),
):
    """Per-group traffic usage of a user (for the bot's profile screen)."""
    groups = crud.get_host_groups(db)
    usages = {u.group_id: u for u in crud.get_user_group_usages(db, dbuser.id)}
    return [_usage_response(g, usages.get(g.id)) for g in groups]


def _usage_response(g, u) -> UserGroupUsageResponse:
    used = (u.used_traffic if u else 0) or 0
    member = bool(u.member) if u else False
    override = u.traffic_limit if u else None
    default = g.traffic_limit or None
    limit = (override if override else default) or 0
    return UserGroupUsageResponse(
        group_id=g.id,
        group_name=g.name,
        member=member,
        used_traffic=used,
        traffic_limit=limit or None,
        group_default_limit=default,
        limit_override=override,
        limit_source="user" if override else ("group" if default else "unlimited"),
        remaining=max(limit - used, 0) if limit else None,
        over_limit=bool(limit) and used >= limit,
        reset_at=u.reset_at if u else None,
    )


@router.put("/user/{username}/group/{group_id}",
            response_model=UserGroupUsageResponse,
            responses={403: responses._403, 404: responses._404})
def set_user_group_limit(
    group_id: int,
    body: UserGroupLimitSet,
    dbuser=Depends(get_validated_user),
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.get_current),
):
    """Add/remove the user from a group and/or set their per-group limit
    override. `member` toggles membership; `traffic_limit` (with set_limit=true)
    sets the override in bytes (0/None clears it). Setting a limit also adds the
    user to the group."""
    _require_sudo(admin)
    g = crud.get_host_group(db, group_id)
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    before = audit.snapshot(_usage_response(
        g, crud.get_user_group_usage(db, dbuser.id, group_id)))
    row = crud.set_user_group(
        db, dbuser.id, group_id,
        member=body.member,
        traffic_limit=body.traffic_limit,
        set_limit=body.set_limit,
    )
    after = _usage_response(g, row)
    audit.detail(target_name=dbuser.username, before=before,
                 after=audit.snapshot(after), details={"group": g.name})
    return after


@router.post("/user/{username}/group/{group_id}/reset",
             responses={403: responses._403, 404: responses._404})
def reset_user_group(
    group_id: int,
    dbuser=Depends(get_validated_user),
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.get_current),
):
    """Reset a user's usage counter for one group (e.g. after they top up)."""
    _require_sudo(admin)
    if not crud.get_host_group(db, group_id):
        raise HTTPException(status_code=404, detail="Group not found")
    row = crud.get_user_group_usage(db, dbuser.id, group_id)
    audit.detail(target_name=dbuser.username, details={
        "group_id": group_id, "used_traffic_before": (row.used_traffic if row else 0),
    })
    crud.reset_user_group_usage(db, dbuser.id, group_id)
    return {"detail": "Usage reset"}
