from operator import attrgetter
from app import scheduler, xray
from app.db import engine
from app.db.models import System, User, Node, NodeUserUsage
from sqlalchemy import bindparam, update, and_, insert, select


def make_usage_row_if_doesnt_exist(conn, node_id, params):
    select_stmt = select(NodeUserUsage.user_username) \
        .join(Node, NodeUserUsage.node_id == Node.id) \
        .where(Node.id == node_id)
    existings = [r[0] for r in conn.execute(select_stmt).fetchall()]
    usernames_to_insert = set()

    for p in params:
        if p['name'] in existings:
            continue
        usernames_to_insert.add(p['name'])

    if usernames_to_insert:
        stmt = insert(NodeUserUsage).values(user_username=bindparam('name'), node_id=node_id, used_traffic=0)
        conn.execute(stmt, [{'name': username} for username in usernames_to_insert])


def record_nodes_users_usage():
    with engine.connect() as conn:
        for node_id, node in xray.nodes.items():
            if node.connected and node.started:
                try:
                    params = [
                        {"link": stat.link, "name": stat.name, "value": stat.value}
                        for stat in filter(attrgetter('value'), node.api.get_users_stats(reset=True))
                    ]

                except xray.exceptions.ConnectionError:
                    try:
                        node.restart(xray.config.include_db_users())
                    except ProcessLookupError:
                        pass

                    continue  # let Xray restart, stop checking this node for now

                if not params:
                    continue

                # record to user
                stmt = update(User). \
                    where(User.username == bindparam('name')). \
                    values(used_traffic=User.used_traffic + bindparam('value'))
                conn.execute(stmt, params)

                # record to usages
                make_usage_row_if_doesnt_exist(conn, node_id, params)
                stmt = update(NodeUserUsage) \
                    .values(used_traffic=NodeUserUsage.used_traffic + bindparam('value')) \
                    .where(and_(NodeUserUsage.user_username == bindparam('name'), NodeUserUsage.node_id == node_id))
                conn.execute(stmt, params)


scheduler.add_job(record_nodes_users_usage, 'interval', seconds=10)


def record_nodes_outbounds_usage():
    with engine.connect() as conn:
        for node_id, node in xray.nodes.items():
            if node.connected and node.started:
                try:
                    params = [{"node_id": node_id, "up": stat.value, "down": 0}
                              if stat.link == "uplink" else {"node_id": node_id, "up": 0, "down": stat.value}
                              for stat in filter(attrgetter('value'),
                                                 node.api.get_outbounds_stats(reset=True))]

                except xray.exceptions.ConnectionError:
                    try:
                        node.restart(xray.config.include_db_users())
                    except ProcessLookupError:
                        pass

                    continue

                if not params:
                    continue

                # record to system
                stmt = update(System).values(
                    uplink=System.uplink + bindparam('up'),
                    downlink=System.downlink + bindparam('down')
                )
                conn.execute(stmt, params)

                # record to nodes
                stmt = update(Node). \
                    where(Node.id == bindparam('node_id')).values(
                    uplink=Node.uplink + bindparam('up'),
                    downlink=Node.downlink + bindparam('down')
                )
                conn.execute(stmt, params)


scheduler.add_job(record_nodes_outbounds_usage, 'interval', seconds=5)
