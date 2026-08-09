from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from operator import attrgetter
from typing import Union

from pymysql.err import OperationalError
from sqlalchemy import and_, bindparam, insert, or_, select, update
from sqlalchemy.orm import Session
from sqlalchemy.sql.dml import Insert

from app import logger, scheduler, xray
from app.db import GetDB, crud
from app.db.models import (Admin, HostGroup, NodeUsage, NodeUserUsage, System,
                           User, UserGroupUsage)
from config import (
    DISABLE_RECORDING_NODE_USAGE,
    GROUP_LIMIT_HARD_ENFORCE,
    JOB_ENFORCE_GROUP_LIMITS_INTERVAL,
    JOB_RECORD_NODE_USAGES_INTERVAL,
    JOB_RECORD_USER_USAGES_INTERVAL,
)
from xray_api import XRay as XRayAPI
from xray_api import exc as xray_exc


def safe_execute(db: Session, stmt, params=None):
    # SQLite contention is handled at the engine level (WAL + busy_timeout in
    # app/db/base.py), so no app-side retry loop here — that only worsened
    # writer contention. MySQL keeps its deadlock retry.
    if db.bind.name == 'mysql':
        if isinstance(stmt, Insert):
            stmt = stmt.prefix_with('IGNORE')

        tries = 0
        done = False
        while not done:
            try:
                db.connection().execute(stmt, params)
                db.commit()
                done = True
            except OperationalError as err:
                if err.args[0] in (1213, 1205) and tries < 3:  # deadlock / lock wait
                    db.rollback()
                    tries += 1
                    continue
                raise err

    else:
        db.connection().execute(stmt, params)
        db.commit()


def record_user_stats(params: list, node_id: Union[int, None],
                      consumption_factor: int = 1):
    if not params:
        return

    created_at = datetime.fromisoformat(datetime.utcnow().strftime('%Y-%m-%dT%H:00:00'))

    with GetDB() as db:
        # make user usage row if doesn't exist
        select_stmt = select(NodeUserUsage.user_id) \
            .where(and_(NodeUserUsage.node_id == node_id, NodeUserUsage.created_at == created_at))
        existings = [r[0] for r in db.execute(select_stmt).fetchall()]
        uids_to_insert = set()

        for p in params:
            uid = int(p['uid'])
            if uid in existings:
                continue
            uids_to_insert.add(uid)

        if uids_to_insert:
            stmt = insert(NodeUserUsage).values(
                user_id=bindparam('uid'),
                created_at=created_at,
                node_id=node_id,
                used_traffic=0
            )
            safe_execute(db, stmt, [{'uid': uid} for uid in uids_to_insert])

        # record
        stmt = update(NodeUserUsage) \
            .values(used_traffic=NodeUserUsage.used_traffic + bindparam('value') * consumption_factor) \
            .where(and_(NodeUserUsage.user_id == bindparam('uid'),
                        NodeUserUsage.node_id == node_id,
                        NodeUserUsage.created_at == created_at))
        safe_execute(db, stmt, params)


def record_node_stats(params: dict, node_id: Union[int, None]):
    if not params:
        return

    created_at = datetime.fromisoformat(datetime.utcnow().strftime('%Y-%m-%dT%H:00:00'))

    with GetDB() as db:

        # make node usage row if doesn't exist
        select_stmt = select(NodeUsage.node_id). \
            where(and_(NodeUsage.node_id == node_id, NodeUsage.created_at == created_at))
        notfound = db.execute(select_stmt).first() is None
        if notfound:
            stmt = insert(NodeUsage).values(created_at=created_at, node_id=node_id, uplink=0, downlink=0)
            safe_execute(db, stmt)

        # record
        stmt = update(NodeUsage). \
            values(uplink=NodeUsage.uplink + bindparam('up'), downlink=NodeUsage.downlink + bindparam('down')). \
            where(and_(NodeUsage.node_id == node_id, NodeUsage.created_at == created_at))

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
        params = [{"up": stat.value, "down": 0} if stat.link == "uplink" else {"up": 0, "down": stat.value}
                  for stat in filter(attrgetter('value'), api.get_outbounds_stats(reset=True, timeout=10))]
        return params
    except xray_exc.XrayError:
        return []


