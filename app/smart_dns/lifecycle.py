"""Start/stop Smart DNS poller and DNS servers (threads)."""
from __future__ import annotations

import logging
from typing import Optional

from app.smart_dns.cache import MetricsCache
from app.smart_dns.poller import MetricsPoller
from app.smart_dns.server import DNSServer
from config import SMART_DNS_BIND_HOST, SMART_DNS_ENABLED, SMART_DNS_PORT

logger = logging.getLogger("uvicorn.error")

_cache = MetricsCache()
_poller = MetricsPoller(_cache)
_dns_server: Optional[DNSServer] = None


def get_metrics_cache() -> MetricsCache:
    return _cache


def start_smart_dns() -> None:
    global _dns_server
    if not SMART_DNS_ENABLED:
        return
    if _dns_server is not None:
        return
    _poller.start()
    srv: Optional[DNSServer] = None
    try:
        srv = DNSServer(_cache, SMART_DNS_BIND_HOST, SMART_DNS_PORT)
        srv.start()
        _dns_server = srv
    except Exception as e:
        logger.error(
            "Smart DNS could not bind to %s:%s: %s",
            SMART_DNS_BIND_HOST,
            SMART_DNS_PORT,
            e,
        )
        if srv is not None:
            try:
                srv.stop()
            except Exception:
                logger.exception("Smart DNS cleanup after bind failure")
        # Stop the poller too — no point polling if DNS server is dead.
        _poller.stop()
        _dns_server = None


def stop_smart_dns() -> None:
    global _dns_server
    if _dns_server:
        _dns_server.stop()
        _dns_server = None
    _poller.stop()
