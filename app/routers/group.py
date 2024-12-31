from fastapi import APIRouter, Depends, HTTPException

from app import xray
from app.db import Session, crud, get_db
from app.dependencies import get_validated_group
from app.models.admin import Admin
from app.models.group import (
    Group,
    GroupCreate,
    GroupModify,
    GroupResponse,
    GroupsResponse,
)
from app.utils import responses

router = APIRouter(prefix="/api", tags=["Groups"], responses={401: responses._401, 403: responses._403})


@router.post("/group", response_model=GroupResponse)
def add_group(
    new_group: GroupCreate,
    db: Session = Depends(get_db),
    _: Admin = Depends(Admin.check_sudo_admin)
):
    for tag in new_group.inbound_tags:
        if tag not in xray.config.inbounds_by_tag:
            raise HTTPException(400, detail=f"{tag} not found")

    return crud.create_group(db, new_group)


@router.get("/groups", response_model=GroupsResponse)
def get_all_groups(
    offset: int = None,
    limit: int = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.get_current)
):
    dbgroups, count = crud.get_group(db, offset, limit)
    return {"groups": dbgroups, "total": count}


@router.get("/group/{group_id}", response_model=GroupResponse)
def get_validated_group(dbgroup: Group = Depends(get_validated_group)):
    return dbgroup


@router.put("/group/{group_id}", response_model=GroupResponse)
def modify_group(
    modified_group: GroupModify,
    db: Session = Depends(get_db),
    _: Admin = Depends(Admin.check_sudo_admin),
    dbgroup: Group = Depends(get_validated_group),
):
    for tag in modified_group.inbound_tags:
        if tag not in xray.config.inbounds_by_tag:
            raise HTTPException(400, detail=f"{tag} not found")

    dbgroup = crud.update_group(db, dbgroup, modified_group)

    return dbgroup


@router.delete("/group/{group_id}")
def delete_group(
    db: Session = Depends(get_db),
    dbgroup: Group = Depends(get_validated_group),
    _: Admin = Depends(Admin.check_sudo_admin)
):
    crud.remove_group(db, dbgroup)
    return {}
