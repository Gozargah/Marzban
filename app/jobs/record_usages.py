from operator import attrgetter
from datetime import datetime
from app import scheduler, xray
from app.db import engine
from app.db.models import System, User, Node, NodeUserUsage, NodeUsage
from sqlalchemy import bindparam, update, and_, insert, select
from xray_api import XRay as XRayAPI


def make_user_usage_row_if_doesnt_exist(conn, created_at, node_id, params):
    select_stmt = select(NodeUserUsage.user_username) \
        .where(and_(NodeUserUsage.node_id == node_id, NodeUserUsage.created_at == created_at))
    existings = [r[0] for r in conn.execute(select_stmt).fetchall()]
    usernames_to_insert = set()

    for p in params:
        if p['name'] in existings:
            continue
        usernames_to_insert.add(p['name'])

    if usernames_to_insert:
        stmt = insert(NodeUserUsage).values(user_username=bindparam('name'), created_at=created_at, node_id=node_id, used_traffic=0)
        conn.execute(stmt, [{'name': username} for username in usernames_to_insert])

def record_node_users_usage(conn, node_id: int, api: XRayAPI, node: Node = None):
    created_at = datetime.fromisoformat(datetime.utcnow().strftime('%Y-%m-%dT%H:00:00'))

    try:
        params = [
            {"link": stat.link, "name": stat.name, "value": stat.value}
            for stat in filter(attrgetter('value'), api.get_users_stats(reset=True))
        ]

    except xray.exceptions.ConnectionError:
        if node is not None:
            try:
                node.restart(xray.config.include_db_users())
            except ProcessLookupError:
                pass

        return

    if not params:
        return

    # record to user
    stmt = update(User). \
        where(User.username == bindparam('name')). \
        values(used_traffic=User.used_traffic + bindparam('value'))
    conn.execute(stmt, params)

    # record to usages
    make_user_usage_row_if_doesnt_exist(conn, created_at, node_id, params)
    stmt = update(NodeUserUsage) \
        .values(used_traffic=NodeUserUsage.used_traffic + bindparam('value')) \
        .where(and_(NodeUserUsage.user_username == bindparam('name'), 
                    NodeUserUsage.node_id == node_id,
                    NodeUserUsage.created_at == created_at))
    conn.execute(stmt, params)

def record_nodes_users_usage():
    with engine.connect() as conn:
        record_node_users_usage(conn, 0, xray.api)
        for node_id, node in xray.nodes.items():
            if node.connected and node.started:
                record_node_users_usage(conn, node_id, node.api, node)


scheduler.add_job(record_nodes_users_usage, 'interval', seconds=10)


def make_node_usage_row_if_doesnt_exist(conn, created_at, node_id, params):
    select_stmt = select(NodeUsage.node_id). \
        where(and_(NodeUsage.node_id == node_id, NodeUsage.created_at == created_at))
    notfound = conn.execute(select_stmt).first() is None

    if notfound:
        stmt = insert(NodeUsage).values(created_at=created_at, node_id=node_id, uplink=0, downlink=0)
        conn.execute(stmt)

def record_node_outbounds_usage(conn, node_id: int, api: XRayAPI, node: Node = None):
    created_at = datetime.fromisoformat(datetime.utcnow().strftime('%Y-%m-%dT%H:00:00'))

    try:
        params = [{"nid": node_id, "up": stat.value, "down": 0}
                    if stat.link == "uplink" else {"nid": node_id, "up": 0, "down": stat.value}
                    for stat in filter(attrgetter('value'), api.get_outbounds_stats(reset=True))]

    except xray.exceptions.ConnectionError:
        if node is not None:
            try:
                node.restart(xray.config.include_db_users())
            except ProcessLookupError:
                pass

        return

    if not params:
        return

    # record to system
    stmt = update(System).values(
        uplink=System.uplink + bindparam('up'),
        downlink=System.downlink + bindparam('down')
    )
    conn.execute(stmt, params)

    # record to nodes
    make_node_usage_row_if_doesnt_exist(conn, created_at, node_id, params)
    stmt = update(NodeUsage). \
        values(uplink=NodeUsage.uplink + bindparam('up'), downlink=NodeUsage.downlink + bindparam('down')). \
        where(and_(NodeUsage.node_id == bindparam('nid'), NodeUsage.created_at == created_at))
    conn.execute(stmt, params)

def record_nodes_outbounds_usage():
    with engine.connect() as conn:
        record_node_outbounds_usage(conn, 0, xray.api)
        for node_id, node in xray.nodes.items():
            if node.connected and node.started:
                record_node_outbounds_usage(conn, node_id, node.api, node)


scheduler.add_job(record_nodes_outbounds_usage, 'interval', seconds=5)
