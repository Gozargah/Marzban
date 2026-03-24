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
from typing import Dict, List, Optional, Tuple

import requests
from sqlalchemy import bindparam, update

from app import logger, scheduler
from app.db import GetDB
from app.db.models import Admin, Node, User
from app.jobs.record_usages import record_node_stats, record_user_stats, safe_execute
from app.models.node import NodeStatus
from config import (
    DISABLE_RECORDING_NODE_USAGE,
    HYSTERIA2_NODE_TRAFFIC_PORT,
    HYSTERIA2_TRAFFIC_LISTEN,
    HYSTERIA2_TRAFFIC_SECRET,
    JOB_RECORD_USER_USAGES_INTERVAL,
)


def _fetch_traffic_from(url: str) -> dict[str, dict]:
    """
    Call a hysteriad /traffic?clear=true endpoint.
    Returns {username: {"tx": N, "rx": N}} or empty dict on error.
    tx = bytes server to client (download for user)
    rx = bytes client to server (upload for user)
    """
    if not HYSTERIA2_TRAFFIC_SECRET:
        return {}
    try:
        resp = requests.get(
            url,
            headers={"Authorization": HYSTERIA2_TRAFFIC_SECRET},
            timeout=5,
        )
        if resp.status_code == 401:
            logger.warning(
                f"hysteriad traffic API at {url} returned 401 Unauthorized. "
                f"Check that HYSTERIA2_TRAFFIC_SECRET on the panel matches "
                f"the trafficStats.secret in hysteria.yaml on the node."
            )
            return {}
        if resp.status_code != 200:
            logger.warning(f"hysteriad traffic API at {url} returned {resp.status_code}")
            return {}
        data = resp.json()
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        logger.debug(f"hysteriad traffic API unreachable at {url}: {exc}")
        try:
            from app.monitoring import monitoring
            monitoring.record_hysteria_error(
                f"Traffic API unreachable: {url}"
            )
        except Exception:
            pass
        return {}


def _collect_traffic_sources(
    db,
) -> Tuple[Dict[str, dict], List[Tuple[Optional[int], dict]]]:
    """
    Aggregate traffic from local hysteriad and each connected node's hysteriad.

    Returns:
      merged: username -> {tx, rx} summed across all sources (for User totals).
      per_source: list of (node_id, stats) for non-empty sources only.
        node_id None = master/local hysteriad; otherwise DB node id.
    """
    merged: dict[str, dict] = {}
    per_source: List[Tuple[Optional[int], dict]] = []

    def _merge(source: dict[str, dict]) -> None:
        for username, traffic in source.items():
            if username not in merged:
                merged[username] = {"tx": 0, "rx": 0}
            merged[username]["tx"] += traffic.get("tx", 0)
            merged[username]["rx"] += traffic.get("rx", 0)

    # 1. Local hysteriad
    local_url = f"http://{HYSTERIA2_TRAFFIC_LISTEN}/traffic?clear=true"
    local_stats = _fetch_traffic_from(local_url)
    if local_stats:
        _merge(local_stats)
        per_source.append((None, local_stats))

    # 2. Connected nodes
    try:
        nodes = (
            db.query(Node)
            .filter(Node.status == NodeStatus.connected)
            .all()
        )
        for node in nodes:
            node_url = (
                f"http://{node.address}:{HYSTERIA2_NODE_TRAFFIC_PORT}"
                f"/traffic?clear=true"
            )
            node_stats = _fetch_traffic_from(node_url)
            if node_stats:
                logger.debug(
                    f"Collected hysteria2 traffic from node '{node.name}' "
                    f"({node.address}): {len(node_stats)} users."
                )
                _merge(node_stats)
                per_source.append((node.id, node_stats))
    except Exception as exc:
        logger.warning(f"Failed to query nodes for hysteria2 traffic: {exc}")

    return merged, per_source


def _hysteria_stats_to_user_params(stats: dict, user_map: dict) -> list:
    """Build record_user_stats params from hysteria username -> tx/rx dict."""
    params = []
    for username, traffic in stats.items():
        total = traffic.get("tx", 0) + traffic.get("rx", 0)
        if total <= 0:
            continue
        info = user_map.get(username)
        if not info:
            continue
        user_id, _admin_id = info
        params.append({"uid": user_id, "value": total})
    return params


def _hysteria_stats_to_node_bulk_params(stats: dict) -> list:
    """
    Map hysteria per-user stats to one outbound-style row for node_usages.
    rx = client->server (user upload) -> uplink column; tx -> downlink.
    """
    total_rx = sum(t.get("rx", 0) for t in stats.values())
    total_tx = sum(t.get("tx", 0) for t in stats.values())
    if not (total_rx or total_tx):
        return []
    return [{"up": total_rx, "down": total_tx}]


def _record_hysteria_per_node_usages(
    per_source: List[Tuple[Optional[int], dict]], user_map: dict
) -> None:
    """Write node_user_usages and node_usages for each hysteria source."""
    if DISABLE_RECORDING_NODE_USAGE or not per_source:
        return
    for node_id, src_stats in per_source:
        if not src_stats:
            continue
        user_params = _hysteria_stats_to_user_params(src_stats, user_map)
        try:
            if user_params:
                record_user_stats(user_params, node_id, 1)
        except Exception as exc:
            logger.error(
                "record_user_stats (hysteria2) failed for node_id=%s: %s",
                node_id,
                exc,
            )
        node_params = _hysteria_stats_to_node_bulk_params(src_stats)
        try:
            if node_params:
                record_node_stats(node_params, node_id)
        except Exception as exc:
            logger.error(
                "record_node_stats (hysteria2) failed for node_id=%s: %s",
                node_id,
                exc,
            )


def record_hysteria_usages():
    now = datetime.utcnow()

    with GetDB() as db:
        stats, per_source = _collect_traffic_sources(db)
        if not stats:
            return

        _report_to_monitoring(stats)

        # Build username to (user_id, admin_id) map for all users in the stats
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

        # Sort by uid/admin_id for consistent InnoDB lock-acquisition order -> no deadlocks
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

        _record_hysteria_per_node_usages(per_source, user_map)


def _report_to_monitoring(stats: dict):
    try:
        from app.monitoring import monitoring
        total_bytes = sum(
            t.get("tx", 0) + t.get("rx", 0) for t in stats.values()
        )
        monitoring.record_hysteria_traffic(total_bytes, len(stats))
    except Exception:
        pass


# Run on the same interval as the main Xray usage recording job
scheduler.add_job(
    record_hysteria_usages,
    "interval",
    seconds=JOB_RECORD_USER_USAGES_INTERVAL,
    coalesce=True,
    max_instances=1,
)