def record_user_usages():
    api_instances = {None: xray.api}
    usage_coefficient = {None: 1}  # default usage coefficient for the main api instance

    for node_id, node in list(xray.nodes.items()):
        if node.connected and node.started:
            api_instances[node_id] = node.api
            usage_coefficient[node_id] = node.usage_coefficient  # fetch the usage coefficient

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {node_id: executor.submit(get_users_stats, api) for node_id, api in api_instances.items()}
    api_params = {node_id: future.result() for node_id, future in futures.items()}

    users_usage = defaultdict(int)
    for node_id, params in api_params.items():
        coefficient = usage_coefficient.get(node_id, 1)  # get the usage coefficient for the node
        for param in params:
            users_usage[param['uid']] += int(param['value'] * coefficient)  # apply the usage coefficient
    users_usage = list({"uid": uid, "value": value} for uid, value in users_usage.items())
    if not users_usage:
        return

    with GetDB() as db:
        user_admin_map = dict(db.query(User.id, User.admin_id).all())

    admin_usage = defaultdict(int)
    for user_usage in users_usage:
        admin_id = user_admin_map.get(int(user_usage["uid"]))
        if admin_id:
            admin_usage[admin_id] += user_usage["value"]

    # record users usage
    with GetDB() as db:
        stmt = update(User). \
            where(User.id == bindparam('uid')). \
            values(
                used_traffic=User.used_traffic + bindparam('value'),
                online_at=datetime.utcnow()
        )

        safe_execute(db, stmt, users_usage)

        admin_data = [{"admin_id": admin_id, "value": value} for admin_id, value in admin_usage.items()]
        if admin_data:
            admin_update_stmt = update(Admin). \
                where(Admin.id == bindparam('admin_id')). \
                values(users_usage=Admin.users_usage + bindparam('value'))
            safe_execute(db, admin_update_stmt, admin_data)

    # host traffic groups: attribute per-node usage to the user's group counter.
    # Inert (early return) until at least one group maps a node.
    record_group_usages(api_params, usage_coefficient)

    if DISABLE_RECORDING_NODE_USAGE:
        return

    for node_id, params in api_params.items():
        record_user_stats(params, node_id, usage_coefficient[node_id])


def record_group_usages(api_params: dict, usage_coefficient: dict):
    """Add each user's per-node traffic to user_group_usage for the group that
    owns the node. No groups -> no-op (node->group map is empty)."""
    with GetDB() as db:
        node_group_map = crud.get_node_group_map(db)  # node_id -> group_id
    if not node_group_map:
        return

    group_user_usage = defaultdict(int)  # (group_id, user_id) -> bytes
    for node_id, params in api_params.items():
        group_id = node_group_map.get(node_id)
        if group_id is None:
            continue
        coefficient = usage_coefficient.get(node_id, 1)
        for param in params:
            group_user_usage[(group_id, int(param['uid']))] += int(param['value'] * coefficient)

    if not group_user_usage:
        return

    pairs = list(group_user_usage.keys())
    group_ids = {g for g, _ in pairs}
    user_ids = {u for _, u in pairs}

    with GetDB() as db:
        existing = {
            (g, u) for g, u in db.query(
                UserGroupUsage.group_id, UserGroupUsage.user_id
            ).filter(
                UserGroupUsage.group_id.in_(group_ids),
                UserGroupUsage.user_id.in_(user_ids),
            ).all()
        }

        to_insert = [
            {"user_id": u, "group_id": g}
            for (g, u) in pairs if (g, u) not in existing
        ]
        if to_insert:
            ins = insert(UserGroupUsage).values(
                user_id=bindparam('user_id'),
                group_id=bindparam('group_id'),
                used_traffic=0,
            )
            safe_execute(db, ins, to_insert)

        upd_params = [
            {"u": u, "g": g, "v": v}
            for (g, u), v in group_user_usage.items()
        ]
        upd = update(UserGroupUsage).values(
            used_traffic=UserGroupUsage.used_traffic + bindparam('v')
        ).where(and_(
            UserGroupUsage.user_id == bindparam('u'),
            UserGroupUsage.group_id == bindparam('g'),
        ))
        safe_execute(db, upd, upd_params)


