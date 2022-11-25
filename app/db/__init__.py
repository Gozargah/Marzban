from sqlalchemy.orm import Session

from .models import User, System, JWT
from .crud import (
    get_user,
    get_user_by_id,
    get_users,
    create_user,
    remove_user,
    update_user,
    update_user_status,
    get_system_usage,
    get_jwt_secret_key
)

from .base import Base, SessionLocal, engine  # noqa


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


__all__ = [
    "get_user",
    "get_user_by_id",
    "get_users",
    "create_user",
    "remove_user",
    "update_user",
    "update_user_status",
    "get_system_usage",
    "get_jwt_secret_key",

    "get_db",

    "User",
    "System",
    "JWT",

    "Base",
    "Session",
]
