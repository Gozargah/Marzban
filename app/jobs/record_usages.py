import logging
import time
import random
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from operator import attrgetter
from typing import Union

from pymysql.err import OperationalError
from sqlalchemy import and_, bindparam, insert, select, text, update
from sqlalchemy.orm import Session
from sqlalchemy.sql.dml import Insert

from app import scheduler, xray
from app.db import GetDB
from app.db.models import Admin, NodeUsage, NodeUserUsage, System, User

logger = logging.getLogger("uvicorn.error")
from config import (
    DISABLE_RECORDING_NODE_USAGE,
    JOB_RECORD_NODE_USAGES_INTERVAL,
    JOB_RECORD_USER_USAGES_INTERVAL,
)
from xray_api import XRay as XRayAPI
from xray_api import exc as xray_exc


def safe_execute(db: Session, stmt, params=None):
    """Execute a statement with deadlock retry (MySQL only)."""
    if db.bind.name == 'mysql':
        if isinstance(stmt, Insert):
            stmt = stmt.prefix_with('IGNORE')

        tries = 0
        while True:
            try:
                db.connection().execute(stmt, params)
                db.commit()
                return
            except OperationalError as err:
                if err.args[0] == 1213 and tries < 5:   # Deadlock — retry with backoff
                    db.rollback()
                    tries += 1
                    time.sleep(0.05 * tries + random.uniform(0, 0.03))
                    continue
                raise
    else:
        db.connection().execute(stmt, params)
        db.commit()


def _filter_valid_uids(db, params: list) -> list:
    """
    Remove entries whose uid no longer exists in the users table.

    Xray keeps deleted users in memory until the process restarts (or until
    remove_inbound_user is called). If a user is deleted from Marzban before
    Xray flushes them, the next traffic-recording cycle will try to INSERT a
    node_user_usages row with a user_id that violates the FK constraint.
    This filter prevents that IntegrityError (1452).
    """
    uid_set = {int(p['uid']) for p in params}
    valid_uids = {
        row[0]
        for row in db.query(User.id).filter(User.id.in_(uid_set)).all()
    }
    stale = uid_set - valid_uids
    if stale:
        logger.warning(
            "record_user_stats: skipping %d stale Xray user ID(s) not found "
            "in users table (deleted users still in Xray memory): %s",
            len(stale),
            sorted(stale),
        )
    return [p for p in params if int(p['uid']) in valid_uids]


def record_user_stats(params: list, node_id: Union[int, None],
                      consumption_factor: int = 1):
    """Record per-node per-user traffic into node_user_usages."""
    if not params:
        return

    created_at = datetime.fromisoformat(datetime.utcnow().strftime('%Y-%m-%dT%H:00:00'))

    # Sort by uid to guarantee consistent lock-acquisition order across concurrent
    # transactions → eliminates the most common cause of InnoDB deadlocks.
    params = sorted(params, key=lambda x: int(x['uid']))

    with GetDB() as db:
        # Drop UIDs that no longer exist in the users table (deleted users that
        # Xray still holds in memory). Without this filter the INSERT below
        # raises IntegrityError 1452 (FK constraint on node_user_usages.user_id).
        params = _filter_valid_uids(db, params)
        if not params:
            return

        if db.bind.name == 'mysql':
            # INSERT IGNORE silently skips any remaining FK violations as a
            # safety net; ON DUPLICATE KEY UPDATE handles the hourly-bucket case.
            sql = text("""
                INSERT IGNORE INTO node_user_usages (user_id, created_at, node_id, used_traffic)
                VALUES (:uid, :created_at, :node_id, :value)
                ON DUPLICATE KEY UPDATE used_traffic = used_traffic + VALUES(used_traffic)
            """)
            upsert_params = [
                {
                    'uid': int(p['uid']),
                    'created_at': created_at,
                    'node_id': node_id,
                    'value': int(p['value'] * consumption_factor),
                }
                for p in params
            ]
            safe_execute(db, sql, upsert_params)

        else:
            # SQLite: no ON DUPLICATE KEY — keep original three-step approach.
            select_stmt = select(NodeUserUsage.user_id) \
                .where(and_(NodeUserUsage.node_id == node_id,
                            NodeUserUsage.created_at == created_at))
            existings = {r[0] for r in db.execute(select_stmt).fetchall()}
            uids_to_insert = sorted(
                {int(p['uid']) for p in params} - existings
            )

            if uids_to_insert:
                stmt = insert(NodeUserUsage).values(
                    user_id=bindparam('uid'),
                    created_at=created_at,
                    node_id=node_id,
                    used_traffic=0,
                )
                safe_execute(db, stmt, [{'uid': uid} for uid in uids_to_insert])

            stmt = update(NodeUserUsage) \
                .values(used_traffic=NodeUserUsage.used_traffic
                        + bindparam('value') * consumption_factor) \
                .where(and_(NodeUserUsage.user_id == bindparam('uid'),
                            NodeUserUsage.node_id == node_id,
                            NodeUserUsage.created_at == created_at))
            safe_execute(db, stmt, params)


