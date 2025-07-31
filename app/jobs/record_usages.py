import asyncio
from collections import defaultdict
from datetime import datetime as dt, timezone as tz
from operator import attrgetter

from GozargahNodeBridge import GozargahNode, NodeAPIError
from GozargahNodeBridge.common.service_pb2 import StatType
from sqlalchemy import and_, bindparam, insert, select, update
from sqlalchemy.exc import DatabaseError, OperationalError
from sqlalchemy.sql.expression import Insert

from app import scheduler
from app.db import AsyncSession, GetDB
from app.db.models import Admin, NodeUsage, NodeUserUsage, System, User
from app.node import node_manager as node_manager
from app.utils.logger import get_logger
from config import (
    DISABLE_RECORDING_NODE_USAGE,
    JOB_RECORD_NODE_USAGES_INTERVAL,
    JOB_RECORD_USER_USAGES_INTERVAL,
)

logger = get_logger("record-usages")


async def safe_execute(db: AsyncSession, stmt, params=None, max_retries: int = 3):
    """
    Safely execute database operations with deadlock and connection handling.

    Args:
        db (AsyncSession): Async database session
        stmt: SQLAlchemy statement to execute
        params (list[dict], optional): Parameters for the statement
        max_retries (int, optional): Maximum number of retry attempts
    """
    dialect = db.bind.dialect.name

    # MySQL-specific IGNORE prefix
    if dialect == "mysql" and isinstance(stmt, Insert):
        stmt = stmt.prefix_with("IGNORE")

    for attempt in range(max_retries):
        try:
            await (await db.connection()).execute(stmt, params)
            await db.commit()
            return
        except (OperationalError, DatabaseError) as err:
            # Rollback the session
            await db.rollback()

            # Specific error code handling
            if dialect == "mysql":
                # MySQL deadlock (Error 1213)
                if err.orig.args[0] == 1213 and attempt < max_retries - 1:
                    continue
            elif dialect == "postgresql":
                # PostgreSQL deadlock (Error 40P01)
                if err.orig.code == "40P01" and attempt < max_retries - 1:
                    continue
            elif dialect == "sqlite":
                # SQLite database locked error
                if "database is locked" in str(err) and attempt < max_retries - 1:
                    await asyncio.sleep(0.1 * (attempt + 1))  # Exponential backoff
                    continue

            # If we've exhausted retries or it's not a retriable error, raise
            raise


async def record_user_stats(params: list[dict], node_id: int, usage_coefficient: int = 1):
    """
    Record user statistics for a specific node.

    Args:
        params (list[dict]): User statistic parameters
        node_id (int): Node identifier
        usage_coefficient (int, optional): usage multiplier
    """
    if not params:
        return

    created_at = dt.now(tz.utc).replace(minute=0, second=0, microsecond=0)

    async with GetDB() as db:
        # Find existing user entries for this node and time
        select_stmt = select(NodeUserUsage.user_id).where(
            and_(NodeUserUsage.node_id == node_id, NodeUserUsage.created_at == created_at)
        )
        existing_users = set((await db.execute(select_stmt)).scalars().all())

        # Prepare new user entries
        new_users = [{"uid": int(p["uid"])} for p in params if int(p["uid"]) not in existing_users]

        # Insert missing user entries
        if new_users:
            insert_stmt = insert(NodeUserUsage).values(
                user_id=bindparam("uid"), created_at=created_at, node_id=node_id, used_traffic=0
            )
            await safe_execute(db, insert_stmt, new_users)

        # Update user traffic - ensure uid is converted to int
        update_params = [{"uid": int(p["uid"]), "value": p["value"]} for p in params]
        update_stmt = (
            update(NodeUserUsage)
            .values(used_traffic=NodeUserUsage.used_traffic + bindparam("value") * usage_coefficient)
            .where(
                and_(
                    NodeUserUsage.user_id == bindparam("uid"),
                    NodeUserUsage.node_id == node_id,
                    NodeUserUsage.created_at == created_at,
                )
            )
        )
        await safe_execute(db, update_stmt, update_params)


async def record_node_stats(params: dict, node_id: int):
    """
    Record node-level statistics.

    Args:
        params (Dict): Node statistic parameters
        node_id (int): Node identifier
    """
    if not params:
        return

    created_at = dt.now(tz.utc).replace(minute=0, second=0, microsecond=0)

    async with GetDB() as db:
        # Check if node usage entry exists
        select_stmt = select(NodeUsage.node_id).where(
            and_(NodeUsage.node_id == node_id, NodeUsage.created_at == created_at)
        )
        result = await db.execute(select_stmt)
        node_exists = result.scalar() is not None  # Correctly check if row exists

        # Insert node usage entry if not exists
        if not node_exists:
            insert_stmt = insert(NodeUsage).values(created_at=created_at, node_id=node_id, uplink=0, downlink=0)
            await safe_execute(db, insert_stmt)

        # Update node usage
        update_stmt = (
            update(NodeUsage)
            .values(uplink=NodeUsage.uplink + bindparam("up"), downlink=NodeUsage.downlink + bindparam("down"))
            .where(and_(NodeUsage.node_id == node_id, NodeUsage.created_at == created_at))
        )
        await safe_execute(db, update_stmt, params)


