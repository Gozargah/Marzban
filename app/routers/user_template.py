from typing import List

from sqlalchemy.exc import IntegrityError
from fastapi import Depends, HTTPException, APIRouter

from app.db import Session, crud, get_db
from app.models.admin import Admin
from app.models.user_template import (UserTemplateCreate, UserTemplateModify,
                                      UserTemplateResponse)
from app.dependencies import get_user_template

router = APIRouter(tags=['User Template'], prefix='/api')

@router.post("/user_template", response_model=UserTemplateResponse)
def add_user_template(
    new_user_template: UserTemplateCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin)
):
    """
    Add a new user template

    - **name** can be up to 64 characters
    - **data_limit** must be in bytes and larger or equal to 0
    - **expire_duration** must be in seconds and larger or equat to 0
    - **inbounds** dictionary of protocol:inbound_tags, empty means all inbounds
    """
    try:
        return crud.create_user_template(db, new_user_template)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Template by this name already exists")


@router.get("/user_template/{template_id}", response_model=UserTemplateResponse)
def get_user_template_endpoint(
    dbuser_template: UserTemplateResponse = Depends(get_user_template),
    admin: Admin = Depends(Admin.get_current)):
    """Get User Template information with id"""
    return dbuser_template


@router.put("/user_template/{template_id}", response_model=UserTemplateResponse)
def modify_user_template(
    modify_user_template: UserTemplateModify,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
    dbuser_template: UserTemplateResponse = Depends(get_user_template)
):
    """
    Modify User Template

    - **name** can be up to 64 characters
    - **data_limit** must be in bytes and larger or equal to 0
    - **expire_duration** must be in seconds and larger or equat to 0
    - **inbounds** dictionary of protocol:inbound_tags, empty means all inbounds
    """
    try:
        return crud.update_user_template(db, dbuser_template, modify_user_template)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Template by this name already exists")


@router.delete("/user_template/{template_id}")
def remove_user_template(
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
    dbuser_template: UserTemplateResponse = Depends(get_user_template)
):
    """Remove a User Template by its ID"""
    return crud.remove_user_template(db, dbuser_template)


@router.get("/user_template", response_model=List[UserTemplateResponse])
def get_user_templates(
    offset: int = None,
    limit: int = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.get_current)
):
    """Get a list of User Templates with optional pagination"""
    return crud.get_user_templates(db, offset, limit)