def record_node_stats(params: dict, node_id: Union[int, None]):
    if not params:
        return

    created_at = datetime.fromisoformat(datetime.utcnow().strftime('%Y-%m-%dT%H:00:00'))

    with GetDB() as db:
        select_stmt = select(NodeUsage.node_id). \
            where(and_(NodeUsage.node_id == node_id, NodeUsage.created_at == created_at))
        notfound = db.execute(select_stmt).first() is None
        if notfound:
            stmt = insert(NodeUsage).values(
                created_at=created_at, node_id=node_id, uplink=0, downlink=0)
            safe_execute(db, stmt)

        stmt = update(NodeUsage). \
            values(uplink=NodeUsage.uplink + bindparam('up'),
                   downlink=NodeUsage.downlink + bindparam('down')). \
            where(and_(NodeUsage.node_id == node_id,
                       NodeUsage.created_at == created_at))
        safe_execute(db, stmt, params)


def get_users_stats(api: XRayAPI):
    try:
        params = defaultdict(int)
        for stat in filter(attrgetter('value'), api.get_users_stats(reset=True, timeout=30)):
            params[stat.name.split('.', 1)[0]] += stat.value
        params = list({"uid": uid, "value": value} for uid, value in params.items())
        return params
    except xray_exc.XrayError:
        return []


def get_outbounds_stats(api: XRayAPI):
    try:
        params = [{"up": stat.value, "down": 0} if stat.link == "uplink"
                  else {"up": 0, "down": stat.value}
                  for stat in filter(attrgetter('value'),
                                     api.get_outbounds_stats(reset=True, timeout=10))]
        return params
    except xray_exc.XrayError:
        return []


def record_user_usages():
    api_instances = {None: xray.api}
    usage_coefficient = {None: 1}

    for node_id, node in list(xray.nodes.items()):
        if node.connected and node.started:
            api_instances[node_id] = node.api
            usage_coefficient[node_id] = node.usage_coefficient

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {node_id: executor.submit(get_users_stats, api)
                   for node_id, api in api_instances.items()}
    api_params = {node_id: future.result() for node_id, future in futures.items()}

    users_usage = defaultdict(int)
    for node_id, params in api_params.items():
        coefficient = usage_coefficient.get(node_id, 1)
        for param in params:
            users_usage[param['uid']] += int(param['value'] * coefficient)

    users_usage = sorted(
        ({"uid": uid, "value": value} for uid, value in users_usage.items()),
        key=lambda x: int(x['uid']),
    )
    if not users_usage:
        return

    _report_xray_traffic_to_monitoring(users_usage)

    with GetDB() as db:
        user_admin_map = dict(db.query(User.id, User.admin_id).all())

    admin_usage: dict[int, int] = defaultdict(int)
    for user_usage in users_usage:
        admin_id = user_admin_map.get(int(user_usage["uid"]))
        if admin_id:
            admin_usage[admin_id] += user_usage["value"]

    with GetDB() as db:
        stmt = update(User) \
            .where(User.id == bindparam('uid')) \
            .values(
                used_traffic=User.used_traffic + bindparam('value'),
                online_at=datetime.utcnow(),
            )
        safe_execute(db, stmt, users_usage)

        # Sort admin_data by admin_id for consistent lock order
        admin_data = sorted(
            ({"admin_id": aid, "value": val} for aid, val in admin_usage.items()),
            key=lambda x: x['admin_id'],
        )
        if admin_data:
            admin_update_stmt = update(Admin) \
                .where(Admin.id == bindparam('admin_id')) \
                .values(users_usage=Admin.users_usage + bindparam('value'))
            safe_execute(db, admin_update_stmt, admin_data)

    if DISABLE_RECORDING_NODE_USAGE:
        return

    for node_id, params in api_params.items():
        record_user_stats(params, node_id, usage_coefficient[node_id])


