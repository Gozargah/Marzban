"""Inbound metadata lookup abstraction.

Until v0.9.0 the DB models and Pydantic user schemas imported
``app.xray`` directly to read inbound metadata
(``inbounds_by_protocol`` and ``inbounds_by_tag``). That forced the
entire Xray subsystem — subprocess version probe, free-port scan,
Xray-config parse, gRPC client construction — to initialize before any
model could be instantiated, blocking isolated unit tests of the
data layer.

This module is the thin shim that breaks the import-time coupling.
Model code now goes through ``get_lookup()`` and reads only the two
operations it actually needs. The default implementation
(``XrayConfigLookup``) lazily imports ``app.xray`` inside each method
so importing this module is itself side-effect-free.

Tests inject a fake via ``set_lookup()`` (see ``tests/test_lookups.py``
and ``tests/test_user_inbounds.py``).

Production behaviour is byte-identical to direct attribute access:
``app.xray.config`` is already initialized by ``app/__init__.py`` long
before any model property runs.
"""

from typing import Dict, List, Protocol


class InboundLookup(Protocol):
    """Minimal surface of inbound metadata the model layer reads.

    Kept deliberately small. Two operations cover every call site
    enumerated in the Task 2 plan.
    """

    def tags_by_protocol(self) -> Dict[str, List[str]]:
        """Mapping of proxy protocol name → list of inbound tags."""
        ...

    def tag_exists(self, tag: str) -> bool:
        """True iff ``tag`` is a registered inbound tag."""
        ...


class XrayConfigLookup:
    """Default implementation backed by ``app.xray.config``.

    The ``app.xray`` import is deliberately lazy: it runs on each call,
    not at module import. This is what lets ``app.db.lookups`` be
    imported without triggering Xray subsystem initialisation.
    """

    def tags_by_protocol(self) -> Dict[str, List[str]]:
        from app import xray
        return {
            protocol: [inbound["tag"] for inbound in inbounds]
            for protocol, inbounds in xray.config.inbounds_by_protocol.items()
        }

    def tag_exists(self, tag: str) -> bool:
        from app import xray
        return tag in xray.config.inbounds_by_tag


_lookup: InboundLookup = XrayConfigLookup()


def get_lookup() -> InboundLookup:
    return _lookup


def set_lookup(lookup: InboundLookup) -> None:
    """Replace the active lookup. Intended for tests only."""
    global _lookup
    _lookup = lookup


def reset_lookup() -> None:
    """Restore the default ``XrayConfigLookup``. Intended for tests."""
    global _lookup
    _lookup = XrayConfigLookup()
