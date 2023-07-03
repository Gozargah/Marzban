from collections import defaultdict
from datetime import datetime
from operator import attrgetter, itemgetter
from typing import Union

from pymysql.err import OperationalError
from sqlalchemy import and_, bindparam, insert, select, update

from app import scheduler, xray
from app.db import GetDB
from app.db.models import NodeUsage, NodeUserUsage, System, User
from app.utils.concurrency import threaded_function
from config import DISABLE_RECORDING_NODE_USAGE
from xray_api import XRay as XRayAPI
from xray_api import exc as xray_exc


def record_user_stats(params: list, node_id: Union[int, None]):
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
            db.execute(stmt, [{'uid': uid} for uid in uids_to_insert])

        # record
        stmt = update(NodeUserUsage) \
            .values(used_traffic=NodeUserUsage.used_traffic + bindparam('value')) \
            .where(and_(NodeUserUsage.user_id == bindparam('uid'),
                        NodeUserUsage.node_id == node_id,
                        NodeUserUsage.created_at == created_at))

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


@threaded_function
def record_user_usage(api: XRayAPI, node_id: Union[int, None] = None):
    try:
        params = defaultdict(int)

        for stat in filter(attrgetter('value'), api.get_users_stats(reset=True)):
            params[stat.name.split('.', 1)[0]] += stat.value

        params = sorted(
            ({"uid": uid, "value": value} for uid, value in params.items()),
            key=itemgetter('uid')
        )

    except (xray_exc.ConnectionError, xray_exc.UnkownError):
        if not node_id:
            xray.core.restart(xray.config.include_db_users())
        else:
            xray.operations.restart_node(node_id, xray.config.include_db_users())
        return

    if not params:
        return

    with GetDB() as db:
        # record to user
        stmt = update(User). \
            where(User.id == bindparam('uid')). \
            values(used_traffic=User.used_traffic + bindparam('value'))

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

    if DISABLE_RECORDING_NODE_USAGE:
        return
    record_user_stats(params, node_id)


def record_node_stats(params: dict, node_id: Union[int, None]):
    created_at = datetime.fromisoformat(datetime.utcnow().strftime('%Y-%m-%dT%H:00:00'))

    with GetDB() as db:

        # make node usage row if doesn't exist
        select_stmt = select(NodeUsage.node_id). \
            where(and_(NodeUsage.node_id == node_id, NodeUsage.created_at == created_at))
        notfound = db.execute(select_stmt).first() is None
        if notfound:
            stmt = insert(NodeUsage).values(created_at=created_at, node_id=node_id, uplink=0, downlink=0)
            db.execute(stmt)

        # record
        stmt = update(NodeUsage). \
            values(uplink=NodeUsage.uplink + bindparam('up'), downlink=NodeUsage.downlink + bindparam('down')). \
            where(and_(NodeUsage.node_id == node_id, NodeUsage.created_at == created_at))

        db.execute(stmt, params)

        # commit changes
        db.commit()


@threaded_function
def record_node_usage(api: XRayAPI, node_id: Union[int, None] = None):
    try:
        params = [{"up": stat.value, "down": 0} if stat.link == "uplink" else {"up": 0, "down": stat.value}
                  for stat in filter(attrgetter('value'), api.get_outbounds_stats(reset=True))]
    except (xray_exc.ConnectionError, xray_exc.UnkownError):
        if not node_id:
            xray.core.restart(xray.config.include_db_users())
        else:
            xray.operations.restart_node(node_id, xray.config.include_db_users())
        return

    if not params:
        return

    with GetDB() as db:
        # record to system
        stmt = update(System).values(
            uplink=System.uplink + bindparam('up'),
            downlink=System.downlink + bindparam('down')
        )
        db.execute(stmt, params)
        db.commit()

    if DISABLE_RECORDING_NODE_USAGE:
        return
    record_node_stats(params, node_id)


def record_usages():
    record_user_usage(xray.api, node_id=None)  # main core
    record_node_usage(xray.api, node_id=None)  # main core

    for node_id, node in list(xray.nodes.items()):
        if node.connected:
            record_user_usage(node.api, node_id=node_id)
            record_node_usage(node.api, node_id=node_id)


scheduler.add_job(record_usages, 'interval', seconds=30)