def record_node_usages():
    api_instances = {None: xray.api}
    for node_id, node in list(xray.nodes.items()):
        if node.connected and node.started:
            api_instances[node_id] = node.api

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {node_id: executor.submit(get_outbounds_stats, api)
                   for node_id, api in api_instances.items()}
    api_params = {node_id: future.result() for node_id, future in futures.items()}

    total_up = 0
    total_down = 0
    for node_id, params in api_params.items():
        for param in params:
            total_up += param['up']
            total_down += param['down']
    if not (total_up or total_down):
        return

    with GetDB() as db:
        stmt = update(System).values(
            uplink=System.uplink + total_up,
            downlink=System.downlink + total_down,
        )
        safe_execute(db, stmt)

    if DISABLE_RECORDING_NODE_USAGE:
        return

    for node_id, params in api_params.items():
        record_node_stats(params, node_id)


def _report_xray_traffic_to_monitoring(users_usage: list):
    """Feed per-protocol traffic data into the monitoring service."""
    try:
        from app.monitoring import monitoring
        from app.db import GetDB
        from app.db import models as db_models
        from sqlalchemy import func as sa_func

        uid_set = {int(u["uid"]) for u in users_usage}
        uid_traffic = {int(u["uid"]): int(u["value"]) for u in users_usage}

        total_xray_bytes = sum(uid_traffic.values())

        with GetDB() as db:
            rows = (
                db.query(
                    db_models.Proxy.user_id,
                    sa_func.upper(db_models.Proxy.type),
                )
                .filter(db_models.Proxy.user_id.in_(uid_set))
                .all()
            )

        proto_map = {
            "VLESS": "vless", "VMESS": "vmess",
            "TROJAN": "trojan", "SHADOWSOCKS": "shadowsocks",
        }
        user_protocols: dict[int, set] = {}
        for user_id, ptype in rows:
            key = proto_map.get(ptype)
            if key:
                user_protocols.setdefault(user_id, set()).add(key)

        proto_traffic: dict[str, int] = {}
        proto_users: dict[str, int] = {}
        for uid, traffic in uid_traffic.items():
            protos = user_protocols.get(uid, set())
            if not protos:
                continue
            share = traffic // len(protos)
            for p in protos:
                proto_traffic[p] = proto_traffic.get(p, 0) + share
                proto_users[p] = proto_users.get(p, 0) + 1

        for proto, traffic in proto_traffic.items():
            monitoring.record_xray_traffic(proto, traffic, proto_users.get(proto, 0))

    except Exception:
        pass


scheduler.add_job(record_user_usages, 'interval',
                  seconds=JOB_RECORD_USER_USAGES_INTERVAL,
                  coalesce=True, max_instances=1)
scheduler.add_job(record_node_usages, 'interval',
                  seconds=JOB_RECORD_NODE_USAGES_INTERVAL,
                  coalesce=True, max_instances=1)
