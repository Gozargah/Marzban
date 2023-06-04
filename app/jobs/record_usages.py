from datetime import datetime
from operator import attrgetter

from sqlalchemy import and_, bindparam, insert, select, update

from app import scheduler, xray
from app.db import GetDB
from app.db.models import NodeUsage, NodeUserUsage, System, User
from app.utils.concurrency import threaded_function
from xray_api import XRay as XRayAPI


def record_user_stats(params: list, node_id: int):
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
        db.execute(stmt, params)

        # commit changes
        db.commit()


@threaded_function
def record_user_usage(api: XRayAPI, node_id: int = 0):
    params = [
        {"link": stat.link, "uid": str(stat.name).split('.', 1)[0], "value": stat.value}
        for stat in filter(attrgetter('value'), api.get_users_stats(reset=True))
    ]

    if not params:
        return

    with GetDB() as db:
        # record to user
        stmt = update(User). \
            where(User.id == bindparam('uid')). \
            values(used_traffic=User.used_traffic + bindparam('value'))

        db.execute(stmt, params)
        db.commit()

    record_user_stats(params, node_id)


def record_node_stats(params: dict, node_id: int):
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
            where(and_(NodeUsage.node_id == bindparam('nid'), NodeUsage.created_at == created_at))
        db.execute(stmt, params)

        # commit changes
        db.commit()


@threaded_function
def record_node_usage(api: XRayAPI, node_id: int = 0):
    params = [{"nid": node_id, "up": stat.value, "down": 0}
              if stat.link == "uplink" else {"nid": node_id, "up": 0, "down": stat.value}
              for stat in filter(attrgetter('value'), api.get_outbounds_stats(reset=True))]

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

    record_node_stats(params, node_id)


def record_usages():
    record_user_usage(xray.api, node_id=0)  # main core
    record_node_usage(xray.api, node_id=0)  # main core

    for node_id, node in xray.nodes.items():
        if node.connected and node.started:
            record_user_usage(node.api, node_id=node_id)
            record_node_usage(node.api, node_id=node_id)


scheduler.add_job(record_usages, 'interval', seconds=30)
