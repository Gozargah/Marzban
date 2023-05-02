from operator import attrgetter
from app import scheduler, xray
from app.db import engine, get_db, crud
from app.db.models import System, User, Node, UserUsage
from sqlalchemy import bindparam, update, and_

def check_user_usage(node_id, params):
    db = next(get_db())
    for stat in params:
        dbuser = crud.get_user(db, stat["name"])

        if not dbuser:
            return
        
        stat["uid"] = dbuser.id

        q = db.query(UserUsage).filter(UserUsage.user_id == dbuser.id, UserUsage.node_id == node_id)
        if not db.query(q.exists()).scalar():
            dbusage = UserUsage(
                user_id=dbuser.id,
                node_id=node_id,
                used_traffic=0
            )
            db.add(dbusage)
            db.commit()
            db.refresh(dbusage)
            

def record_nodes_users_usage():
    with engine.connect() as conn:
        for node_id, node in xray.nodes.items():
            if node.connected and node.started:
                try:
                    params = [
                        {"nid": node_id, "uid": 0, "link": stat.link, "name": stat.name, "value": stat.value}
                        for stat in filter(attrgetter('value'), node.api.get_users_stats(reset=True))
                    ]

                except xray.exceptions.ConnectionError:
                    try:
                        node.restart(xray.config.include_db_users())
                    except ProcessLookupError:
                        pass

                    continue

                if not params:
                    continue

                # record to user
                stmt = update(User). \
                    where(User.username == bindparam('name')). \
                    values(used_traffic=User.used_traffic + bindparam('value'))
                conn.execute(stmt, params)

                # record to user usages
                check_user_usage(node_id, params)
                stmt = update(UserUsage). \
                    where(and_(UserUsage.user_id == bindparam('uid'), UserUsage.node_id == bindparam('nid'))). \
                    values(used_traffic=UserUsage.used_traffic + bindparam('value'))
                conn.execute(stmt, params)


scheduler.add_job(record_nodes_users_usage, 'interval', seconds=10)


def record_nodes_outbounds_usage():
    with engine.connect() as conn:
        for node_id, node in xray.nodes.items():
            if node.connected and node.started:
                try:
                    params = [
                        {"node_id": node_id, "up": stat.value, "down": 0} if stat.link == "uplink" else {"node_id": node_id, "up": 0, "down": stat.value}
                        for stat in filter(attrgetter('value'), node.api.get_outbounds_stats(reset=True))
                    ]

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
