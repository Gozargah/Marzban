import time
from collections import deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional

import psutil

from app import scheduler


class EventType(str, Enum):
    node_connected = "node_connected"
    node_disconnected = "node_disconnected"
    node_error = "node_error"
    core_restart = "core_restart"
    high_cpu = "high_cpu"
    high_memory = "high_memory"
    bandwidth_spike = "bandwidth_spike"


@dataclass
class MonitoringEvent:
    timestamp: float
    event_type: str
    severity: str  # info, warning, error
    message: str
    node_name: Optional[str] = None
    node_id: Optional[int] = None


@dataclass
class MetricPoint:
    timestamp: float
    cpu_percent: float
    memory_percent: float
    memory_used: int
    memory_total: int
    incoming_speed: int  # bytes/s
    outgoing_speed: int  # bytes/s
    incoming_packets: int
    outgoing_packets: int
    active_connections: int
    online_users: int = 0


@dataclass
class NodeHealthRecord:
    node_id: int
    node_name: str
    status: str
    last_connected: Optional[float] = None
    last_error: Optional[str] = None
    last_error_time: Optional[float] = None
    uptime_checks: int = 0
    uptime_ok: int = 0
    latency_ms: Optional[float] = None


MAX_METRICS = 720  # 2h at 10s intervals
MAX_EVENTS = 200


