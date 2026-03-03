from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.models.admin import Admin
from app.monitoring import monitoring
from app.utils import responses

router = APIRouter(
    tags=["Monitoring"], prefix="/api",
    responses={401: responses._401, 403: responses._403},
)


class MetricPointResponse(BaseModel):
    timestamp: float
    cpu_percent: float
    memory_percent: float
    memory_used: int
    memory_total: int
    incoming_speed: int
    outgoing_speed: int
    incoming_packets: int
    outgoing_packets: int
    active_connections: int
    online_users: int


class MonitoringEventResponse(BaseModel):
    timestamp: float
    event_type: str
    severity: str
    message: str
    node_name: Optional[str] = None
    node_id: Optional[int] = None


class NodeHealthResponse(BaseModel):
    node_id: int
    node_name: str
    status: str
    uptime_percent: float
    last_connected: Optional[float] = None
    last_error: Optional[str] = None
    last_error_time: Optional[float] = None


class MonitoringOverview(BaseModel):
    metrics: List[MetricPointResponse]
    events: List[MonitoringEventResponse]
    nodes: List[NodeHealthResponse]


@router.get(
    "/monitoring",
    response_model=MonitoringOverview,
)
def get_monitoring_overview(
    minutes: int = Query(default=60, ge=1, le=120),
    event_limit: int = Query(default=50, ge=1, le=200),
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Full monitoring snapshot: metrics history, recent events, and node health."""
    return MonitoringOverview(
        metrics=monitoring.get_metrics(minutes),
        events=monitoring.get_events(event_limit),
        nodes=monitoring.get_nodes_health(),
    )


@router.get(
    "/monitoring/metrics",
    response_model=List[MetricPointResponse],
)
def get_monitoring_metrics(
    minutes: int = Query(default=60, ge=1, le=120),
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Time-series system metrics for the requested window."""
    return monitoring.get_metrics(minutes)


@router.get(
    "/monitoring/events",
    response_model=List[MonitoringEventResponse],
)
def get_monitoring_events(
    limit: int = Query(default=50, ge=1, le=200),
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Recent monitoring events (node drops, alerts, etc.)."""
    return monitoring.get_events(limit)


@router.get(
    "/monitoring/nodes",
    response_model=List[NodeHealthResponse],
)
def get_monitoring_nodes(
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Health status of each node."""
    return monitoring.get_nodes_health()
