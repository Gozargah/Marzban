from operator import attrgetter

from app import scheduler, xray
from app.db import engine
from app.db.models import Node, User
from sqlalchemy import bindparam, update


def record_users_usage():
    for node in xray.nodes.values():
        if node.connected:
            with engine.connect() as conn:
                try:
                    params = [
                        {"name": stat.name, "value": stat.value}
                        for stat in filter(attrgetter('value'), node.api.get_users_stats(reset=True))
                    ]
                except xray.exceptions.ConnectionError:
                    pass

                if not params:
                    continue

                stmt = update(User). \
                    where(User.username == bindparam('name')). \
                    values(used_traffic=User.used_traffic + bindparam('value'))

                conn.execute(stmt, params)

scheduler.add_job(record_users_usage, 'interval', seconds=20)


def record_outbounds_usage():
   for node in xray.nodes.values():
        if node.connected:
            with engine.connect() as conn:
                try:
                    params = [
                        {"node_name": node.name, "up": stat.value, "down": 0} if stat.link == "uplink" else 
                        {"node_name": node.name, "up": 0, "down": stat.value}
                        for stat in filter(attrgetter('value'), node.api.get_outbounds_stats(reset=True))
                    ]
                except xray.exceptions.ConnectionError:
                    pass

                if not params:
                    continue

                stmt = update(Node). \
                    where(Node.name == bindparam('node_name')). \
                    values(
                        uplink=Node.uplink + bindparam('up'),
                        downlink=Node.downlink + bindparam('down')
                    )

                conn.execute(stmt, params)


scheduler.add_job(record_outbounds_usage, 'interval', seconds=15)
