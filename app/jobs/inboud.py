from app import scheduler
from app.db import GetDB
from app.db.crud.host import get_inbounds_not_in_tags, remove_inbounds
from app.core.manager import core_manager
from app.utils.logger import get_logger
from config import JOB_REMOVE_OLD_INBOUNDS_INTERVAL


logger = get_logger("jobs")


async def remove_old_inbounds():
    in_use_inbounds = await core_manager.get_inbounds()

    async with GetDB() as db:
        old_inbounds = await get_inbounds_not_in_tags(db, in_use_inbounds)

        await remove_inbounds(db, old_inbounds)

        for inbound in old_inbounds:
            logger.info(f"inbound {inbound.tag} removed.")


scheduler.add_job(
    remove_old_inbounds, "interval", seconds=JOB_REMOVE_OLD_INBOUNDS_INTERVAL, coalesce=True, max_instances=1
)
