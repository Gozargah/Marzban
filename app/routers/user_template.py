from typing import List

import sqlalchemy
from fastapi import Depends, HTTPException, APIRouter

from app.db import Session, crud, get_db
from app.models.admin import Admin
from app.models.user_template import (UserTemplateCreate, UserTemplateModify,
                                      UserTemplateResponse)

router = APIRouter(tags=['User Template'], prefix='/api')

@router.post("/user_template", response_model=UserTemplateResponse)
def add_user_template(new_user_template: UserTemplateCreate,
                      db: Session = Depends(get_db),
                      admin: Admin = Depends(Admin.get_current)):
    """
    Add a new user template

    - **name** can be up to 64 characters
    - **data_limit** must be in bytes and larger or equal to 0
    - **expire_duration** must be in seconds and larger or equat to 0
    - **inbounds** dictionary of protocol:inbound_tags, empty means all inbounds
    """
    if not (admin.is_sudo):
        raise HTTPException(status_code=403, detail="You're not allowed")
    try:
        return crud.create_user_template(db, new_user_template)
    except sqlalchemy.exc.IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Template by this name already exists")


@router.get("/user_template/{id}", response_model=UserTemplateResponse)
def get_user_template(id: int, db: Session = Depends(get_db), admin: Admin = Depends(Admin.get_current)):
    """
    Get User Template information with id
    """
    dbuser_template = crud.get_user_template(db, id)
    if not dbuser_template:
        raise HTTPException(status_code=404, detail="User Template not found")

    return dbuser_template


@router.put("/user_template/{id}", response_model=UserTemplateResponse)
def modify_user_template(id: int, modify_user_template: UserTemplateModify,
                         db: Session = Depends(get_db),
                         admin: Admin = Depends(Admin.get_current)):
    """
    Modify User Template

    - **name** can be up to 64 characters
    - **data_limit** must be in bytes and larger or equal to 0
    - **expire_duration** must be in seconds and larger or equat to 0
    - **inbounds** dictionary of protocol:inbound_tags, empty means all inbounds
    """
    dbuser_template = crud.get_user_template(db, id)
    if not dbuser_template:
        raise HTTPException(status_code=404, detail="User Template not found")
    if not (admin.is_sudo):
        raise HTTPException(status_code=403, detail="You're not allowed")

    try:
        return crud.update_user_template(db, dbuser_template, modify_user_template)
    except sqlalchemy.exc.IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Template by this name already exists")


@router.delete("/user_template/{id}")
def remove_user_template(id: int,
                         db: Session = Depends(get_db),
                         admin: Admin = Depends(Admin.get_current)):
    dbuser_template = crud.get_user_template(db, id)
    if not dbuser_template:
        raise HTTPException(status_code=404, detail="User Template not found")
    if not (admin.is_sudo):
        raise HTTPException(status_code=403, detail="You're not allowed")

    return crud.remove_user_template(db, dbuser_template)


@router.get("/user_template", response_model=List[UserTemplateResponse])
def get_user_templates(
        offset: int = None, limit: int = None, db: Session = Depends(get_db),
        admin: Admin = Depends(Admin.get_current)):
    return crud.get_user_templates(db, offset, limit)
