from typing import List, Optional

import sqlalchemy
from app import app
from app.db import Session, crud, get_db
from app.models.admin import Admin, AdminCreate, AdminInDB, AdminModify, Token
from app.utils.jwt import create_admin_token
from config import SUDOERS
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from app.utils import report


def authenticate_env_sudo(username: str, password: str) -> bool:
    try:
        return password == SUDOERS[username]
    except KeyError:
        return False


def authenticate_admin(db: Session, username: str, password: str) -> Optional[Admin]:
    dbadmin = crud.get_admin(db, username)
    if not dbadmin:
        return None

    return dbadmin if AdminInDB.from_orm(dbadmin).verify_password(password) else None


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host


@app.post("/api/admin/token", tags=['Admin'], response_model=Token)
def admin_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    client_ip = get_client_ip(request)

    if authenticate_env_sudo(form_data.username, form_data.password):
        report.login(form_data.username, '🔒', client_ip, True)
        return Token(access_token=create_admin_token(form_data.username, is_sudo=True))

    if dbadmin := authenticate_admin(db, form_data.username, form_data.password):
        report.login(form_data.username, '🔒', client_ip, True)
        return Token(access_token=create_admin_token(form_data.username, is_sudo=dbadmin.is_sudo))

    report.login(form_data.username, form_data.password, client_ip, False)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password",
        headers={"WWW-Authenticate": "Bearer"},
    )


@app.post("/api/admin", tags=['Admin'], response_model=Admin)
def create_admin(new_admin: AdminCreate,
                 db: Session = Depends(get_db),
                 admin: Admin = Depends(Admin.get_current)):

    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    try:
        dbadmin = crud.create_admin(db, new_admin)
    except sqlalchemy.exc.IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Admin already exists")

    return dbadmin


@app.put("/api/admin/{username}", tags=['Admin'], response_model=Admin)
def modify_admin(username: str,
                 modified_admin: AdminModify,
                 db: Session = Depends(get_db),
                 admin: Admin = Depends(Admin.get_current)):
    if not (admin.is_sudo or admin.username == username):
        raise HTTPException(status_code=403, detail="You're not allowed")

    # If a non-sudoer admin is making itself a sudoer
    if (admin.username == username) and (modified_admin.is_sudo and not admin.is_sudo):
        raise HTTPException(status_code=403, detail="You can't make yourself sudoer!")

    dbadmin = crud.get_admin(db, username)
    if not dbadmin:
        raise HTTPException(status_code=404, detail="Admin not found")

    # If a sudoer admin wants to edit another sudoer
    if (username != admin.username) and dbadmin.is_sudo:
        raise HTTPException(
            status_code=403,
            detail=("You're not allowed to edit another sudoers account. Use marzban-cli instead.",),
        )

    dbadmin = crud.update_admin(db, dbadmin, modified_admin)
    return dbadmin


@app.delete("/api/admin/{username}", tags=['Admin'])
def remove_admin(username: str,
                 db: Session = Depends(get_db),
                 admin: Admin = Depends(Admin.get_current)):
    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    dbadmin = crud.get_admin(db, username)
    if not dbadmin:
        raise HTTPException(status_code=404, detail="Admin not found")

    if dbadmin.is_sudo:
        raise HTTPException(
            status_code=403,
            detail=("You're not allowed to delete sudoers accounts. Use marzban-cli instead."),
        )

    dbadmin = crud.remove_admin(db, dbadmin)
    return {}


@app.get("/api/admin", tags=["Admin"], response_model=Admin)
def get_current_admin(admin: Admin = Depends(Admin.get_current)):
    return admin


@app.get("/api/admins", tags=['Admin'], response_model=List[Admin])
def get_admins(offset: int = None,
               limit: int = None,
               username: str = None,
               db: Session = Depends(get_db),
               admin: Admin = Depends(Admin.get_current)):

    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    return crud.get_admins(db, offset, limit, username)
