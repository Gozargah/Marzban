"""Resolving the real client IP behind a reverse proxy.

`X-Forwarded-For` is attacker controlled unless the request actually came
from a proxy we run. TRUSTED_PROXIES lists those proxies; when it is empty
the header is ignored entirely and the peer address is used instead.
"""

import ipaddress
from typing import List, Optional

from config import TRUSTED_PROXIES

UNKNOWN_IP = "Unknown"


def _parse_networks(entries: List[str]) -> Optional[List[ipaddress._BaseNetwork]]:
    """Turn the configured entries into networks, or None when all are trusted."""
    networks = []
    for entry in entries:
        if entry == "*":
            return None
        try:
            networks.append(ipaddress.ip_network(entry, strict=False))
        except ValueError:
            raise ValueError(
                f"TRUSTED_PROXIES contains an invalid IP or CIDR: {entry!r}"
            )
    return networks


# None means "trust every peer", an empty list means "trust nobody".
_trusted_networks = _parse_networks(TRUSTED_PROXIES)


def configure(entries: List[str]) -> None:
    """Replace the trusted proxy list (used by the tests)."""
    global _trusted_networks
    _trusted_networks = _parse_networks(entries)


def _is_trusted(address: str) -> bool:
    if _trusted_networks == []:
        return False
    if _trusted_networks is None:
        return True
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return False
    return any(ip in network for network in _trusted_networks)


def _clean(address: str) -> Optional[str]:
    """Normalise one forwarded entry, dropping anything unparseable."""
    address = address.strip()
    if address.startswith("[") and "]" in address:  # [::1]:1234
        address = address[1:address.index("]")]
    elif address.count(":") == 1:  # 1.2.3.4:1234
        address = address.split(":", 1)[0]

    try:
        return str(ipaddress.ip_address(address))
    except ValueError:
        return None


def get_client_ip(request) -> str:
    """The address of the client, honouring forwarding headers from trusted proxies only."""
    peer = request.client.host if request.client else None

    if not peer or not _is_trusted(peer):
        return peer or UNKNOWN_IP

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        hops = [_clean(hop) for hop in forwarded_for.split(",")]
        hops = [hop for hop in hops if hop]
        # Walk back through the chain and stop at the first hop we don't run;
        # everything to its left was written by someone we don't control.
        for hop in reversed(hops):
            if not _is_trusted(hop):
                return hop
        if hops:
            return hops[0]

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        cleaned = _clean(real_ip)
        if cleaned:
            return cleaned

    return peer


def forwarding_is_unconfigured(address: str) -> bool:
    """Whether this peer looks like a reverse proxy nobody told us about.

    An address on the loopback or a private network, while TRUSTED_PROXIES is
    empty, is what a panel behind an unconfigured nginx looks like: the client
    addresses the panel sees are all the proxy's own.
    """
    if _trusted_networks != []:
        return False
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return False
    # Anything that is not routable on the internet: loopback, the private
    # ranges a container network lives on, and the reserved blocks. A real
    # client reaching the panel directly has a global address.
    return not ip.is_global


def is_secure_request(request) -> bool:
    """Whether the client reached us over HTTPS, TLS-terminating proxies included."""
    peer = request.client.host if request.client else None
    if peer and _is_trusted(peer):
        forwarded_proto = request.headers.get("X-Forwarded-Proto")
        if forwarded_proto:
            return forwarded_proto.split(",")[0].strip().lower() == "https"

    return request.url.scheme in ("https", "wss")
