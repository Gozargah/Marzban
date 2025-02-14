from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from datetime import datetime, UTC
from operator import attrgetter
from typing import Dict, List, Optional, Generator, Any, TypeVar

from pymysql.err import OperationalError
from sqlalchemy import and_, bindparam, insert, select, update
from sqlalchemy.orm import Session
from sqlalchemy.sql.dml import Insert

from app import scheduler, xray
from app.db import GetDB
from app.db.models import Admin, NodeUsage, NodeUserUsage, System, User
from app import logger
from config import (
    DISABLE_RECORDING_NODE_USAGE,
    JOB_RECORD_NODE_USAGES_INTERVAL,
    JOB_RECORD_USER_USAGES_INTERVAL,
)
from xray_api import XRay as XRayAPI
from xray_api import exc as xray_exc


BATCH_SIZE = 1000

KT = TypeVar("KT")

class StatsCollector:
    def __init__(self, timeout: int = 10):
        self.timeout = timeout

    def get_users_stats(self, api: XRayAPI) -> List[dict]:
        try:
            params = defaultdict(int)
            stats = api.get_users_stats(reset=True, timeout=self.timeout)
            for stat in filter(attrgetter("value"), stats):
                try:
                    uid = int(stat.name.split(".", 1)[0])
                    params[uid] += stat.value
                except Exception as e:
                    logger.error(f"Error processing user stat for {stat.name}: {e}")
                    continue
            return [{"uid": uid, "value": value} for uid, value in params.items()]
        except xray_exc.XrayError as e:
            logger.error(f"XRay API error in get_users_stats: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in get_users_stats: {e}")
            return []

    def get_outbounds_stats(self, api: XRayAPI) -> List[dict]:
        try:
            result = []
            stats = api.get_outbounds_stats(reset=True, timeout=self.timeout)
            for stat in filter(attrgetter("value"), stats):
                if stat.link == "uplink":
                    result.append({"up": stat.value, "down": 0})
                else:
                    result.append({"up": 0, "down": stat.value})
            return result
        except xray_exc.XrayError as e:
            logger.error(f"XRay API error in get_outbounds_stats: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in get_outbounds_stats: {e}")
            return []


class DBManager:
    @staticmethod
    def safe_execute(db: Session, stmt, params=None):
        try:
            if db.bind.name == "mysql" or db.bind.name == "mariadb":
                if isinstance(stmt, Insert):
                    stmt = stmt.prefix_with("IGNORE")

                for attempt in range(3):
                    try:
                        db.execute(stmt, params)
                        db.commit()
                        return
                    except OperationalError as err:
                        if err.args[0] == 1213 and attempt < 2:
                            db.rollback()
                            logger.warning(f"Deadlock detected, retry {attempt + 1}")
                            continue
                        raise err
            else:  # sqlite
                db.execute(stmt, params)
                db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Database error: {e}")
            raise

    @staticmethod
    def update_user_stats(
        db: Session,
        params: List[dict],
        node_id: Optional[int],
        created_at: datetime,
        consumption_factor: int = 1,
    ):
        if not params:
            return

        select_stmt = select(NodeUserUsage.user_id).where(
            and_(
                (NodeUserUsage.node_id.is_(None) if node_id is None else NodeUserUsage.node_id == node_id),
                NodeUserUsage.created_at == created_at
            )
        )
        existing_users = {r[0] for r in db.execute(select_stmt).fetchall()}

        new_users = [
            {"uid": int(p["uid"])}
            for p in params
            if int(p["uid"]) not in existing_users
        ]
        if new_users:
            stmt = insert(NodeUserUsage).values(
                user_id=bindparam("uid"),
                created_at=created_at,
                node_id=node_id,
                used_traffic=0,
            )
            DBManager.safe_execute(db, stmt, new_users)

        stmt = (
            update(NodeUserUsage)
            .values(
                used_traffic=NodeUserUsage.used_traffic
                + bindparam("value") * consumption_factor
            )
            .where(
                and_(
                    NodeUserUsage.user_id == bindparam("uid"),
                    (NodeUserUsage.node_id.is_(None) if node_id is None else NodeUserUsage.node_id == node_id),
                    NodeUserUsage.created_at == created_at,
                )
            )
            .execution_options(synchronize_session=False)
        )
        DBManager.safe_execute(db, stmt, params)

    @staticmethod
    def update_node_stats(
        db: Session, params: List[dict], node_id: Optional[int], created_at: datetime
    ):
        if not params:
            return

        select_stmt = select(NodeUsage.node_id).where(
            and_(
                (
                    NodeUsage.node_id.is_(node_id)
                    if node_id is None
                    else NodeUsage.node_id == node_id
                ),
                NodeUsage.created_at == created_at,
            )
        )

        if db.execute(select_stmt).first() is None:
            stmt = insert(NodeUsage).values(
                created_at=created_at, node_id=node_id, uplink=0, downlink=0
            )
            DBManager.safe_execute(db, stmt)

        total_up = sum(p["up"] for p in params)
        total_down = sum(p["down"] for p in params)

        stmt = (
            update(NodeUsage)
            .values(
                uplink=NodeUsage.uplink + total_up,
                downlink=NodeUsage.downlink + total_down,
            )
            .where(
                and_((NodeUsage.node_id.is_(None) if node_id is None else NodeUsage.node_id == node_id),
                     NodeUsage.created_at == created_at)
            )
            .execution_options(synchronize_session=False)
        )
        DBManager.safe_execute(db, stmt)


