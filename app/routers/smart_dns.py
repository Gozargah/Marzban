import time
from typing import List, Optional

from fastapi import APIRouter, Depends

from app.models.admin import Admin
from app.smart_dns import get_metrics_cache
from app.smart_dns.lifecycle import is_poller_alive
from config import (
    SMART_DNS_ALERT_MAX_BANDWIDTH_MBPS,
    SMART_DNS_ALERT_MAX_CPU,
    SMART_DNS_ALERT_MAX_SCORE,
    SMART_DNS_ENABLED,
    SMART_DNS_FAIL_THRESHOLD,
)
from pydantic import BaseModel

from app.utils import responses

router = APIRouter(
    tags=["Smart DNS"],
    prefix="/api",
    responses={401: responses._401, 403: responses._403},
)


class SmartDnsNodeMetricsOut(BaseModel):
    active_connections: int = 0
    bandwidth_mbps: float = 0.0
    cpu: float = 0.0
    status: str = "UNKNOWN"


class SmartDnsNodeStatusOut(BaseModel):
    node_id: int
    node_name: str
    smart_dns_name: str
    announce_ip: str
    address: str
    port: int
    is_up: bool
    consecutive_failures: int
    score: float
    last_error: Optional[str] = None
    last_poll_ts: float = 0.0
    seconds_since_poll: float = 0.0
    metrics: Optional[SmartDnsNodeMetricsOut] = None


class SmartDnsPoolStatusOut(BaseModel):
    name: str
    nodes: List[SmartDnsNodeStatusOut]


class SmartDnsStatusResponse(BaseModel):
    enabled: bool
    fail_threshold: int
    poller_alive: bool
    pools: List[SmartDnsPoolStatusOut]


class SmartDnsAlertOut(BaseModel):
    severity: str
    message: str
    node_id: Optional[int] = None
    node_name: Optional[str] = None


class SmartDnsAlertsResponse(BaseModel):
    alerts: List[SmartDnsAlertOut]


def _build_status() -> SmartDnsStatusResponse:
    cache = get_metrics_cache()
    now = time.time()
    pools_map = cache.pools()
    pools: List[SmartDnsPoolStatusOut] = []
    for pname, nodes in sorted(pools_map.items(), key=lambda x: x[0]):
        out_nodes: List[SmartDnsNodeStatusOut] = []
        for n in sorted(nodes, key=lambda x: x.node_id):
            m = n.last_metrics
            metrics_out = None
            if isinstance(m, dict):
                metrics_out = SmartDnsNodeMetricsOut(
                    active_connections=int(m.get("active_connections") or 0),
                    bandwidth_mbps=float(m.get("bandwidth_mbps") or 0),
                    cpu=float(m.get("cpu") or 0),
                    status=str(m.get("status") or "UNKNOWN"),
                )
            sc = n.compute_score()
            out_nodes.append(
                SmartDnsNodeStatusOut(
                    node_id=n.node_id,
                    node_name=n.name,
                    smart_dns_name=n.smart_dns_name,
                    announce_ip=n.announce_ip,
                    address=n.address,
                    port=n.port,
                    is_up=n.is_up(SMART_DNS_FAIL_THRESHOLD),
                    consecutive_failures=n.consecutive_failures,
                    score=round(sc, 4),
                    last_error=n.last_error,
                    last_poll_ts=n.last_poll_ts,
                    seconds_since_poll=round(now - n.last_poll_ts, 1) if n.last_poll_ts > 0 else 0.0,
                    metrics=metrics_out,
                )
            )
        display = nodes[0].smart_dns_name if nodes else pname
        pools.append(SmartDnsPoolStatusOut(name=display, nodes=out_nodes))
    return SmartDnsStatusResponse(
        enabled=SMART_DNS_ENABLED,
        fail_threshold=SMART_DNS_FAIL_THRESHOLD,
        poller_alive=is_poller_alive(),
        pools=pools,
    )


def _build_alerts() -> SmartDnsAlertsResponse:
    alerts: List[SmartDnsAlertOut] = []
    st = _build_status()
    for pool in st.pools:
        up_count = sum(1 for n in pool.nodes if n.is_up)
        if up_count == 0 and pool.nodes:
            alerts.append(
                SmartDnsAlertOut(
                    severity="critical",
                    message=f'No healthy nodes in pool "{pool.name}"',
                )
            )
        for n in pool.nodes:
            if not n.metrics:
                continue
            if SMART_DNS_ALERT_MAX_SCORE > 0 and n.score >= SMART_DNS_ALERT_MAX_SCORE:
                alerts.append(
                    SmartDnsAlertOut(
                        severity="warning",
                        message=f"Load score {n.score} exceeds threshold",
                        node_id=n.node_id,
                        node_name=n.node_name,
                    )
                )
            if SMART_DNS_ALERT_MAX_CPU > 0 and n.metrics.cpu >= SMART_DNS_ALERT_MAX_CPU:
                alerts.append(
                    SmartDnsAlertOut(
                        severity="warning",
                        message=f"CPU {n.metrics.cpu}% exceeds threshold",
                        node_id=n.node_id,
                        node_name=n.node_name,
                    )
                )
            if (
                SMART_DNS_ALERT_MAX_BANDWIDTH_MBPS > 0
                and n.metrics.bandwidth_mbps >= SMART_DNS_ALERT_MAX_BANDWIDTH_MBPS
            ):
                alerts.append(
                    SmartDnsAlertOut(
                        severity="warning",
                        message=f"Bandwidth {n.metrics.bandwidth_mbps} Mbps exceeds threshold",
                        node_id=n.node_id,
                        node_name=n.node_name,
                    )
                )
    return SmartDnsAlertsResponse(alerts=alerts)


@router.get("/smart-dns/status", response_model=SmartDnsStatusResponse)
def smart_dns_status(_: Admin = Depends(Admin.check_sudo_admin)):
    return _build_status()


@router.get("/smart-dns/alerts", response_model=SmartDnsAlertsResponse)
def smart_dns_alerts(_: Admin = Depends(Admin.check_sudo_admin)):
    return _build_alerts()