class MonitoringService:
    def __init__(self):
        self.metrics: deque[MetricPoint] = deque(maxlen=MAX_METRICS)
        self.events: deque[MonitoringEvent] = deque(maxlen=MAX_EVENTS)
        self.node_health: Dict[int, NodeHealthRecord] = {}
        self._prev_bytes_recv: int = 0
        self._prev_bytes_sent: int = 0
        self._prev_packets_recv: int = 0
        self._prev_packets_sent: int = 0
        self._prev_time: float = 0.0
        self._cpu_alert_cooldown: float = 0.0
        self._mem_alert_cooldown: float = 0.0
        self._bw_alert_cooldown: float = 0.0
        self._init_counters()

    def _init_counters(self):
        io = psutil.net_io_counters()
        self._prev_bytes_recv = io.bytes_recv
        self._prev_bytes_sent = io.bytes_sent
        self._prev_packets_recv = io.packets_recv
        self._prev_packets_sent = io.packets_sent
        self._prev_time = time.time()

    def collect_metrics(self):
        now = time.time()
        dt = now - self._prev_time
        if dt < 1:
            dt = 1

        cpu = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        io = psutil.net_io_counters()
        try:
            conns = len(psutil.net_connections(kind="udp")) + len(
                psutil.net_connections(kind="tcp")
            )
        except (psutil.AccessDenied, PermissionError):
            conns = 0

        in_speed = max(0, round((io.bytes_recv - self._prev_bytes_recv) / dt))
        out_speed = max(0, round((io.bytes_sent - self._prev_bytes_sent) / dt))
        in_packets = max(0, round((io.packets_recv - self._prev_packets_recv) / dt))
        out_packets = max(0, round((io.packets_sent - self._prev_packets_sent) / dt))

        self._prev_bytes_recv = io.bytes_recv
        self._prev_bytes_sent = io.bytes_sent
        self._prev_packets_recv = io.packets_recv
        self._prev_packets_sent = io.packets_sent
        self._prev_time = now

        point = MetricPoint(
            timestamp=now,
            cpu_percent=cpu,
            memory_percent=mem.percent,
            memory_used=mem.used,
            memory_total=mem.total,
            incoming_speed=in_speed,
            outgoing_speed=out_speed,
            incoming_packets=in_packets,
            outgoing_packets=out_packets,
            active_connections=conns,
        )
        self.metrics.append(point)

        if cpu > 90 and now - self._cpu_alert_cooldown > 300:
            self._cpu_alert_cooldown = now
            self.add_event(EventType.high_cpu, "warning",
                           f"CPU usage {cpu:.1f}%")

        if mem.percent > 90 and now - self._mem_alert_cooldown > 300:
            self._mem_alert_cooldown = now
            self.add_event(EventType.high_memory, "warning",
                           f"Memory usage {mem.percent:.1f}%")

        peak_bw = in_speed + out_speed
        if peak_bw > 500_000_000 and now - self._bw_alert_cooldown > 300:
            self._bw_alert_cooldown = now
            self.add_event(EventType.bandwidth_spike, "info",
                           f"Bandwidth spike: {peak_bw / 1_000_000:.0f} MB/s")

    def add_event(
        self,
        event_type: EventType,
        severity: str,
        message: str,
        node_name: Optional[str] = None,
        node_id: Optional[int] = None,
    ):
        self.events.append(MonitoringEvent(
            timestamp=time.time(),
            event_type=event_type.value,
            severity=severity,
            message=message,
            node_name=node_name,
            node_id=node_id,
        ))

    def update_node_status(
        self,
        node_id: int,
        node_name: str,
        status: str,
        message: Optional[str] = None,
    ):
        now = time.time()
        record = self.node_health.get(node_id)

        if record is None:
            record = NodeHealthRecord(
                node_id=node_id,
                node_name=node_name,
                status=status,
            )
            self.node_health[node_id] = record

        old_status = record.status
        record.status = status
        record.node_name = node_name
        record.uptime_checks += 1

        if status == "connected":
            record.uptime_ok += 1
            record.last_connected = now
        elif status == "error":
            record.last_error = message
            record.last_error_time = now

        if old_status != status:
            if status == "connected" and old_status in ("error", "connecting"):
                self.add_event(
                    EventType.node_connected, "info",
                    f"Node \"{node_name}\" connected",
                    node_name=node_name, node_id=node_id,
                )
            elif status == "error":
                self.add_event(
                    EventType.node_error, "error",
                    f"Node \"{node_name}\": {message or 'connection error'}",
                    node_name=node_name, node_id=node_id,
                )
            elif old_status == "connected" and status != "connected":
                self.add_event(
                    EventType.node_disconnected, "warning",
                    f"Node \"{node_name}\" disconnected",
                    node_name=node_name, node_id=node_id,
                )

    def remove_node(self, node_id: int):
        self.node_health.pop(node_id, None)

    def get_metrics(self, minutes: int = 60) -> List[dict]:
        cutoff = time.time() - (minutes * 60)
        result = []
        for m in self.metrics:
            if m.timestamp >= cutoff:
                result.append({
                    "timestamp": m.timestamp,
                    "cpu_percent": m.cpu_percent,
                    "memory_percent": m.memory_percent,
                    "memory_used": m.memory_used,
                    "memory_total": m.memory_total,
                    "incoming_speed": m.incoming_speed,
                    "outgoing_speed": m.outgoing_speed,
                    "incoming_packets": m.incoming_packets,
                    "outgoing_packets": m.outgoing_packets,
                    "active_connections": m.active_connections,
                    "online_users": m.online_users,
                })
        return result

    def get_events(self, limit: int = 50) -> List[dict]:
        items = list(self.events)
        items.reverse()
        return [
            {
                "timestamp": e.timestamp,
                "event_type": e.event_type,
                "severity": e.severity,
                "message": e.message,
                "node_name": e.node_name,
                "node_id": e.node_id,
            }
            for e in items[:limit]
        ]

    def get_nodes_health(self) -> List[dict]:
        result = []
        for r in self.node_health.values():
            uptime_pct = (r.uptime_ok / r.uptime_checks * 100) if r.uptime_checks > 0 else 0
            result.append({
                "node_id": r.node_id,
                "node_name": r.node_name,
                "status": r.status,
                "uptime_percent": round(uptime_pct, 1),
                "last_connected": r.last_connected,
                "last_error": r.last_error,
                "last_error_time": r.last_error_time,
            })
        return result


monitoring = MonitoringService()


@scheduler.scheduled_job("interval", seconds=10, coalesce=True, max_instances=1)
def _collect_monitoring_metrics():
    monitoring.collect_metrics()
    _sync_node_statuses()


def _sync_node_statuses():
    try:
        from app import xray as xray_module
        for node_id, node_obj in xray_module.nodes.items():
            name = getattr(node_obj, "name", f"Node {node_id}")
            if node_obj.connected:
                monitoring.update_node_status(node_id, name, "connected")
            elif hasattr(node_obj, "error") and node_obj.error:
                monitoring.update_node_status(
                    node_id, name, "error", str(node_obj.error)
                )
            else:
                monitoring.update_node_status(node_id, name, "connecting")
    except Exception:
        pass


def _sync_online_users():
    try:
        if monitoring.metrics:
            from app.db import GetDB
            from app.db import crud
            with GetDB() as db:
                count = crud.count_online_users(db, 24)
                monitoring.metrics[-1].online_users = count
    except Exception:
        pass


@scheduler.scheduled_job("interval", seconds=30, coalesce=True, max_instances=1)
def _collect_online_users():
    _sync_online_users()
