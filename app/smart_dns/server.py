"""Authoritative DNS (UDP/TCP) for Smart DNS pool names."""
from __future__ import annotations

import logging
import socketserver
import struct
import threading
import time
from typing import Optional

from dnslib import A, DNSHeader, NS, QTYPE, RCODE, RR, SOA, DNSRecord

from app.smart_dns.cache import MetricsCache, normalize_dns_name
from config import (
    SMART_DNS_DEFAULT_TTL,
    SMART_DNS_FAIL_THRESHOLD,
    SMART_DNS_RATE_LIMIT_QPS,
    SMART_DNS_SOA_MNAME,
    SMART_DNS_SOA_RNAME,
    SMART_DNS_SOA_SERIAL,
)

logger = logging.getLogger("uvicorn.error")


class RateLimiter:
    def __init__(self, qps: float) -> None:
        self._qps = max(0.0, qps)
        self._lock = threading.Lock()
        self._state: dict[str, tuple[float, float]] = {}

    def allow(self, ip: str) -> bool:
        if self._qps <= 0:
            return True
        burst = max(1.0, self._qps)
        now = time.monotonic()
        with self._lock:
            tokens, last = self._state.get(ip, (burst, now))
            tokens = min(burst, tokens + (now - last) * self._qps)
            if tokens < 1.0:
                self._state[ip] = (tokens, now)
                return False
            self._state[ip] = (tokens - 1.0, now)
            return True


def _ensure_dot(fqdn: str) -> str:
    s = (fqdn or "").strip()
    if not s.endswith("."):
        s += "."
    return s


class SmartDNSResolver:
    def __init__(self, cache: MetricsCache) -> None:
        self._cache = cache
        self._limiter = RateLimiter(SMART_DNS_RATE_LIMIT_QPS)
        self._soa_mname = _ensure_dot(SMART_DNS_SOA_MNAME)
        self._soa_rname = _ensure_dot(SMART_DNS_SOA_RNAME)
        self._ttl = SMART_DNS_DEFAULT_TTL

    def _known_zones(self) -> set[str]:
        return set(self._cache.pools().keys())

    def handle(self, data: bytes, client_ip: str) -> bytes:
        if not self._limiter.allow(client_ip):
            try:
                d = DNSRecord.parse(data)
                r = DNSRecord(DNSHeader(id=d.header.id, qr=1, aa=1), q=d.q)
                r.header.rcode = RCODE.REFUSED
                return r.pack()
            except Exception:
                return b""

        try:
            d = DNSRecord.parse(data)
        except Exception:
            return b""

        qname = str(d.q.qname)
        norm = normalize_dns_name(qname)
        qtype = d.q.qtype

        zones = self._known_zones()
        if norm not in zones:
            r = DNSRecord(DNSHeader(id=d.header.id, qr=1, aa=1), q=d.q)
            r.header.rcode = RCODE.NXDOMAIN
            return r.pack()

        if qtype not in (QTYPE.A, QTYPE.NS, QTYPE.SOA, QTYPE.ANY):
            r = DNSRecord(DNSHeader(id=d.header.id, qr=1, aa=1), q=d.q)
            r.header.rcode = RCODE.REFUSED
            return r.pack()

        r = DNSRecord(DNSHeader(id=d.header.id, qr=1, aa=1), q=d.q)

        if qtype in (QTYPE.A, QTYPE.ANY):
            ip = self._cache.pick_a_record(qname, SMART_DNS_FAIL_THRESHOLD)
            if not ip:
                r.header.rcode = RCODE.SERVFAIL
                return r.pack()
            try:
                r.add_answer(RR(d.q.qname, QTYPE.A, ttl=self._ttl, rdata=A(ip)))
            except Exception:
                logger.exception("Smart DNS invalid A record for %s", ip)
                r.header.rcode = RCODE.SERVFAIL
                return r.pack()

        if qtype in (QTYPE.NS, QTYPE.ANY):
            r.add_answer(RR(d.q.qname, QTYPE.NS, ttl=self._ttl, rdata=NS(self._soa_mname)))

        if qtype in (QTYPE.SOA, QTYPE.ANY):
            r.add_answer(
                RR(
                    d.q.qname,
                    QTYPE.SOA,
                    ttl=self._ttl,
                    rdata=SOA(
                        mname=self._soa_mname,
                        rname=self._soa_rname,
                        times=(
                            SMART_DNS_SOA_SERIAL,
                            3600,
                            600,
                            604800,
                            self._ttl,
                        ),
                    ),
                )
            )

        return r.pack()


class UDPHandler(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        data = self.request
        resolver: SmartDNSResolver = self.server.resolver  # type: ignore[attr-defined]
        out = resolver.handle(data, self.client_address[0])
        if out:
            self.server.socket.sendto(out, self.client_address)


class TCPHandler(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        conn = self.request
        resolver: SmartDNSResolver = self.server.resolver  # type: ignore[attr-defined]
        try:
            buf = conn.recv(2)
            if len(buf) != 2:
                return
            (length,) = struct.unpack("!H", buf)
            data = b""
            while len(data) < length:
                chunk = conn.recv(length - len(data))
                if not chunk:
                    return
                data += chunk
            out = resolver.handle(data, self.client_address[0])
            if out:
                conn.sendall(struct.pack("!H", len(out)) + out)
        except OSError:
            pass
        finally:
            try:
                conn.close()
            except OSError:
                pass


class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


class ThreadedUDPServer(socketserver.ThreadingMixIn, socketserver.UDPServer):
    allow_reuse_address = True
    daemon_threads = True


class DNSServer:
    def __init__(self, cache: MetricsCache, host: str, port: int) -> None:
        self._resolver = SmartDNSResolver(cache)
        self._host = host
        self._port = port
        self._udp: Optional[ThreadedUDPServer] = None
        self._tcp: Optional[ThreadedTCPServer] = None
        self._threads: list[threading.Thread] = []

    def start(self) -> None:
        try:
            self._udp = ThreadedUDPServer((self._host, self._port), UDPHandler)
            self._udp.resolver = self._resolver
            u = threading.Thread(target=self._udp.serve_forever, name="smart_dns_udp", daemon=True)
            u.start()
            self._threads.append(u)

            self._tcp = ThreadedTCPServer((self._host, self._port), TCPHandler)
            self._tcp.resolver = self._resolver
            t = threading.Thread(target=self._tcp.serve_forever, name="smart_dns_tcp", daemon=True)
            t.start()
            self._threads.append(t)

            logger.info("Smart DNS listening on %s:%s UDP+TCP", self._host, self._port)
        except Exception:
            self.stop()
            raise

    def stop(self) -> None:
        if self._udp:
            self._udp.shutdown()
            self._udp.server_close()
            self._udp = None
        if self._tcp:
            self._tcp.shutdown()
            self._tcp.server_close()
            self._tcp = None
        self._threads.clear()
