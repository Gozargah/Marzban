from typing import Optional, Union
from app.models.admin import AdminInDB, AdminValidationResult
from app.db import Session, crud, get_db
from config import SUDOERS
from fastapi import Depends, HTTPException
from datetime import datetime


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

def get_dbnode(node_id: int, db: Session = Depends(get_db)):
    """Fetch a node by its ID from the database, raising a 404 error if not found."""
    dbnode = crud.get_node_by_id(db, node_id)
    if not dbnode:
        raise HTTPException(status_code=404, detail="Node not found")
    return dbnode

def validate_dates(start: Optional[Union[str, datetime]], end: Optional[Union[str, datetime]]) -> bool:
    """
    Validate if start and end dates are correct and if end is after start.
    """
    try:
        if start:
            start_date = start if isinstance(start, datetime) else datetime.fromisoformat(start)
        if end:
            end_date = end if isinstance(end, datetime) else datetime.fromisoformat(end)
            if start and end_date < start_date:
                return False
        return True
    except ValueError:
        return False
    
def get_user_template(template_id: int, db: Session = Depends(get_db)):
    """Fetch a User Template by its ID, raise 404 if not found."""
    dbuser_template = crud.get_user_template(db, template_id)
    if not dbuser_template:
        raise HTTPException(status_code=404, detail="User Template not found")
    return dbuser_template