async def get_users_stats(node: GozargahNode):
    try:
        stats_respons = await node.get_stats(stat_type=StatType.UsersStat, reset=True, timeout=30)
        params = defaultdict(int)
        for stat in filter(attrgetter("value"), stats_respons.stats):
            params[stat.name.split(".", 1)[0]] += stat.value
        params = list({"uid": int(uid), "value": value} for uid, value in params.items())
        return params
    except NodeAPIError as e:
        logger.error("Failed to get outbounds stats, error: %s", e.detail)
        return []
    except Exception as e:
        logger.error("Failed to get outbounds stats, unknown error: %s", e)
        return []


async def get_outbounds_stats(node: GozargahNode):
    try:
        stats_respons = await node.get_stats(stat_type=StatType.Outbounds, reset=True, timeout=10)
        params = [
            {"up": stat.value, "down": 0} if stat.link == "uplink" else {"up": 0, "down": stat.value}
            for stat in filter(attrgetter("value"), stats_respons.stats)
        ]
        return params
    except NodeAPIError as e:
        logger.error("Failed to get outbounds stats, error: %s", e.detail)
        return []
    except Exception as e:
        logger.error("Failed to get outbounds stats, unknown error: %s", e)
        return []


async def calculate_admin_usage(users_usage: list) -> dict:
    if not users_usage:
        return {}

    # Get unique user IDs from users_usage
    uids = {int(user_usage["uid"]) for user_usage in users_usage}

    async with GetDB() as db:
        # Query only relevant users' admin IDs
        stmt = select(User.id, User.admin_id).where(User.id.in_(uids))
        result = await db.execute(stmt)
        user_admin_pairs = result.fetchall()

    user_admin_map = {uid: admin_id for uid, admin_id in user_admin_pairs}

    admin_usage = defaultdict(int)
    for user_usage in users_usage:
        admin_id = user_admin_map.get(int(user_usage["uid"]))
        if admin_id:
            admin_usage[admin_id] += user_usage["value"]

    return admin_usage


async def calculate_users_usage(api_params: dict, usage_coefficient: dict) -> list:
    """Calculate aggregated user usage across all nodes with coefficients applied"""
    users_usage = defaultdict(int)

    # Process all node data in a single pass
    for node_id, params in api_params.items():
        coeff = usage_coefficient.get(node_id, 1)
        # Use generator to avoid intermediate lists
        node_usage = ((int(param["uid"]), int(param["value"] * coeff)) for param in params)
        for uid, value in node_usage:
            users_usage[uid] += value

    return [{"uid": uid, "value": value} for uid, value in users_usage.items()]


async def record_user_usages():
    nodes: tuple[int, GozargahNode] = await node_manager.get_healthy_nodes()

    node_data = await asyncio.gather(*[asyncio.create_task(node.get_extra()) for _, node in nodes])
    usage_coefficient = {node_id: data.get("usage_coefficient", 1) for (node_id, _), data in zip(nodes, node_data)}

    stats_tasks = [asyncio.create_task(get_users_stats(node)) for _, node in nodes]
    await asyncio.gather(*stats_tasks)

    api_params = {nodes[i][0]: task.result() for i, task in enumerate(stats_tasks)}

    users_usage = await calculate_users_usage(api_params, usage_coefficient)
    if not users_usage:
        return

    async with GetDB() as db:
        user_stmt = (
            update(User)
            .where(User.id == bindparam("uid"))
            .values(used_traffic=User.used_traffic + bindparam("value"), online_at=dt.now(tz.utc))
            .execution_options(synchronize_session=False)
        )
        await safe_execute(db, user_stmt, users_usage)

        admin_usage = await calculate_admin_usage(users_usage)
        if admin_usage:
            admin_data = [{"admin_id": aid, "value": val} for aid, val in admin_usage.items()]
            admin_stmt = (
                update(Admin)
                .where(Admin.id == bindparam("admin_id"))
                .values(used_traffic=Admin.used_traffic + bindparam("value"))
                .execution_options(synchronize_session=False)
            )
            await safe_execute(db, admin_stmt, admin_data)

    if DISABLE_RECORDING_NODE_USAGE:
        return

    record_tasks = [
        asyncio.create_task(
            record_user_stats(params=api_params[node_id], node_id=node_id, usage_coefficient=usage_coefficient[node_id])
        )
        for node_id in api_params
    ]
    await asyncio.gather(*record_tasks)


async def record_node_usages():
    # Create tasks for all nodes
    tasks = {
        node_id: asyncio.create_task(get_outbounds_stats(node))
        for node_id, node in await node_manager.get_healthy_nodes()
    }

    await asyncio.gather(*tasks.values())

    api_params = {node_id: task.result() for node_id, task in tasks.items()}

    total_up = sum(sum(param["up"] for param in params) for params in api_params.values())
    total_down = sum(sum(param["down"] for param in params) for params in api_params.values())

    if not (total_up or total_down):
        return

    async with GetDB() as db:
        system_update_stmt = update(System).values(
            uplink=System.uplink + total_up, downlink=System.downlink + total_down
        )
        await safe_execute(db, system_update_stmt)

    if DISABLE_RECORDING_NODE_USAGE:
        return

    record_tasks = [asyncio.create_task(record_node_stats(params, node_id)) for node_id, params in api_params.items()]
    await asyncio.gather(*record_tasks)


scheduler.add_job(
    record_user_usages, "interval", seconds=JOB_RECORD_USER_USAGES_INTERVAL, coalesce=True, max_instances=1
)
scheduler.add_job(
    record_node_usages, "interval", seconds=JOB_RECORD_NODE_USAGES_INTERVAL, coalesce=True, max_instances=1
)
