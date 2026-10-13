"""NIC-трафик нод для «Использование узлов»: суточные снимки в MySQL.

Sidecar prometheus_vpn_nodes_sd пишет node_hosting_nic_daily; панель суммирует
used_bytes за календарные дни MSK, попадающие в [start, end] запроса.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, date, datetime, timedelta, timezone
from typing import Any, cast

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import NodeHostingNicDaily

MSK = timezone(timedelta(hours=3), name="MSK")


def datetime_to_msk_date(dt: datetime) -> date:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC).astimezone(MSK).date()
    return dt.astimezone(MSK).date()


def nic_usage_from_daily(db: Session, start: datetime, end: datetime) -> dict[int, tuple[int, int]]:
    """node_id → (0, sum(used_bytes)) за дни MSK от start до end включительно."""
    day_from = datetime_to_msk_date(start)
    day_to = datetime_to_msk_date(end)
    if day_to < day_from:
        day_from, day_to = day_to, day_from

    rows = (
        db.query(NodeHostingNicDaily.node_id, func.sum(NodeHostingNicDaily.used_bytes))
        .filter(NodeHostingNicDaily.day >= day_from, NodeHostingNicDaily.day <= day_to)
        .group_by(NodeHostingNicDaily.node_id)
        .all()
    )
    return {int(node_id): (0, int(total or 0)) for node_id, total in rows}


def fallback_usage_from_db(
    nodes: Sequence[Any],
    *,
    max_staleness_seconds: int = 86400,
) -> dict[int, tuple[int, int]]:
    """hosting_used_bytes (MTD), пока суточная история не накопилась.

    Берём только ноды со свежим hosting_used_at (sidecar с Prometheus). Иначе на
    отдельной панели без sidecar остались бы устаревшие hosting_used_bytes и
    модалка не показывала бы Xray node_usages.
    """
    now = datetime.now(UTC)
    out: dict[int, tuple[int, int]] = {}
    for node in nodes:
        node_id = cast(int | None, node.id)
        used = cast(int | None, node.hosting_used_bytes)
        used_at = cast(datetime | None, node.hosting_used_at)
        if node_id is None or used is None or used_at is None:
            continue
        at = used_at.replace(tzinfo=UTC) if used_at.tzinfo is None else used_at.astimezone(UTC)
        if (now - at).total_seconds() > max_staleness_seconds:
            continue
        out[node_id] = (0, int(used))
    return out


def is_calendar_month_to_date_msk(start: datetime, end: datetime, *, slack_seconds: int = 120) -> bool:
    """True, если интервал ≈ с 00:00 MSK 1-го числа текущего месяца до now."""
    now_msk = datetime.now(MSK)
    month_start = now_msk.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    def to_msk(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=UTC).astimezone(MSK)
        return dt.astimezone(MSK)

    start_msk = to_msk(start)
    end_msk = to_msk(end)
    if abs((end_msk - now_msk).total_seconds()) > slack_seconds:
        return False
    return abs((start_msk - month_start).total_seconds()) <= slack_seconds
