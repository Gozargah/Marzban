from datetime import datetime as dt, timedelta as td, timezone as tz
from enum import IntEnum

from fastapi import HTTPException

from app.core.manager import core_manager
from app.db import AsyncSession
from app.db.crud import (
    get_admin,
    get_core_config_by_id,
    get_group_by_id,
    get_host_by_id,
    get_node_by_id,
    get_user,
    get_user_template,
)
from app.db.crud.user import get_user_by_id
from app.db.models import Admin as DBAdmin, CoreConfig, Group, Node, ProxyHost, User, UserTemplate
from app.models.admin import AdminDetails
from app.models.group import BulkGroup
from app.models.user import UserCreate, UserModify
from app.utils.helpers import fix_datetime_timezone
from app.utils.jwt import get_subscription_payload


class OperatorType(IntEnum):
    SYSTEM = 0
    API = 1
    WEB = 2
    CLI = 3
    TELEGRAM = 4
    DISCORD = 5


class BaseOperation:
    def __init__(self, operator_type: OperatorType):
        self.operator_type = operator_type

    async def raise_error(self, message: str, code: int, db: AsyncSession | None = None):
        """Raise an error based on the operator type."""
        if db:
            await db.rollback()
        if code <= 0:
            code = 408
        if self.operator_type in [OperatorType.API, OperatorType.WEB]:
            raise HTTPException(status_code=code, detail=str(message))
        else:
            raise ValueError(message)

    async def validate_dates(self, start: dt | None, end: dt | None) -> tuple[dt, dt]:
        """Validate if start and end dates are correct and if end is after start."""
        try:
            if start:
                start_date = fix_datetime_timezone(start)
            else:
                start_date = dt.now(tz.utc) - td(days=30)

            if end:
                end_date = fix_datetime_timezone(end)
            else:
                end_date = dt.now(tz.utc)

            # Compare dates only after both are set
            if end_date < start_date:
                await self.raise_error(message="Start date must be before end date", code=400)

            return start_date, end_date
        except ValueError:
            await self.raise_error(message="Invalid date range or format", code=400)

    async def get_validated_host(self, db: AsyncSession, host_id: int) -> ProxyHost:
        db_host = await get_host_by_id(db, host_id)
        if db_host is None:
            await self.raise_error(message="Host not found", code=404)
        return db_host

    async def get_validated_sub(self, db: AsyncSession, token: str) -> User:
        sub = await get_subscription_payload(token)
        if not sub:
            await self.raise_error(message="Not Found", code=404)

        db_user = await get_user(db, sub["username"])
        if not db_user or db_user.created_at.astimezone(tz.utc) > sub["created_at"]:
            await self.raise_error(message="Not Found", code=404)

        if db_user.sub_revoked_at and db_user.sub_revoked_at.astimezone(tz.utc) > sub["created_at"]:
            await self.raise_error(message="Not Found", code=404)

        return db_user

    async def get_validated_user(self, db: AsyncSession, username: str, admin: AdminDetails) -> User:
        db_user = await get_user(db, username)
        if not db_user:
            await self.raise_error(message="User not found", code=404)

        if not (admin.is_sudo or (db_user.admin and db_user.admin.username == admin.username)):
            await self.raise_error(message="You're not allowed", code=403)

        return db_user

    async def get_validated_user_by_id(self, db: AsyncSession, user_id: int, admin: AdminDetails) -> User:
        db_user = await get_user_by_id(db, user_id)
        if not db_user:
            await self.raise_error(message="User not found", code=404)

        if not (admin.is_sudo or (db_user.admin and db_user.admin.username == admin.username)):
            await self.raise_error(message="You're not allowed", code=403)

        return db_user

    async def get_validated_admin(self, db: AsyncSession, username: str) -> DBAdmin:
        db_admin = await get_admin(db, username)
        if not db_admin:
            await self.raise_error(message="Admin not found", code=404)
        return db_admin

    async def get_validated_group(self, db: AsyncSession, group_id: int) -> Group:
        db_group = await get_group_by_id(db, group_id)
        if not db_group:
            await self.raise_error("Group not found", 404)
        return db_group

    async def validate_all_groups(self, db, model: UserCreate | UserModify | UserTemplate | BulkGroup) -> list[Group]:
        all_groups: list[Group] = []
        if model.group_ids:
            for group_id in model.group_ids:
                db_group = await self.get_validated_group(db, group_id)
                all_groups.append(db_group)
        if hasattr(model, "has_group_ids") and model.has_group_ids:
            for group_id in model.has_group_ids:
                db_group = await self.get_validated_group(db, group_id)
                all_groups.append(db_group)
        return all_groups

    async def get_validated_user_template(self, db: AsyncSession, template_id: int) -> UserTemplate:
        dbuser_template = await get_user_template(db, template_id)
        if not dbuser_template:
            await self.raise_error("User Template not found", 404)
        return dbuser_template

    async def get_validated_node(self, db: AsyncSession, node_id) -> Node:
        """Dependency: Fetch node or return not found error."""
        db_node = await get_node_by_id(db, node_id)
        if not db_node:
            await self.raise_error(message="Node not found", code=404)
        return db_node

    async def check_inbound_tags(self, tags: list[str]) -> None:
        for tag in tags:
            if tag not in await core_manager.get_inbounds():
                await self.raise_error(f"{tag} not found", 400)

    async def get_validated_core_config(self, db: AsyncSession, core_id) -> CoreConfig:
        """Dependency: Fetch core config or return not found error."""
        db_core_config = await get_core_config_by_id(db, core_id)
        if not db_core_config:
            await self.raise_error(message="Core config not found", code=404)
        return db_core_config
