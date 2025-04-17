from datetime import datetime as dt
from datetime import timedelta, timezone
from enum import IntEnum

from fastapi import HTTPException

from app.db import AsyncSession
from app.db.crud import get_admin, get_group_by_id, get_host_by_id, get_user, get_user_template, get_node_by_id
from app.db.models import Admin as DBAdmin
from app.db.models import Group, ProxyHost, User, Node, UserTemplate
from app.models.admin import AdminDetails
from app.models.user import UserCreate, UserModify
from app import backend
from app.utils.jwt import get_subscription_payload


class OperatorType(IntEnum):
    SYSTEM = 0
    API = 1
    WEB = 2
    CLI = 3
    TELEGRAM = 4
    DISCORD = 5


class BaseOperator:
    def __init__(self, operator_type: OperatorType):
        self.operator_type = operator_type

    def raise_error(self, message: str, code: int):
        """Raise an error based on the operator type."""
        if code <= 0:
            code = 408
        if self.operator_type in (OperatorType.API, OperatorType.WEB):
            raise HTTPException(status_code=code, detail=message)
        else:
            raise ValueError(message)

    def validate_dates(self, start: str | dt | None, end: str | dt | None) -> tuple[dt, dt]:
        """Validate if start and end dates are correct and if end is after start."""
        try:
            if start:
                start_date = start if isinstance(start, dt) else dt.fromisoformat(start).astimezone(timezone.utc)
            else:
                start_date = dt.now(timezone.utc) - timedelta(days=30)
            if end:
                end_date = end if isinstance(end, dt) else dt.fromisoformat(end).astimezone(timezone.utc)
                if start_date and end_date < start_date:
                    self.raise_error(message="Start date must be before end date", code=400)
            else:
                end_date = dt.now(timezone.utc)

            return start_date, end_date
        except ValueError:
            self.raise_error(message="Invalid date range or format", code=400)

    async def get_validated_host(self, db: AsyncSession, host_id: int) -> ProxyHost:
        db_host = await get_host_by_id(db, host_id)
        if db_host is None:
            self.raise_error(message="Host not found", code=404)
        return db_host

    async def get_validated_sub(self, db: AsyncSession, token: str) -> User:
        sub = await get_subscription_payload(token)
        if not sub:
            self.raise_error(message="Not Found", code=404)

        db_user = await get_user(db, sub["username"])
        if not db_user or db_user.created_at.astimezone(timezone.utc) > sub["created_at"]:
            self.raise_error(message="Not Found", code=404)

        if db_user.sub_revoked_at and db_user.sub_revoked_at.astimezone(timezone.utc) > sub["created_at"]:
            self.raise_error(message="Not Found", code=404)

        return db_user

    async def get_validated_user(self, db: AsyncSession, username: str, admin: AdminDetails) -> User:
        db_user = await get_user(db, username)
        if not db_user:
            self.raise_error(message="User not found", code=404)

        if not (admin.is_sudo or (db_user.admin and db_user.admin.username == admin.username)):
            self.raise_error(message="You're not allowed", code=403)

        return db_user

    async def get_validated_admin(self, db: AsyncSession, username: str) -> DBAdmin:
        db_admin = await get_admin(db, username)
        if not db_admin:
            self.raise_error(message="Admin not found", code=404)
        return db_admin

    async def get_validated_group(self, db: AsyncSession, group_id: int) -> Group:
        db_group = await get_group_by_id(db, group_id)
        if not db_group:
            self.raise_error("Group not found", 404)
        return db_group

    async def validate_all_groups(self, db, user: UserCreate | UserModify) -> list[Group]:
        all_groups: list[Group] = []
        if user.group_ids:
            for group_id in user.group_ids:
                db_group = await self.get_validated_group(db, group_id)
                all_groups.append(db_group)
        return all_groups

    async def get_validated_user_template(self, db: AsyncSession, template_id: int) -> UserTemplate:
        dbuser_template = await get_user_template(db, template_id)
        if not dbuser_template:
            self.raise_error("User Template not found", 404)
        return dbuser_template

    async def get_validated_node(self, db: AsyncSession, node_id) -> Node:
        """Dependency: Fetch node or return not found error."""
        db_node = await get_node_by_id(db, node_id)
        if not db_node:
            self.raise_error(message="Node not found", code=404)
        return db_node

    async def check_inbound_tags(self, tags: list[str]) -> None:
        for tag in tags:
            if tag not in backend.config.inbounds:
                self.raise_error(f"{tag} not found", 400)