class UsageRecorder:
    def __init__(self, max_workers=15, timeout=10):
        self.stats_collector = StatsCollector(timeout=timeout)
        self.db_manager = DBManager()
        self.max_workers = max_workers
        self.timeout = timeout

    def collect_stats(
        self,
        api_instances: Dict[Optional[int], XRayAPI],
    ) -> tuple:
        worker_count = min(self.max_workers, len(api_instances))

        with ThreadPoolExecutor(max_workers=worker_count) as executor:
            user_futures = {}
            traffic_futures = {}

            for node_id, api in api_instances.items():
                if api:
                    user_futures[
                        executor.submit(self.stats_collector.get_users_stats, api)
                    ] = node_id
                    traffic_futures[
                        executor.submit(self.stats_collector.get_outbounds_stats, api)
                    ] = node_id

            user_stats = {}
            traffic_stats = {}

            for future in user_futures:
                try:
                    node_id = user_futures[future]
                    result = future.result(timeout=self.timeout + 5)
                    if result:
                        user_stats[node_id] = result
                except TimeoutError:
                    logger.error(f"Timeout collecting user stats for node {node_id}")
                except Exception as e:
                    logger.error(f"Error collecting user stats for node {node_id}: {e}")
                    continue

            for future in traffic_futures:
                try:
                    node_id = traffic_futures[future]
                    result = future.result(timeout=self.timeout + 5)
                    if result:
                        traffic_stats[node_id] = result
                except TimeoutError:
                    logger.error(f"Timeout collecting traffic stats for node {node_id}")
                except Exception as e:
                    logger.error(
                        f"Error collecting traffic stats for node {node_id}: {e}"
                    )
                    continue

        return user_stats, traffic_stats

    def process_user_stats(
        self, user_stats: Dict, usage_coefficients: Dict
    ) -> Generator[tuple[list[dict[str, int | Any]], dict[_KT, int]], None, None]:
        users_usage = defaultdict(int)

        for node_id, stats in user_stats.items():
            coefficient = usage_coefficients.get(node_id, 1)
            for stat in stats:
                users_usage[int(stat["uid"])] += int(stat["value"] * coefficient)

        users_batch = []
        admin_usage = defaultdict(int)

        with GetDB() as db:
            user_admin_map = dict(db.query(User.id, User.admin_id).all())

            for uid, value in users_usage.items():
                users_batch.append({"uid": int(uid), "value": value})

                admin_id = user_admin_map.get(int(uid))
                if admin_id is not None:
                    admin_usage[admin_id] += value

                if len(users_batch) >= BATCH_SIZE:
                    yield users_batch, dict(admin_usage)
                    users_batch = []
                    admin_usage.clear()

            if users_batch:
                yield users_batch, dict(admin_usage)


