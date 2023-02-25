from sqlalchemy.orm import Session
from .base import Base, SessionLocal, engine  # noqa

from fastapi import Depends


class GetDB:  # Context Manager
    def __init__(self):
        self.db = SessionLocal()

    def __enter__(self):
        return self.db

    def __exit__(self, exc_type, exc_value, traceback):
        self.db.close()


def get_db():  # Dependency
    with GetDB() as db:
        yield db


from .models import User, System, JWT  # noqa
from .crud import (  # noqa
    get_or_create_inbound,
    get_user,
    get_user_by_id,
    get_users,
    get_users_count,
    create_user,
    remove_user,
    update_user,
    update_user_status,
    get_system_usage,
    get_jwt_secret_key,
    get_admin,
    create_admin,
    update_admin,
    remove_admin,
    get_admins
)


__all__ = [
    "get_or_create_inbound",
    "get_user",
    "get_user_by_id",
    "get_users",
    "get_users_count",
    "create_user",
    "remove_user",
    "update_user",
    "update_user_status",
    "get_system_usage",
    "get_jwt_secret_key",
    "get_admin",
    "create_admin",
    "update_admin",
    "remove_admin",
    "get_admins",

    "GetDB",
    "get_db",

    "User",
    "System",
    "JWT",

    "Base",
    "Session",
]
