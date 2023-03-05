from typing import List

import sqlalchemy
from app import app
from app.db import Session, crud, get_db
from app.models.admin import Admin, AdminCreate, AdminInDB, AdminModify, Token
from app.utils.jwt import create_admin_token
from config import SUDOERS
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm


def authenticate_sudo(username: str, password: str):
    try:
        return password == SUDOERS[username]
    except KeyError:
        return False


def authenticate_admin(db: Session, username: str, password: str):
    dbadmin = crud.get_admin(db, username)
    if not dbadmin:
        return False
    admin = AdminInDB.from_orm(dbadmin)
    return admin.verify_password(password)


@app.post("/api/admin/token", tags=['Admin'], response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(),
                           db: Session = Depends(get_db)):
    if authenticate_sudo(form_data.username, form_data.password):
        return Token(access_token=create_admin_token(form_data.username, is_sudo=True))

    if authenticate_admin(db, form_data.username, form_data.password):
        return Token(access_token=create_admin_token(form_data.username))

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password",
        headers={"WWW-Authenticate": "Bearer"},
    )


@ app.post("/api/admin", tags=['Admin'], response_model=Admin)
def create_admin(new_admin: AdminCreate,
                 db: Session = Depends(get_db),
                 admin: Admin = Depends(Admin.get_current)):

    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    try:
        dbadmin = crud.create_admin(db, new_admin)
    except sqlalchemy.exc.IntegrityError:
        raise HTTPException(status_code=409, detail="Admin already exists")

    return dbadmin


@ app.put("/api/admin/{username}", tags=['Admin'], response_model=Admin)
def modify_admin(username: str,
                 modified_admin: AdminModify,
                 db: Session = Depends(get_db),
                 admin: Admin = Depends(Admin.get_current)):
    if not (admin.is_sudo or admin.username == username):
        raise HTTPException(status_code=403, detail="You're not allowed")

    dbadmin = crud.get_admin(db, username)
    if not dbadmin:
        raise HTTPException(status_code=404, detail="Admin not found")

    dbadmin = crud.update_admin(db, dbadmin, modified_admin)
    return dbadmin


@ app.delete("/api/admin/{username}", tags=['Admin'])
def remove_admin(username: str,
                 db: Session = Depends(get_db),
                 admin: Admin = Depends(Admin.get_current)):
    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    dbadmin = crud.get_admin(db, username)
    if not dbadmin:
        raise HTTPException(status_code=404, detail="Admin not found")

    dbadmin = crud.remove_admin(db, dbadmin)
    return {}


@ app.get("/api/admin", tags=['Admin'], response_model=Admin)
def get_current_admin(admin: Admin = Depends(Admin.get_current)):
    return admin


@ app.get("/api/admins", tags=['Admin'], response_model=List[Admin])
def get_admins(offset: int = None,
               limit: int = None,
               username: str = None,
               db: Session = Depends(get_db),
               admin: Admin = Depends(Admin.get_current)):

    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    return crud.get_admins(db, offset, limit, username)
