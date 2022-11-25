from app import scheduler, xray
from app.db import engine
from app.db.models import System, User

from sqlalchemy import update

# TODO https://stackoverflow.com/questions/25694234/bulk-update-in-sqlalchemy-core-using-where


def record_users_usage():
    with engine.connect() as conn:
        for stat in xray.api.get_users_stats(reset=True):
            if stat.value == 0:
                continue
            conn.execute(
                update(User)
                .where(User.username == stat.name)
                .values(used_traffic=User.used_traffic+stat.value)
            )


scheduler.add_job(record_users_usage, 'interval', seconds=10)


def record_outbounds_usage():
    with engine.connect() as conn:
        for stat in xray.api.get_outbounds_stats(reset=True):
            if stat.value == 0:
                continue
            conn.execute(
                update(System)
                .values({stat.link: getattr(System, stat.link)+stat.value})
            )


scheduler.add_job(record_outbounds_usage, 'interval', seconds=5)
