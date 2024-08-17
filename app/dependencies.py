from typing import Optional
from app.models.admin import AdminInDB, AdminValidationResult
from app.db import Session, crud, get_db
from config import SUDOERS
from fastapi import Depends, HTTPException


def validate_admin(db: Session, username: str, password: str) -> Optional[AdminValidationResult]:
    """
    Validate admin credentials with environment variables or database.
    """
    if SUDOERS.get(username) == password:
        return AdminValidationResult(username, True)

    dbadmin = crud.get_admin(db, username)
    if dbadmin and AdminInDB.from_orm(dbadmin).verify_password(password):
        return AdminValidationResult(dbadmin.username, dbadmin.is_sudo)

    return None


def get_admin_by_username(username: str, db: Session = Depends(get_db)):
    """
    Fetch an admin by username from the database.
    """
    dbadmin = crud.get_admin(db, username)
    if not dbadmin:
        raise HTTPException(status_code=404, detail="Admin not found")
    return dbadmin
