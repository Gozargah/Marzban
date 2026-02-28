"""
Periodically polls hysteriad's traffic stats API and records usage in the
Marzban database, matching the pattern used by record_usages.py for Xray.

Requires hysteria.yaml to have:
  trafficStats:
    listen: 127.0.0.1:9999
    secret: <same value as HYSTERIA2_TRAFFIC_SECRET in .env>
"""

from datetime import datetime

import requests
from sqlalchemy import bindparam, update

from app import logger, scheduler
from app.db import GetDB
from app.db.models import Admin, User
from app.jobs.record_usages import safe_execute
from config import (
    HYSTERIA2_TRAFFIC_LISTEN,
    HYSTERIA2_TRAFFIC_SECRET,
    JOB_RECORD_USER_USAGES_INTERVAL,
)


def _fetch_traffic() -> dict[str, dict]:
    """
    Call hysteriad's /traffic?clear=true endpoint.
    Returns {username: {"tx": N, "rx": N}} or empty dict on error.
    tx = bytes server → client (download for user)
    rx = bytes client → server (upload for user)
    """
    if not HYSTERIA2_TRAFFIC_SECRET:
        return {}

    url = f"http://{HYSTERIA2_TRAFFIC_LISTEN}/traffic?clear=true"
    try:
        resp = requests.get(
            url,
            headers={"Authorization": HYSTERIA2_TRAFFIC_SECRET},
            timeout=5,
        )
        if resp.status_code != 200:
            logger.warning(f"hysteriad traffic API returned {resp.status_code}")
            return {}
        data = resp.json()
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        logger.debug(f"hysteriad traffic API unreachable: {exc}")
        return {}


def record_hysteria_usages():
    stats = _fetch_traffic()
    if not stats:
        return

    now = datetime.utcnow()

    with GetDB() as db:
        # Build username → (user_id, admin_id) map for all users in the stats
        usernames = list(stats.keys())
        rows = (
            db.query(User.id, User.username, User.admin_id)
            .filter(User.username.in_(usernames))
            .all()
        )
        user_map = {row.username: (row.id, row.admin_id) for row in rows}

        user_params = []
        admin_usage: dict[int, int] = {}

        for username, traffic in stats.items():
            total = traffic.get("tx", 0) + traffic.get("rx", 0)
            if total <= 0:
                continue
            info = user_map.get(username)
            if not info:
                continue
            user_id, admin_id = info
            user_params.append({"uid": user_id, "value": total})
            if admin_id:
                admin_usage[admin_id] = admin_usage.get(admin_id, 0) + total

        if not user_params:
            return

        # Update users: add traffic + mark online
        stmt = (
            update(User)
            .where(User.id == bindparam("uid"))
            .values(
                used_traffic=User.used_traffic + bindparam("value"),
                online_at=now,
            )
        )
        safe_execute(db, stmt, user_params)

        # Update admin aggregate usage
        if admin_usage:
            admin_params = [
                {"admin_id": aid, "value": val}
                for aid, val in admin_usage.items()
            ]
            admin_stmt = (
                update(Admin)
                .where(Admin.id == bindparam("admin_id"))
                .values(users_usage=Admin.users_usage + bindparam("value"))
            )
            safe_execute(db, admin_stmt, admin_params)


# Run on the same interval as the main Xray usage recording job
scheduler.add_job(
    record_hysteria_usages,
    "interval",
    seconds=JOB_RECORD_USER_USAGES_INTERVAL,
    coalesce=True,
    max_instances=1,
)
