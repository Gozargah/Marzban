from sqlalchemy import func, select, delete

from app import scheduler
from app.db import GetDB
from app.db.models import UserSubscriptionUpdate
from app.utils.logger import get_logger
from config import USER_SUBSCRIPTION_CLIENTS_LIMIT, JOB_CLEANUP_SUBSCRIPTION_UPDATES_INTERVAL

logger = get_logger("jobs")


async def cleanup_user_subscription_updates():
    """Clean up excess user subscription updates."""

    async with GetDB() as db:
        # First query: Find users that have more than the limit
        users_with_excess = await db.execute(
            select(UserSubscriptionUpdate.user_id)
            .group_by(UserSubscriptionUpdate.user_id)
            .having(func.count(UserSubscriptionUpdate.id) > USER_SUBSCRIPTION_CLIENTS_LIMIT)
        )
        user_ids = [row.user_id for row in users_with_excess]

        if not user_ids:
            logger.info("No users with excess subscription updates")
            return

        # Second query: Single DELETE to remove all excess records at once
        # Create alias for subquery
        sub = UserSubscriptionUpdate.__table__.alias("sub")

        # Subquery to get IDs to keep (top N per user)
        keep_subquery = (
            select(sub.c.id)
            .where(sub.c.user_id == UserSubscriptionUpdate.user_id)
            .order_by(sub.c.created_at.desc())
            .limit(USER_SUBSCRIPTION_CLIENTS_LIMIT)
        )

        result = await db.execute(
            delete(UserSubscriptionUpdate).where(
                UserSubscriptionUpdate.user_id.in_(user_ids), UserSubscriptionUpdate.id.not_in(keep_subquery)
            )
        )

        await db.commit()
        logger.info(f"Cleaned up {result.rowcount} old subscription updates")


if USER_SUBSCRIPTION_CLIENTS_LIMIT and USER_SUBSCRIPTION_CLIENTS_LIMIT >= 0:
    # Schedule the cleanup job to run every few minutes
    scheduler.add_job(
        cleanup_user_subscription_updates,
        "interval",
        seconds=JOB_CLEANUP_SUBSCRIPTION_UPDATES_INTERVAL,
        max_instances=1,
    )
