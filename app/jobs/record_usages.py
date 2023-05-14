from operator import attrgetter
from threading import Thread
from datetime import datetime
from app import scheduler, xray
from app.xray import XRayNode
from app.db import engine
from app.db.models import System, User, Node, NodeUserUsage, NodeUsage
from sqlalchemy import bindparam, update, and_, insert, select
from xray_api import XRay as XRayAPI

def make_user_usage_row_if_doesnt_exist(conn, created_at, node_id, params):
    select_stmt = select(NodeUserUsage.user_id) \
        .where(and_(NodeUserUsage.node_id == node_id, NodeUserUsage.created_at == created_at))
    existings = [r[0] for r in conn.execute(select_stmt).fetchall()]
    uids_to_insert = set()

    for p in params:
        uid = int(p['uid'])
        if uid in existings:
            continue
        uids_to_insert.add(uid)

    if uids_to_insert:
        stmt = insert(NodeUserUsage).values(user_id=bindparam('uid'), created_at=created_at, node_id=node_id, used_traffic=0)
        conn.execute(stmt, [{'uid': uid} for uid in uids_to_insert])

def record_user_usage(conn, node_id: int, api: XRayAPI):
    created_at = datetime.fromisoformat(datetime.utcnow().strftime('%Y-%m-%dT%H:00:00'))

    params = [
        {"link": stat.link, "uid": str(stat.name).split('.')[0], "value": stat.value}
        for stat in filter(attrgetter('value'), api.get_users_stats(reset=True))
    ]
    
    if not params:
        return

    # record to user
    stmt = update(User). \
        where(User.id == bindparam('uid')). \
        values(used_traffic=User.used_traffic + bindparam('value'))
    conn.execute(stmt, params)

    # record to usages
    make_user_usage_row_if_doesnt_exist(conn, created_at, node_id, params)
    stmt = update(NodeUserUsage) \
        .values(used_traffic=NodeUserUsage.used_traffic + bindparam('value')) \
        .where(and_(NodeUserUsage.user_id == bindparam('uid'), 
                    NodeUserUsage.node_id == node_id,
                    NodeUserUsage.created_at == created_at))
    conn.execute(stmt, params)

def make_node_usage_row_if_doesnt_exist(conn, created_at, node_id):
    select_stmt = select(NodeUsage.node_id). \
        where(and_(NodeUsage.node_id == node_id, NodeUsage.created_at == created_at))
    notfound = conn.execute(select_stmt).first() is None

    if notfound:
        stmt = insert(NodeUsage).values(created_at=created_at, node_id=node_id, uplink=0, downlink=0)
        conn.execute(stmt)

def record_node_usage(conn, node_id: int, api: XRayAPI):
    created_at = datetime.fromisoformat(datetime.utcnow().strftime('%Y-%m-%dT%H:00:00'))

    params = [{"nid": node_id, "up": stat.value, "down": 0}
        if stat.link == "uplink" else {"nid": node_id, "up": 0, "down": stat.value}
        for stat in filter(attrgetter('value'), api.get_outbounds_stats(reset=True))]

    if not params:
        return

    # record to system
    stmt = update(System).values(
        uplink=System.uplink + bindparam('up'),
        downlink=System.downlink + bindparam('down')
    )
    conn.execute(stmt, params)

    # record to nodes
    make_node_usage_row_if_doesnt_exist(conn, created_at, node_id)
    stmt = update(NodeUsage). \
        values(uplink=NodeUsage.uplink + bindparam('up'), downlink=NodeUsage.downlink + bindparam('down')). \
        where(and_(NodeUsage.node_id == bindparam('nid'), NodeUsage.created_at == created_at))
    conn.execute(stmt, params)

def record_usage_for_user_and_node(node_id: int, node: XRayNode):
    if node is None:
        api = xray.api
    elif node.connected and node.started:
        api = node.api
    else:
        return
    
    with engine.connect() as conn:
        try:
            record_node_usage(conn, node_id, api);
            record_user_usage(conn, node_id, api)
        except xray.exceptions.ConnectionError:
            if node is not None:
                try:
                    node.restart(xray.config.include_db_users())
                except ProcessLookupError:
                    pass

def do_record_job():
    record_usage_for_user_and_node(0, None)
    for node_id, node in xray.nodes.items():
        Thread(target=record_usage_for_user_and_node, args=(node_id, node)).start()

scheduler.add_job(do_record_job, 'interval', seconds=10)