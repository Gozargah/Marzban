from sqlalchemy.exc import IntegrityError
import asyncio

from app.utils.logger import get_logger
from app.operation import BaseOperator
from app.models.admin import AdminDetails, AdminCreate, AdminModify
from app.db import AsyncSession
from app.db.models import Admin as DBAdmin
from app.db.crud import (
    create_admin,
    update_admin,
    remove_admin,
    get_admins,
    disable_all_active_users,
    activate_all_disabled_users,
    reset_admin_usage,
)
from app import notification

logger = get_logger("admin-operator")


class AdminOperation(BaseOperator):
    async def create_admin(self, db: AsyncSession, new_admin: AdminCreate, admin: AdminDetails) -> AdminDetails:
        """Create a new admin if the current admin has sudo privileges."""
        try:
            db_admin = await create_admin(db, new_admin)
        except IntegrityError:
            await db.rollback()
            self.raise_error(message="Admin already exists", code=409)

        logger.info(f'New admin "{db_admin.username}" with id "{db_admin.id}" added by admin "{admin.username}"')

        new_admin = AdminDetails.model_validate(db_admin)

        asyncio.create_task(notification.add_admin(new_admin, admin.username))

        return db_admin

    async def modify_admin(
        self, db: AsyncSession, username: str, modified_admin: AdminModify, current_admin: AdminDetails
    ) -> AdminDetails:
        """Modify an existing admin's details."""
        db_admin = await self.get_validated_admin(db, username=username)
        if (db_admin.username == current_admin.username) and db_admin.is_sudo:
            self.raise_error(
                message="You're not allowed to edit another sudoer's account. Use marzban-cli instead.", code=403
            )

        db_admin = await update_admin(db, db_admin, modified_admin)

        modified_admin = AdminDetails.model_validate(db_admin)

        asyncio.create_task(notification.modify_admin(modified_admin, current_admin.username))

        logger.info(f'Admin "{db_admin.username}" with id "{db_admin.id}" modified by admin "{current_admin.username}"')

        return modified_admin

    async def remove_admin(self, db: AsyncSession, username: str, current_admin: AdminDetails):
        """Remove an admin from the database."""
        db_admin = await self.get_validated_admin(db, username=username)
        if (db_admin.username == current_admin.username) and db_admin.is_sudo:
            self.raise_error(message="You're not allowed to delete sudo accounts. Use marzban-cli instead.", code=403)

        await remove_admin(db, db_admin)

        asyncio.create_task(notification.remove_admin(username, current_admin.username))

        logger.info(f'Admin "{db_admin.username}" with id "{db_admin.id}" deleted by admin "{current_admin.username}"')

    async def get_admins(
        self, db: AsyncSession, username: str | None = None, offset: int | None = None, limit: int | None = None
    ) -> list[DBAdmin]:
        return await get_admins(db, offset, limit, username)

    async def disable_all_active_users(self, db: AsyncSession, username: str, admin: AdminDetails):
        """Disable all active users under a specific admin"""
        db_admin = await self.get_validated_admin(db, username=username)

        if db_admin.is_sudo:
            self.raise_error(message="You're not allowed to disable sudo admin users.", code=403)

        await disable_all_active_users(db=db, admin_id=db_admin.id)

        # TODO: sync node users

        logger.info(f'Admin "{username}" users has been disabled by admin "{admin.username}"')

    async def activate_all_disabled_users(self, db: AsyncSession, username: str, admin: AdminDetails):
        """Enable all active users under a specific admin"""
        db_admin = await self.get_validated_admin(db, username=username)

        if db_admin.is_sudo:
            self.raise_error(message="You're not allowed to enable sudo admin users.", code=403)

        await activate_all_disabled_users(db=db, admin_id=db_admin.id)

        # TODO: sync node users

        logger.info(f'Admin "{username}" users has been activated by admin "{admin.username}"')

    async def reset_admin_usage(self, db: AsyncSession, username: str, admin: AdminDetails) -> AdminDetails:
        db_admin = await self.get_validated_admin(db, username=username)

        db_admin = await reset_admin_usage(db, db_admin=db_admin)

        logger.info(f'Admin "{username}" usage has been reset by admin "{admin.username}"')
        reseted_admin = AdminDetails.model_validate(db_admin)

        asyncio.create_task(notification.admin_usage_reset(reseted_admin, admin.username))

        return AdminDetails.model_validate(db_admin)
