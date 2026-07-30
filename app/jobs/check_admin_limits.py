from datetime import datetime

from app import logger, scheduler, xray
from app.db import GetDB, crud
from app.db.models import Admin as DBAdmin
from app.db.models import User
from app.models.user import UserStatus


def check_admin_limits():
    """
    Disables all of an admin's users once that admin's total traffic usage
    reaches users_usage_limit, or once expire_date has passed.
    """
    with GetDB() as db:
        admins = db.query(DBAdmin).filter(
            DBAdmin.users_usage_limit.isnot(None) | DBAdmin.expire_date.isnot(None)
        ).all()

        now = datetime.utcnow()
        restart_needed = False

        for admin in admins:
            usage_exceeded = admin.users_usage_limit is not None and admin.users_usage >= admin.users_usage_limit
            expired = admin.expire_date is not None and admin.expire_date <= now
            if not (usage_exceeded or expired):
                continue

            has_active_users = db.query(User).filter(
                User.admin_id == admin.id,
                User.status.in_((UserStatus.active, UserStatus.on_hold)),
            ).first()
            if not has_active_users:
                continue

            crud.disable_all_active_users(db, admin)
            restart_needed = True
            reason = "reached its usage limit" if usage_exceeded else "expired"
            logger.info(f'Admin "{admin.username}" {reason}, all of its users were disabled')

        if restart_needed:
            startup_config = xray.config.include_db_users()
            xray.core.restart(startup_config)
            for node_id, node in list(xray.nodes.items()):
                if node.connected:
                    xray.operations.restart_node(node_id, startup_config)


scheduler.add_job(check_admin_limits, 'interval', coalesce=True, minutes=5, max_instances=1)
