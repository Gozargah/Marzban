from datetime import timedelta
import asyncio

from . import BaseOperation
from app import __version__
from app.db import AsyncSession
from app.db.crud import get_system_usage, get_admin, get_users_count, count_online_users
from app.models.admin import AdminDetails
from app.models.system import SystemStats
from app.db.models import UserStatus
from app.utils.system import cpu_usage, memory_usage
from app.core.manager import core_manager


class SystemOperation(BaseOperation):
    @staticmethod
    async def get_system_stats(db: AsyncSession, admin: AdminDetails) -> SystemStats:
        """Fetch system stats including memory, CPU, and user metrics."""
        # Run sync functions
        mem = memory_usage()
        cpu = cpu_usage()

        system = await get_system_usage(db)
        db_admin = await get_admin(db, admin.username)

        admin_param = db_admin if (db_admin is not None) and (not admin.is_sudo) else None

        # Gather remaining async CRUD operations together
        (
            total_user,
            active_users,
            disabled_users,
            on_hold_users,
            expired_users,
            limited_users,
            online_users,
        ) = await asyncio.gather(
            get_users_count(db, admin=admin_param),
            get_users_count(db, status=UserStatus.active, admin=admin_param),
            get_users_count(db, status=UserStatus.disabled, admin=admin_param),
            get_users_count(db, status=UserStatus.on_hold, admin=admin_param),
            get_users_count(db, status=UserStatus.expired, admin=admin_param),
            get_users_count(db, status=UserStatus.limited, admin=admin_param),
            count_online_users(db, timedelta(minutes=2)),
        )

        return SystemStats(
            version=__version__,
            mem_total=mem.total,
            mem_used=mem.used,
            cpu_cores=cpu.cores,
            cpu_usage=cpu.percent,
            total_user=total_user,
            online_users=online_users,
            active_users=active_users,
            disabled_users=disabled_users,
            expired_users=expired_users,
            limited_users=limited_users,
            on_hold_users=on_hold_users,
            incoming_bandwidth=system.uplink,
            outgoing_bandwidth=system.downlink,
        )

    @staticmethod
    async def get_inbounds() -> list[str]:
        return await core_manager.get_inbounds()
