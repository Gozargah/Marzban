from sqlalchemy.exc import IntegrityError

from app.db import AsyncSession
import asyncio

from app.db.models import Admin
from app.db.crud.user_template import (
    create_user_template,
    modify_user_template,
    remove_user_template,
    get_user_templates,
)
from app.operation import BaseOperation
from app.models.user_template import UserTemplateCreate, UserTemplateModify, UserTemplateResponse
from app.utils.logger import get_logger
from app import notification

logger = get_logger("user-template-operation")


class UserTemplateOperation(BaseOperation):
    async def create_user_template(
        self, db: AsyncSession, new_user_template: UserTemplateCreate, admin: Admin
    ) -> UserTemplateResponse:
        for group_id in new_user_template.group_ids:
            await self.get_validated_group(db, group_id)
        try:
            db_user_template = await create_user_template(db, new_user_template)
        except IntegrityError:
            await self.raise_error("Template by this name already exists", 409, db=db)

        user_template = UserTemplateResponse.model_validate(db_user_template)

        asyncio.create_task(notification.create_user_template(user_template, admin.username))

        logger.info(f'User template "{db_user_template.name}" created by admin "{admin.username}"')
        return db_user_template

    async def modify_user_template(
        self, db: AsyncSession, template_id: int, modified_user_template: UserTemplateModify, admin: Admin
    ) -> UserTemplateResponse:
        db_user_template = await self.get_validated_user_template(db, template_id)
        if modified_user_template.group_ids:
            for group_id in modified_user_template.group_ids:
                await self.get_validated_group(db, group_id)
        try:
            db_user_template = await modify_user_template(db, db_user_template, modified_user_template)
        except IntegrityError:
            await self.raise_error("Template by this name already exists", 409, db=db)

        user_template = UserTemplateResponse.model_validate(db_user_template)

        asyncio.create_task(notification.modify_user_template(user_template, admin.username))

        logger.info(f'User template "{db_user_template.name}" modified by admin "{admin.username}"')
        return db_user_template

    async def remove_user_template(self, db: AsyncSession, template_id: int, admin: Admin) -> None:
        db_user_template = await self.get_validated_user_template(db, template_id)
        await remove_user_template(db, db_user_template)
        logger.info(f'User template "{db_user_template.name}" deleted by admin "{admin.username}"')

        asyncio.create_task(notification.remove_user_template(db_user_template.name, admin.username))

    async def get_user_templates(
        self, db: AsyncSession, offset: int = None, limit: int = None
    ) -> list[UserTemplateResponse]:
        return await get_user_templates(db, offset, limit)
