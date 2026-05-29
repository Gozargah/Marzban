"""Tests for ``app.db.lookups`` — the InboundLookup abstraction.

Three groups:

1. Contract tests for the default ``XrayConfigLookup``: prove it
   correctly proxies to ``app.xray.config`` (Step-5 test #2).
2. Service-locator round-trip tests for ``get_lookup`` / ``set_lookup``
   / ``reset_lookup`` (Step-5 test #3).
3. An autouse cleanup fixture that resets the lookup between tests to
   prevent cross-test pollution.
"""

import pytest

from app.db import lookups
from app.db.lookups import (
    XrayConfigLookup,
    get_lookup,
    reset_lookup,
    set_lookup,
)


@pytest.fixture(autouse=True)
def _restore_default_lookup():
    """Ensure each test starts with the default XrayConfigLookup."""
    yield
    reset_lookup()


class _FakeLookup:
    def __init__(self, tags=None):
        self._tags = tags or {}
        self.tags_calls = 0
        self.exists_calls = []

    def tags_by_protocol(self):
        self.tags_calls += 1
        return self._tags

    def tag_exists(self, tag):
        self.exists_calls.append(tag)
        return any(tag in t for t in self._tags.values())


# --- Service locator ---------------------------------------------------------


def test_get_lookup_returns_default_when_nothing_was_set():
    assert isinstance(get_lookup(), XrayConfigLookup)


def test_set_lookup_replaces_active_and_reset_restores_default():
    fake = _FakeLookup()
    set_lookup(fake)
    assert get_lookup() is fake

    reset_lookup()
    restored = get_lookup()
    assert isinstance(restored, XrayConfigLookup)
    assert restored is not fake


def test_set_lookup_round_trip_preserves_identity():
    fake = _FakeLookup()
    set_lookup(fake)
    assert get_lookup() is fake
    assert get_lookup() is fake  # idempotent reads


# --- XrayConfigLookup contract ----------------------------------------------


def test_xray_config_lookup_tags_by_protocol_proxies_to_xray_config(monkeypatch):
    # Stand in for app.xray.config — XrayConfigLookup must read .items()
    # from inbounds_by_protocol and project each inbound's "tag" out.
    fake_inbounds = {
        "vmess": [{"tag": "vm-1"}, {"tag": "vm-2"}],
        "vless": [{"tag": "vl-1"}],
        "trojan": [],
    }

    from app import xray
    monkeypatch.setattr(xray.config, "inbounds_by_protocol", fake_inbounds)

    result = XrayConfigLookup().tags_by_protocol()
    assert result == {
        "vmess": ["vm-1", "vm-2"],
        "vless": ["vl-1"],
        "trojan": [],
    }


def test_xray_config_lookup_tag_exists_proxies_to_xray_config(monkeypatch):
    fake_tags = {"vm-1": object(), "vl-1": object()}

    from app import xray
    monkeypatch.setattr(xray.config, "inbounds_by_tag", fake_tags)

    lookup = XrayConfigLookup()
    assert lookup.tag_exists("vm-1") is True
    assert lookup.tag_exists("vl-1") is True
    assert lookup.tag_exists("does-not-exist") is False


# --- Sanity: module-level _lookup default ------------------------------------


def test_module_default_lookup_is_an_xray_config_lookup():
    # Accessing the private attribute is intentional — we want to assert
    # the import-time default really is XrayConfigLookup, not just what
    # get_lookup() happens to return after other tests have run.
    assert isinstance(lookups._lookup, XrayConfigLookup)
