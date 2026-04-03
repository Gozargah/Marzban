"""Background HTTP poller: mTLS GET /metrics from each Smart DNS node."""
from __future__ import annotations

import ipaddress
import logging
import os
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, List, Optional, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.poolmanager import PoolManager

from app.db import GetDB, crud
from app.db.models import Node as DBNode
from app.models.node import NodeStatus
from app.smart_dns.cache import CachedNode, MetricsCache
from app.xray.operations import get_tls
from config import SMART_DNS_METRICS_INTERVAL, SMART_DNS_METRICS_TIMEOUT

logger = logging.getLogger("uvicorn.error")

# Maximum concurrent node polls per cycle.
_MAX_POLL_WORKERS = 32


class SANIgnoringAdaptor(HTTPAdapter):
    def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):
        self.poolmanager = PoolManager(
            num_pools=connections,
            maxsize=maxsize,
            block=block,
            assert_hostname=False,
            **pool_kwargs,
        )


def _host_for_https_url(address: str) -> str:
    """Bracket IPv6 literals for https://[...]:port. Supports DB values with or without []."""
    a = (address or "").strip()
    if not a:
        return a
    inner = a.strip("[]")
    host_for_parse = inner.split("%", 1)[0]
    try:
        ipaddress.IPv6Address(host_for_parse)
        return f"[{host_for_parse}]"
    except ipaddress.AddressValueError:
        return a


def _string_to_temp_file(content: str) -> Any:
    f = tempfile.NamedTemporaryFile(mode="w+t", delete=False, suffix=".pem")
    f.write(content)
    f.flush()
    return f


class MetricsPoller:
    def __init__(self, cache: MetricsCache) -> None:
        self._cache = cache
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._cert_files: Tuple[Optional[Any], Optional[Any]] = (None, None)

    def _session(self) -> requests.Session:
        tls = get_tls()
        key_f = _string_to_temp_file(tls["key"])
        cert_f = _string_to_temp_file(tls["certificate"])
        self._cert_files = (key_f, cert_f)
        sess = requests.Session()
        sess.mount("https://", SANIgnoringAdaptor())
        sess.cert = (cert_f.name, key_f.name)
        sess.verify = False
        return sess

    def _load_nodes(self) -> List[CachedNode]:
        with GetDB() as db:
            rows: List[DBNode] = crud.get_nodes(db)
        out: List[CachedNode] = []
        for row in rows:
            if row.status == NodeStatus.disabled:
                continue
            name = (row.smart_dns_name or "").strip()
            if not name:
                continue
            announce = (row.smart_dns_announce_ip or "").strip() or row.address.strip()
            out.append(
                CachedNode(
                    node_id=row.id,
                    name=row.name,
                    address=row.address.strip(),
                    port=row.port,
                    smart_dns_name=name,
                    announce_ip=announce,
                )
            )
        return out

    def _poll_node(self, sess: requests.Session, node_id: int, node: CachedNode) -> None:
        """Poll a single node's /metrics endpoint. Called from a thread-pool worker."""
        url = f"https://{_host_for_https_url(node.address)}:{node.port}/metrics"
        try:
            r = sess.get(url, timeout=SMART_DNS_METRICS_TIMEOUT)
            if r.status_code != 200:
                self._cache.update_node_poll(
                    node_id,
                    False,
                    None,
                    f"HTTP {r.status_code}",
                )
                return
            data = r.json()
            if not isinstance(data, dict):
                self._cache.update_node_poll(
                    node_id,
                    False,
                    None,
                    "metrics JSON must be an object",
                )
                return
            self._cache.update_node_poll(node_id, True, data, None)
        except Exception as e:
            self._cache.update_node_poll(node_id, False, None, str(e))

    def _poll_once(self, sess: requests.Session) -> None:
        self._cache.merge_from_db_snapshot(self._load_nodes())
        snap = self._cache.snapshot()
        if not snap:
            return

        # Poll all nodes in parallel so one slow/dead node cannot stall others.
        workers = min(len(snap), _MAX_POLL_WORKERS)
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(self._poll_node, sess, nid, node): nid
                for nid, node in snap.items()
            }
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception:
                    logger.exception("Smart DNS poll worker raised unexpectedly")

    def is_alive(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def _run(self) -> None:
        # Retry TLS session creation so a transient DB error at startup
        # doesn't kill the poller thread permanently.
        sess = None
        while not self._stop.is_set():
            try:
                sess = self._session()
                break
            except Exception:
                logger.exception(
                    "Smart DNS poller: TLS session creation failed, retrying in 30 s"
                )
                self._stop.wait(30.0)

        if sess is None:
            return  # stop() was called during retry window

        try:
            while not self._stop.is_set():
                t0 = time.monotonic()
                try:
                    self._poll_once(sess)
                except Exception:
                    logger.exception("Smart DNS metrics poll failed")
                elapsed = time.monotonic() - t0
                wait = max(0.5, SMART_DNS_METRICS_INTERVAL - elapsed)
                self._stop.wait(wait)
        finally:
            try:
                sess.close()
            except Exception:
                pass

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="smart_dns_poller", daemon=True)
        self._thread.start()
        logger.info("Smart DNS metrics poller started")

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=8.0)
            self._thread = None
        # Close and delete temp PEM files to avoid accumulation across restarts.
        for f in self._cert_files:
            if f is not None:
                try:
                    f.close()
                except Exception:
                    pass
                try:
                    os.unlink(f.name)
                except Exception:
                    pass
        self._cert_files = (None, None)