def record_user_usages():
    try:
        api_instances = {None: xray.api}
        usage_coefficient = {None: 1}

        for node_id, node in list(xray.nodes.items()):
            if node.connected and node.started:
                if node_id is not None:
                    api_instances[node_id] = node.api
                    usage_coefficient[node_id] = node.usage_coefficient

        recorder = UsageRecorder()

        user_stats, _ = recorder.collect_stats(api_instances)

        created_at = datetime.fromisoformat(
            datetime.now(UTC).strftime("%Y-%m-%dT%H:00:00")
        )

        for users_batch, admin_batch_usage in recorder.process_user_stats(
            user_stats, usage_coefficient
        ):
            if not users_batch:
                continue

            with GetDB() as db:
                stmt = (
                    update(User)
                    .where(User.id == bindparam("uid"))
                    .values(
                        used_traffic=User.used_traffic + bindparam("value"),
                        online_at=datetime.now(UTC),
                    )
                    .execution_options(synchronize_session=False)
                )
                DBManager.safe_execute(db, stmt, users_batch)

                if admin_batch_usage:
                    admin_data = [
                        {"admin_id": admin_id, "value": value}
                        for admin_id, value in admin_batch_usage.items()
                    ]
                    stmt = (
                        update(Admin)
                        .where(Admin.id == bindparam("admin_id"))
                        .values(users_usage=Admin.users_usage + bindparam("value"))
                        .execution_options(synchronize_session=False)
                    )
                    DBManager.safe_execute(db, stmt, admin_data)

        if not DISABLE_RECORDING_NODE_USAGE:
            with GetDB() as db:
                for node_id, stats in user_stats.items():
                    DBManager.update_user_stats(
                        db, stats, node_id, created_at, usage_coefficient[node_id]
                    )

    except Exception as e:
        logger.error(f"Error in record_user_usages: {e}")
        raise


def record_node_usages():
    try:
        api_instances = {None: xray.api}
        for node_id, node in list(xray.nodes.items()):
            if node.connected and node.started:
                api_instances[node_id] = node.api

        recorder = UsageRecorder()

        _, traffic_stats = recorder.collect_stats(api_instances)

        total_up = total_down = 0
        for stats in traffic_stats.values():
            for stat in stats:
                total_up += stat["up"]
                total_down += stat["down"]

        if not (total_up or total_down):
            return

        created_at = datetime.fromisoformat(
            datetime.now(UTC).strftime("%Y-%m-%dT%H:00:00")
        )

        with GetDB() as db:
            stmt = update(System).values(
                uplink=System.uplink + total_up, downlink=System.downlink + total_down
            ).execution_options(synchronize_session=False)
            DBManager.safe_execute(db, stmt)

        if not DISABLE_RECORDING_NODE_USAGE:
            with GetDB() as db:
                for node_id, stats in traffic_stats.items():
                    DBManager.update_node_stats(db, stats, node_id, created_at)

    except Exception as e:
        logger.error(f"Error in record_node_usages: {e}")
        raise


scheduler.add_job(
    record_user_usages,
    "interval",
    seconds=JOB_RECORD_USER_USAGES_INTERVAL,
    coalesce=True,
    max_instances=1,
)

scheduler.add_job(
    record_node_usages,
    "interval",
    seconds=JOB_RECORD_NODE_USAGES_INTERVAL,
    coalesce=True,
    max_instances=1,
)
