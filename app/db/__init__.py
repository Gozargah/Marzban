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

    "GetDB",
    "get_db",

    "User",
    "System",
    "JWT",

    "Base",
    "Session",
]
