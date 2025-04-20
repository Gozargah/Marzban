from datetime import timedelta
import asyncio

from . import BaseOperation
from app import __version__
from app.db import AsyncSession, crud
from app.models.admin import AdminDetails
from app.models.system import SystemStats
from app.db.models import UserStatus
from app.utils.system import cpu_usage, memory_usage, realtime_bandwidth
from app.core.manager import core_manager


class SystemOperation(BaseOperation):
    @staticmethod
    async def get_system_stats(db: AsyncSession, admin: AdminDetails) -> SystemStats:
        """Fetch system stats including memory, CPU, and user metrics."""
        # Run sync functions
        mem = memory_usage()
        cpu = cpu_usage()
        realtime_bandwidth_stats = realtime_bandwidth()

        system = await crud.get_system_usage(db)
        db_admin = await crud.get_admin(db, admin.username)

        admin_param = db_admin if (db_admin is not None) and (not admin.is_sudo) else None

        # Gather remaining async CRUD operations together
        (
            total_user,
            users_active,
            users_disabled,
            users_on_hold,
            users_expired,
            users_limited,
            online_users,
        ) = await asyncio.gather(
            crud.get_users_count(db, admin=admin_param),
            crud.get_users_count(db, status=UserStatus.active, admin=admin_param),
            crud.get_users_count(db, status=UserStatus.disabled, admin=admin_param),
            crud.get_users_count(db, status=UserStatus.on_hold, admin=admin_param),
            crud.get_users_count(db, status=UserStatus.expired, admin=admin_param),
            crud.get_users_count(db, status=UserStatus.limited, admin=admin_param),
            crud.count_online_users(db, timedelta(minutes=2)),
        )

        return SystemStats(
            version=__version__,
            mem_total=mem.total,
            mem_used=mem.used,
            cpu_cores=cpu.cores,
            cpu_usage=cpu.percent,
            total_user=total_user,
            online_users=online_users,
            users_active=users_active,
            users_disabled=users_disabled,
            users_expired=users_expired,
            users_limited=users_limited,
            users_on_hold=users_on_hold,
            incoming_bandwidth=system.uplink,
            outgoing_bandwidth=system.downlink,
            incoming_bandwidth_speed=realtime_bandwidth_stats.incoming_bytes,
            outgoing_bandwidth_speed=realtime_bandwidth_stats.outgoing_bytes,
        )

    @staticmethod
    async def get_inbounds() -> list[str]:
        return await core_manager.get_inbounds()
