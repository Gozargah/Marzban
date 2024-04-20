from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from operator import attrgetter
from typing import Union

from pymysql.err import OperationalError
from sqlalchemy import and_, bindparam, insert, select, sql, update

from app import scheduler, xray
from app.db import GetDB
from app.db.models import NodeUsage, NodeUserUsage, System, User, Admin, NodeAdminUsage
from config import DISABLE_RECORDING_NODE_USAGE
from xray_api import XRay as XRayAPI
from xray_api import exc as xray_exc


def safe_execute(db, stmt, params=None):
    if db.bind.name == 'mysql':
        if isinstance(stmt, sql.dml.Insert):
            stmt = stmt.prefix_with('IGNORE')

        tries = 0
        done = False
        while not done:
            try:
                db.execute(stmt, params)
                db.commit()
                done = True
            except OperationalError as err:
                if err.args[0] == 1213 and tries < 3:  # Deadlock
                    db.rollback()
                    tries += 1
                    continue
                raise err

    else:
        db.execute(stmt, params)
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

def record_admin_stats(params: list, node_id: Union[int, None],
                      consumption_factor: int = 1):
    if not params:
        return

    users_usage_id = [item["uid"] for item in params]
    created_at = datetime.fromisoformat(datetime.utcnow().strftime('%Y-%m-%dT%H:00:00'))

    with GetDB() as db:

        users = db.query(User).filter(User.id.in_(users_usage_id)).all()

        # find user's admin
        users_usages_with_admin_id = list()
        admins_ids = list()
        for user in users:
            for user_usage in params:
                if int(user_usage['uid']) == user.id:
                    user_usage['admin_id'] = user.admin_id
                    users_usages_with_admin_id.append(user_usage)
                    if user.admin_id not in admins_ids:
                        admins_ids.append(user.admin_id)

        # calculate admins usages
        admins_node_usages = list()
        for admin_id in admins_ids:
            total_val = sum(item["value"] for item in users_usages_with_admin_id if item["admin_id"] == admin_id)
            admins_node_usages.append(dict({ "aid": admin_id, "value": total_val}))
        
        # make admin usage row if doesn't exist
        select_stmt = select(NodeAdminUsage.admin_id) \
            .where(and_(NodeAdminUsage.node_id == node_id, NodeAdminUsage.created_at == created_at))
        existings = [r[0] for r in db.execute(select_stmt).fetchall()]
        admin_ids_to_insert = set()

        for p in params:
            admin_id = int(p['admin_id'])
            if admin_id in existings:
                continue
            admin_ids_to_insert.add(admin_id)

        if admin_ids_to_insert:
            stmt = insert(NodeAdminUsage).values(
                admin_id=bindparam('admin_id'),
                created_at=created_at,
                node_id=node_id,
                used_traffic=0
            )
            safe_execute(db, stmt, [{'admin_id': admin_id} for admin_id in admin_ids_to_insert])

        # record
        stmt = update(NodeAdminUsage) \
            .values(used_traffic=NodeAdminUsage.used_traffic + bindparam('value') * consumption_factor) \
            .where(and_(NodeAdminUsage.admin_id == bindparam('aid'),
                        NodeAdminUsage.node_id == node_id,
                        NodeAdminUsage.created_at == created_at))
        safe_execute(db, stmt, admins_node_usages)


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
            users_usage[param['uid']] += param['value'] * coefficient  # apply the usage coefficient
    users_usage = list({"uid": uid, "value": value} for uid, value in users_usage.items())
    if not users_usage:
        return

    # record users usage
    with GetDB() as db:
        stmt = update(User). \
            where(User.id == bindparam('uid')). \
            values(
                used_traffic=User.used_traffic + bindparam('value'),
                online_at=datetime.utcnow()
        )

        safe_execute(db, stmt, users_usage)

    record_admins_usage(users_usage)

    if DISABLE_RECORDING_NODE_USAGE:
        return

    for node_id, params in api_params.items():
        record_user_stats(params, node_id, usage_coefficient[node_id])
        record_admin_stats(params, node_id, usage_coefficient[node_id])

def record_admins_usage(users_usages):
    users_usage_id = [item["uid"] for item in users_usages]

    with GetDB() as db:
        users = db.query(User).filter(User.id.in_(users_usage_id)).all()

        # find user's admin
        users_usages_with_admin_id = list()
        admins_ids = list()
        for user in users:
            for user_usage in users_usages:
                if int(user_usage['uid']) == user.id:
                    user_usage['admin_id'] = user.admin_id
                    users_usages_with_admin_id.append(user_usage)
                    if user.admin_id not in admins_ids:
                        admins_ids.append(user.admin_id)

        # calculate admins usages
        admins_usages = list()
        for admin_id in admins_ids:
            total_val = sum(item["value"] for item in users_usages_with_admin_id if item["admin_id"] == admin_id)
            admins_usages.append(dict({ "admin_id": admin_id, "value": total_val}))

        stmt = update(Admin). \
            where(Admin.id == bindparam('admin_id')). \
            values(
                used_traffic=Admin.used_traffic + bindparam('value'),
            )

        safe_execute(db, stmt, admins_usages)

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


scheduler.add_job(record_user_usages, 'interval', coalesce=True, seconds=30, max_instances=1)
scheduler.add_job(record_node_usages, 'interval', coalesce=True, seconds=10, max_instances=1)
