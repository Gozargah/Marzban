import asyncio

from app.db import AsyncSession
from app.db.crud.core import create_core_config, modify_core_config, remove_core_config, get_core_configs
from app.models.admin import AdminDetails
from app.models.core import CoreCreate, CoreResponseList, CoreResponse
from app.core.manager import core_manager
from app.operation import BaseOperation
from app import notification
from app.core.hosts import hosts as hosts_storage
from app.utils.logger import get_logger


logger = get_logger("core-operation")


class CoreOperation(BaseOperation):
    async def create_core(self, db: AsyncSession, new_core: CoreCreate, admin: AdminDetails) -> CoreResponse:
        try:
            core_manager.validate_core(new_core.config, new_core.fallbacks_inbound_tags, new_core.exclude_inbound_tags)
            db_core = await create_core_config(db, new_core)
        except Exception as e:
            await self.raise_error(message=e, code=400, db=db)

        await core_manager.update_core(db_core)
        logger.info(f'Core config "{db_core.id}" created by admin "{admin.username}"')

        core = CoreResponse.model_validate(db_core)
        asyncio.create_task(notification.create_core(core, admin.username))

        await hosts_storage.update(db)

        return core

    async def get_all_cores(self, db: AsyncSession, offset: int, limit: int) -> CoreResponseList:
        db_cores, count = await get_core_configs(db, offset, limit)
        return CoreResponseList(cores=db_cores, count=count)

    async def modify_core(
        self, db: AsyncSession, core_id: int, modified_core: CoreCreate, admin: AdminDetails
    ) -> CoreResponse:
        db_core = await self.get_validated_core_config(db, core_id)
        try:
            core_manager.validate_core(
                modified_core.config, modified_core.fallbacks_inbound_tags, modified_core.exclude_inbound_tags
            )
            db_core = await modify_core_config(db, db_core, modified_core)
        except Exception as e:
            await self.raise_error(message=e, code=400, db=db)

        await core_manager.update_core(db_core)

        logger.info(f'Core config "{db_core.name}" modified by admin "{admin.username}"')

        core = CoreResponse.model_validate(db_core)
        asyncio.create_task(notification.modify_core(core, admin.username))

        await hosts_storage.update(db)

        return core

    async def delete_core(self, db: AsyncSession, core_id: int, admin: AdminDetails) -> None:
        if core_id == 1:
            return await self.raise_error(message="Cannot delete default core config", code=403)

        db_core = await self.get_validated_core_config(db, core_id)

        await remove_core_config(db, db_core)
        await core_manager.remove_core(db_core.id)

        asyncio.create_task(notification.remove_core(db_core.id, admin.username))

        logger.info(f'core config "{db_core.name}" deleted by admin "{admin.username}"')

        await hosts_storage.update(db)