def enforce_group_limits():
    """Cut off / re-add members based on their host-group traffic limit.

    Runs every recording cycle. A member over their effective limit is removed
    from the group's inbounds (re-applied each cycle, so a node restart that
    silently re-adds them is self-healed within one cycle). When they drop back
    under the limit (reset / limit raised / membership removed) they're re-added.
    Enforcement is scoped per inbound-tag per group node (+ master if metered),
    so other countries stay working. Note: enforcement granularity is the
    inbound tag — hosts that share a tag on the same node are cut together.
    """
    with GetDB() as db:
        groups = {}
        for g in db.query(HostGroup).all():
            groups[g.id] = {
                "limit": g.traffic_limit or 0,
                "include_master": bool(g.include_master),
                "tags": {h.inbound_tag for h in g.hosts},
                "node_ids": [n.id for n in g.nodes],
            }
        if not groups:
            return

        # only rows that could need action: current members or anyone still
        # marked enforced (so we always know to lift a stale block)
        rows = db.query(UserGroupUsage).filter(
            or_(UserGroupUsage.member.is_(True),
                UserGroupUsage.enforced.is_(True))
        ).all()

        actions = []  # (row, "block"|"unblock", group_meta)
        for r in rows:
            g = groups.get(r.group_id)
            if not g:
                continue
            limit = (r.traffic_limit if r.traffic_limit else g["limit"]) or 0
            used = r.used_traffic or 0
            over = bool(limit) and r.member and used >= limit
            if over:
                actions.append((r, "block", g))
            elif r.enforced:
                actions.append((r, "unblock", g))
        if not actions:
            return

        uids = {r.user_id for r, _, _ in actions}
        users = {u.id: u for u in db.query(User).filter(User.id.in_(uids)).all()}

        changed = False
        for r, action, g in actions:
            u = users.get(r.user_id)
            if not u:
                continue
            if action == "block":
                xray.operations.block_user_group(
                    u, g["tags"], g["node_ids"], g["include_master"])
                if not r.enforced:
                    r.enforced = True
                    changed = True
            else:
                xray.operations.unblock_user_group(
                    u, g["tags"], g["node_ids"], g["include_master"])
                r.enforced = False
                changed = True
        if changed:
            db.commit()


def enforce_group_limits_job():
    """Scheduled wrapper: best-effort, never let an enforcement hiccup escape."""
    if not GROUP_LIMIT_HARD_ENFORCE:
        return
    try:
        enforce_group_limits()
    except Exception as e:
        logger.warning(f"group limit enforcement skipped: {e}")


def record_node_usages():
    api_instances = {None: xray.api}
    for node_id, node in list(xray.nodes.items()):
        if node.connected and node.started:
            api_instances[node_id] = node.api

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {node_id: executor.submit(get_outbounds_stats, api) for node_id, api in api_instances.items()}
    api_params = {node_id: future.result() for node_id, future in futures.items()}

    total_up = 0
    total_down = 0
    for node_id, params in api_params.items():
        for param in params:
            total_up += param['up']
            total_down += param['down']
    if not (total_up or total_down):
        return

    # record nodes usage
    with GetDB() as db:
        stmt = update(System).values(
            uplink=System.uplink + total_up,
            downlink=System.downlink + total_down
        )
        safe_execute(db, stmt)

    if DISABLE_RECORDING_NODE_USAGE:
        return

    for node_id, params in api_params.items():
        record_node_stats(params, node_id)


scheduler.add_job(record_user_usages, 'interval',
                  seconds=JOB_RECORD_USER_USAGES_INTERVAL,
                  coalesce=True, max_instances=1)
scheduler.add_job(record_node_usages, 'interval',
                  seconds=JOB_RECORD_NODE_USAGES_INTERVAL,
                  coalesce=True, max_instances=1)
scheduler.add_job(enforce_group_limits_job, 'interval',
                  seconds=JOB_ENFORCE_GROUP_LIMITS_INTERVAL,
                  coalesce=True, max_instances=1)
