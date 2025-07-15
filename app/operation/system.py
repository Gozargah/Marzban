import asyncio
from datetime import timedelta

from app import __version__
from app.core.manager import core_manager
from app.db import AsyncSession
from app.db.crud.admin import get_admin
from app.db.crud.general import get_system_usage
from app.db.crud.user import count_online_users, get_users_count
from app.db.models import UserStatus
from app.models.admin import AdminDetails
from app.models.system import SystemStats
from app.utils.system import cpu_usage, memory_usage

from . import BaseOperation


class SystemOperation(BaseOperation):
    @staticmethod
    async def get_system_stats(db: AsyncSession, admin: AdminDetails, admin_username: str | None = None) -> SystemStats:
        """Fetch system stats including memory, CPU, and user metrics."""
        # Run sync functions
        mem = memory_usage()
        cpu = cpu_usage()

        system = await get_system_usage(db)

        admin_param = None
        if admin.is_sudo and admin_username:
            admin_param = await get_admin(db, admin_username)
        elif not admin.is_sudo:
            admin_param = await get_admin(db, admin.username)

        admin_id = admin_param.id if admin_param else None
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
            get_users_count(db, None, admin_id),
            get_users_count(db, UserStatus.active, admin_id),
            get_users_count(db, UserStatus.disabled, admin_id),
            get_users_count(db, UserStatus.on_hold, admin_id),
            get_users_count(db, UserStatus.expired, admin_id),
            get_users_count(db, UserStatus.limited, admin_id),
            count_online_users(db, timedelta(minutes=2), admin_id),
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
