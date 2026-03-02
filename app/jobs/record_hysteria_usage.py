"""
Periodically polls hysteriad's traffic stats API and records usage in the
Marzban database, matching the pattern used by record_usages.py for Xray.

LOCAL hysteriad (main server):
  Requires hysteria.yaml to have:
    trafficStats:
      listen: 127.0.0.1:9999           # only reachable locally
      secret: <HYSTERIA2_TRAFFIC_SECRET>

REMOTE hysteriad (Marzban-node):
  Each node must have:
    trafficStats:
      listen: 0.0.0.0:9999             # reachable from main panel
      secret: <same HYSTERIA2_TRAFFIC_SECRET>
  The main panel then polls http://<node.address>:HYSTERIA2_NODE_TRAFFIC_PORT
  for every connected Node in the database.

  Recommendation: firewall port HYSTERIA2_NODE_TRAFFIC_PORT on each node so
  only the main panel IP can reach it.
"""

from datetime import datetime

import requests
from sqlalchemy import bindparam, update

from app import logger, scheduler
from app.db import GetDB
from app.db.models import Admin, Node, User
from app.jobs.record_usages import safe_execute
from app.models.node import NodeStatus
from config import (
    HYSTERIA2_NODE_TRAFFIC_PORT,
    HYSTERIA2_TRAFFIC_LISTEN,
    HYSTERIA2_TRAFFIC_SECRET,
    JOB_RECORD_USER_USAGES_INTERVAL,
)


def _fetch_traffic_from(url: str) -> dict[str, dict]:
    """
    Call a hysteriad /traffic?clear=true endpoint.
    Returns {username: {"tx": N, "rx": N}} or empty dict on error.
    tx = bytes server → client (download for user)
    rx = bytes client → server (upload for user)
    """
    if not HYSTERIA2_TRAFFIC_SECRET:
        return {}
    try:
        resp = requests.get(
            url,
            headers={"Authorization": HYSTERIA2_TRAFFIC_SECRET},
            timeout=5,
        )
        if resp.status_code != 200:
            logger.warning(f"hysteriad traffic API at {url} returned {resp.status_code}")
            return {}
        data = resp.json()
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        logger.debug(f"hysteriad traffic API unreachable at {url}: {exc}")
        return {}


def _collect_all_traffic(db) -> dict[str, dict]:
    """
    Aggregate traffic from:
      1. Local hysteriad on the main server (HYSTERIA2_TRAFFIC_LISTEN).
      2. Each connected Marzban-node's hysteriad
         (node.address:HYSTERIA2_NODE_TRAFFIC_PORT).
    Traffic for the same username is summed across all sources.
    """
    merged: dict[str, dict] = {}

    def _merge(source: dict[str, dict]) -> None:
        for username, traffic in source.items():
            if username not in merged:
                merged[username] = {"tx": 0, "rx": 0}
            merged[username]["tx"] += traffic.get("tx", 0)
            merged[username]["rx"] += traffic.get("rx", 0)

    # 1. Local hysteriad
    local_url = f"http://{HYSTERIA2_TRAFFIC_LISTEN}/traffic?clear=true"
    _merge(_fetch_traffic_from(local_url))

    # 2. Connected nodes
    try:
        nodes = (
            db.query(Node)
            .filter(Node.status == NodeStatus.connected)
            .all()
        )
        for node in nodes:
            node_url = f"http://{node.address}:{HYSTERIA2_NODE_TRAFFIC_PORT}/traffic?clear=true"
            node_stats = _fetch_traffic_from(node_url)
            if node_stats:
                logger.debug(
                    f"Collected hysteria2 traffic from node '{node.name}' "
                    f"({node.address}): {len(node_stats)} users."
                )
            _merge(node_stats)
    except Exception as exc:
        logger.warning(f"Failed to query nodes for hysteria2 traffic: {exc}")

    return merged


def record_hysteria_usages():
    now = datetime.utcnow()

    with GetDB() as db:
        stats = _collect_all_traffic(db)
        if not stats:
            return

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

        # Sort by uid/admin_id for consistent InnoDB lock-acquisition order → no deadlocks
        user_params.sort(key=lambda x: x["uid"])

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
            admin_params = sorted(
                ({"admin_id": aid, "value": val} for aid, val in admin_usage.items()),
                key=lambda x: x["admin_id"],
            )
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
