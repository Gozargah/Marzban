"""Thread-safe cache of per-node metrics for Smart DNS."""
from __future__ import annotations

import ipaddress
import random
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from config import (
    SMART_DNS_SCORE_BW_MULT,
    SMART_DNS_SCORE_CPU_MULT,
)


def _norm_name(name: str) -> str:
    return (name or "").strip().rstrip(".").lower()


def is_valid_metrics_ipv4(value: str) -> bool:
    """dnslib A() only accepts IPv4; invalid values would crash the DNS thread."""
    if not value or not isinstance(value, str):
        return False
    try:
        ipaddress.IPv4Address(value.strip())
        return True
    except (ipaddress.AddressValueError, ValueError):
        return False


@dataclass
class CachedNode:
    node_id: int
    name: str
    address: str
    port: int
    smart_dns_name: str
    announce_ip: str
    consecutive_failures: int = 0
    last_metrics: Optional[Dict[str, Any]] = None
    last_error: Optional[str] = None
    last_poll_ts: float = field(default_factory=time.time)

    def compute_score(self) -> float:
        m = self.last_metrics
        if not isinstance(m, dict):
            return 0.0
        ac = float(m.get("active_connections") or 0)
        bw = float(m.get("bandwidth_mbps") or 0)
        cpu = float(m.get("cpu") or 0)
        return ac + bw * SMART_DNS_SCORE_BW_MULT + cpu * SMART_DNS_SCORE_CPU_MULT

    def is_up(self, fail_threshold: int) -> bool:
        if self.consecutive_failures >= fail_threshold:
            return False
        m = self.last_metrics
        if not isinstance(m, dict):
            return False
        return str(m.get("status", "")).upper() == "UP"


class MetricsCache:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._by_id: Dict[int, CachedNode] = {}

    def merge_from_db_snapshot(self, nodes: List[CachedNode]) -> None:
        with self._lock:
            old = self._by_id
            new: Dict[int, CachedNode] = {}
            for n in nodes:
                prev = old.get(n.node_id)
                if prev:
                    n.consecutive_failures = prev.consecutive_failures
                    n.last_metrics = prev.last_metrics
                    n.last_error = prev.last_error
                    n.last_poll_ts = prev.last_poll_ts
                new[n.node_id] = n
            self._by_id = new

    def update_node_poll(
        self,
        node_id: int,
        success: bool,
        metrics: Optional[Dict[str, Any]],
        error: Optional[str],
    ) -> None:
        with self._lock:
            n = self._by_id.get(node_id)
            if not n:
                return
            n.last_poll_ts = time.time()
            if success and metrics is not None:
                n.consecutive_failures = 0
                n.last_metrics = metrics
                n.last_error = None
            else:
                n.consecutive_failures += 1
                n.last_error = error

    def snapshot(self) -> Dict[int, CachedNode]:
        with self._lock:
            return {k: v for k, v in self._by_id.items()}

    def pools(self) -> Dict[str, List[CachedNode]]:
        with self._lock:
            out: Dict[str, List[CachedNode]] = {}
            for n in self._by_id.values():
                key = _norm_name(n.smart_dns_name)
                if not key:
                    continue
                out.setdefault(key, []).append(n)
            return out

    def pick_a_record(self, qname: str, fail_threshold: int) -> Optional[str]:
        key = _norm_name(qname)
        with self._lock:
            candidates = [
                n
                for n in self._by_id.values()
                if _norm_name(n.smart_dns_name) == key
                and n.is_up(fail_threshold)
                and is_valid_metrics_ipv4(n.announce_ip)
            ]
        if not candidates:
            return None

        eps = 1e-6
        scores = [max(0.0, c.compute_score()) for c in candidates]
        weights = [1.0 / (s + eps) for s in scores]
        chosen = random.choices(candidates, weights=weights, k=1)[0]
        return chosen.announce_ip.strip()


def normalize_dns_name(name: str) -> str:
    return _norm_name(name)
