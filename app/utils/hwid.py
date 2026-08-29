"""Identifying the device behind a subscription request.

Several clients — Happ, v2rayTun, Streisand and others — send an installation
identifier with every subscription fetch, along with what they are running on.
The panel remembers those identifiers per user, and a user with a device limit
is served only for as long as the identifier is one of the ones it already
knows, or there is room for another.

What this does and does not do is worth being plain about. It gates the
delivery of a configuration, not the proxy: Xray knows nothing about a HWID,
so a device that already holds a config keeps working after it is removed
here, until the subscription is revoked. The limit stops a link being spread
to new devices; it does not evict the ones already on it.

The identifier is chosen by the client, not derived from the device, so it is
not an attestation of anything. A client that wants to look like several
devices can. This is a limit against casual sharing, not against someone
determined.
"""

import re
from dataclasses import dataclass
from typing import Optional

from config import HWID_HEADER, USERS_DEFAULT_HWID_DEVICE_LIMIT

# What a client tells us about itself. Only the first is the identity; the
# rest are shown to the admin so a row in the device list means something
# more than an opaque string.
OS_HEADER = "x-device-os"
OS_VERSION_HEADER = "x-ver-os"
MODEL_HEADER = "x-device-model"

# The identifier is opaque and client-generated: a UUID from one client, a
# vendor id from another. It is not parsed, only bounded — long enough for
# anything real, short enough that the column cannot be used as storage.
MAX_HWID_LENGTH = 128
MAX_DETAIL_LENGTH = 64

# Anything printable and not whitespace-y. Control characters are refused
# rather than stripped: a client sending them is not one we can identify, and
# quietly folding two different identifiers into one would undercount devices.
HWID_RE = re.compile(r"^[\x21-\x7e]{4,%d}$" % MAX_HWID_LENGTH)


@dataclass(frozen=True)
class DeviceIdentity:
    """What one subscription request said about the device making it."""

    hwid: str
    os: Optional[str] = None
    os_version: Optional[str] = None
    model: Optional[str] = None


def _detail(value: Optional[str]) -> Optional[str]:
    """One of the descriptive headers, trimmed to something displayable."""
    if not value:
        return None
    cleaned = "".join(character for character in value if character.isprintable()).strip()
    return cleaned[:MAX_DETAIL_LENGTH] or None


def identity_from_headers(headers) -> Optional[DeviceIdentity]:
    """The device a request came from, or None when it did not say.

    Headers are a case-insensitive mapping on both Starlette requests and the
    plain dicts the tests use.
    """
    hwid = (headers.get(HWID_HEADER) or "").strip()
    if not HWID_RE.match(hwid):
        return None

    return DeviceIdentity(
        hwid=hwid,
        os=_detail(headers.get(OS_HEADER)),
        os_version=_detail(headers.get(OS_VERSION_HEADER)),
        model=_detail(headers.get(MODEL_HEADER)),
    )


def effective_limit(user) -> int:
    """How many devices this user may use, with 0 meaning no limit.

    Same shape as auto_delete_in_days: the column is NULL for a user who has
    never been given one of their own, and the global setting decides for
    them. A value of zero or less turns the limit off for that user however
    the global setting is configured, which is what makes it possible to
    exempt somebody from a limit that applies to everyone else.
    """
    configured = getattr(user, "hwid_device_limit", None)
    if configured is None:
        configured = USERS_DEFAULT_HWID_DEVICE_LIMIT

    return configured if configured > 0 else 0


def is_enforced(user) -> bool:
    """Whether this user's subscription is gated on the device it is asked for."""
    return effective_limit(user) > 0
