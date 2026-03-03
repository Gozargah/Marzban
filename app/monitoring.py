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
    hysteria_auth_fail = "hysteria_auth_fail"
    hysteria_unreachable = "hysteria_unreachable"


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
class ProtocolSnapshot:
    """Point-in-time stats for a single protocol."""
    timestamp: float
    active_users: int = 0
    traffic_total: int = 0  # bytes accumulated in this interval
    auth_success: int = 0
    auth_fail: int = 0
    errors: int = 0


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
MAX_PROTOCOL_POINTS = 360  # 1h at 10s intervals


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

        # Protocol-specific time-series
        self.protocol_stats: Dict[str, deque] = {
            "hysteria2": deque(maxlen=MAX_PROTOCOL_POINTS),
            "vless": deque(maxlen=MAX_PROTOCOL_POINTS),
            "vmess": deque(maxlen=MAX_PROTOCOL_POINTS),
            "trojan": deque(maxlen=MAX_PROTOCOL_POINTS),
            "shadowsocks": deque(maxlen=MAX_PROTOCOL_POINTS),
        }
        # Accumulators reset each collection cycle
        self._proto_accum: Dict[str, dict] = {}
        self._reset_proto_accum()

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

    # ------------------------------------------------------------------
    # Protocol-specific tracking
    # ------------------------------------------------------------------

    def _reset_proto_accum(self):
        self._proto_accum = {}
        for proto in self.protocol_stats:
            self._proto_accum[proto] = {
                "active_users": 0, "traffic": 0,
                "auth_ok": 0, "auth_fail": 0, "errors": 0,
            }

    def record_hysteria_auth(self, success: bool, client_addr: str = ""):
        acc = self._proto_accum.get("hysteria2")
        if not acc:
            return
        if success:
            acc["auth_ok"] += 1
        else:
            acc["auth_fail"] += 1

    def record_hysteria_traffic(self, total_bytes: int, active_users: int):
        acc = self._proto_accum.get("hysteria2")
        if not acc:
            return
        acc["traffic"] += total_bytes
        acc["active_users"] = max(acc["active_users"], active_users)

    def record_hysteria_error(self, message: str, node_name: Optional[str] = None):
        acc = self._proto_accum.get("hysteria2")
        if acc:
            acc["errors"] += 1
        self.add_event(
            EventType.hysteria_unreachable, "warning", message,
            node_name=node_name,
        )

    def record_xray_traffic(self, protocol: str, total_bytes: int, active_users: int):
        proto_key = protocol.lower()
        acc = self._proto_accum.get(proto_key)
        if not acc:
            return
        acc["traffic"] += total_bytes
        acc["active_users"] = max(acc["active_users"], active_users)

    def flush_protocol_stats(self):
        """Snapshot accumulators into time-series and reset."""
        now = time.time()
        for proto, acc in self._proto_accum.items():
            series = self.protocol_stats.get(proto)
            if series is None:
                continue
            series.append(ProtocolSnapshot(
                timestamp=now,
                active_users=acc["active_users"],
                traffic_total=acc["traffic"],
                auth_success=acc["auth_ok"],
                auth_fail=acc["auth_fail"],
                errors=acc["errors"],
            ))
        self._reset_proto_accum()

    def get_protocol_stats(self, minutes: int = 60) -> Dict[str, List[dict]]:
        cutoff = time.time() - (minutes * 60)
        result: Dict[str, List[dict]] = {}
        for proto, series in self.protocol_stats.items():
            points = []
            for s in series:
                if s.timestamp >= cutoff:
                    points.append({
                        "timestamp": s.timestamp,
                        "active_users": s.active_users,
                        "traffic": s.traffic_total,
                        "auth_success": s.auth_success,
                        "auth_fail": s.auth_fail,
                        "errors": s.errors,
                    })
            if points:
                result[proto] = points
        return result

    def get_protocol_summary(self) -> List[dict]:
        """Aggregate totals from the last 10 minutes per protocol."""
        cutoff = time.time() - 600
        summaries = []
        for proto, series in self.protocol_stats.items():
            total_traffic = 0
            total_auth_ok = 0
            total_auth_fail = 0
            total_errors = 0
            last_active = 0
            count = 0
            for s in series:
                if s.timestamp >= cutoff:
                    total_traffic += s.traffic_total
                    total_auth_ok += s.auth_success
                    total_auth_fail += s.auth_fail
                    total_errors += s.errors
                    last_active = max(last_active, s.active_users)
                    count += 1
            if count > 0:
                summaries.append({
                    "protocol": proto,
                    "active_users": last_active,
                    "traffic_10m": total_traffic,
                    "auth_success": total_auth_ok,
                    "auth_fail": total_auth_fail,
                    "errors": total_errors,
                    "data_points": count,
                })
        return summaries

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
    monitoring.flush_protocol_stats()
    _sync_node_statuses()
    _sync_protocol_users()


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


def _sync_protocol_users():
    """Count active users per protocol from DB proxy assignments."""
    try:
        from app.db import GetDB
        from app.db import models as db_models
        from app.models.user import UserStatus
        from sqlalchemy import func as sa_func

        with GetDB() as db:
            rows = (
                db.query(
                    sa_func.upper(db_models.Proxy.type),
                    sa_func.count(db_models.Proxy.id),
                )
                .join(db_models.User, db_models.User.id == db_models.Proxy.user_id)
                .filter(db_models.User.status == UserStatus.active)
                .group_by(db_models.Proxy.type)
                .all()
            )
            proto_map = {
                "VLESS": "vless",
                "VMESS": "vmess",
                "TROJAN": "trojan",
                "SHADOWSOCKS": "shadowsocks",
                "HYSTERIA2": "hysteria2",
            }
            for type_name, count in rows:
                key = proto_map.get(type_name)
                if key and key in monitoring._proto_accum:
                    monitoring._proto_accum[key]["active_users"] = max(
                        monitoring._proto_accum[key]["active_users"], count
                    )
    except Exception:
        pass
