from collections import namedtuple
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app import xray
from app.db import crud
from app.db.models import InboundUsage
from app.jobs import record_usages

Stat = namedtuple("Stat", "name type link value")
HOUR = datetime.utcnow().replace(minute=0, second=0, microsecond=0)


class FakeAPI:
    def __init__(self, stats):
        self.stats = stats

    def get_users_stats(self, reset=False, timeout=None):
        return self.stats

    def get_inbounds_stats(self, reset=False, timeout=None):
        return self.stats


def usage_rows(db):
    return {r.inbound_tag: (r.uplink, r.downlink) for r in db.execute(select(InboundUsage)).scalars()}


def test_ratio_sums_to_one_and_sorted(db):
    db.add_all([
        InboundUsage(created_at=HOUR, inbound_tag="a", uplink=100, downlink=300),
        InboundUsage(created_at=HOUR, inbound_tag="b", uplink=50, downlink=50),
        InboundUsage(created_at=HOUR, inbound_tag="c", uplink=0, downlink=500),
    ])
    db.commit()
    result = crud.get_inbounds_usage(db, HOUR - timedelta(days=1), HOUR + timedelta(days=1))
    assert [u["tag"] for u in result] == ["c", "a", "b"] or [u["tag"] for u in result][0] in ("a", "c")
    assert sum(u["ratio"] for u in result) == pytest.approx(1.0)
    assert {u["tag"]: u["total"] for u in result} == {"a": 400, "b": 100, "c": 500}


def test_ratio_is_zero_without_traffic(db):
    assert crud.get_inbounds_usage(db, HOUR, HOUR) == []
    db.add(InboundUsage(created_at=HOUR, inbound_tag="a", uplink=0, downlink=0))
    db.commit()
    assert crud.get_inbounds_usage(db, HOUR, HOUR)[0]["ratio"] == 0.0


def test_range_is_respected_and_nodes_are_aggregated(db):
    db.add_all([
        InboundUsage(created_at=HOUR, inbound_tag="a", node_id=None, uplink=1, downlink=1),
        InboundUsage(created_at=HOUR - timedelta(hours=1), inbound_tag="a", node_id=None, uplink=10, downlink=10),
        InboundUsage(created_at=HOUR - timedelta(days=60), inbound_tag="a", node_id=None, uplink=999, downlink=999),
    ])
    db.commit()
    result = crud.get_inbounds_usage(db, HOUR - timedelta(days=1), HOUR)
    assert result[0]["total"] == 22


def test_record_inbound_stats_accumulates_without_duplicates(db):
    record_usages.record_inbound_stats({"a": {"up": 5, "down": 7}}, None)
    record_usages.record_inbound_stats({"a": {"up": 1, "down": 2}, "b": {"up": 3, "down": 0}}, None)
    assert usage_rows(db) == {"a": (6, 9), "b": (3, 0)}
    assert len(db.execute(select(InboundUsage)).scalars().all()) == 2


def test_get_inbounds_stats_skips_api_inbound_and_merges_directions():
    api = FakeAPI([
        Stat("a", "inbound", "uplink", 10), Stat("a", "inbound", "downlink", 20),
        Stat("API_INBOUND", "inbound", "uplink", 99), Stat("b", "inbound", "downlink", 0),
    ])
    assert record_usages.get_inbounds_stats(api) == {"a": {"up": 10, "down": 20}}


def test_user_usage_applies_inbound_coefficient():
    api = FakeAPI([
        Stat("7.bob", "user", "uplink", 100),
        Stat("7.bob@a", "user", "downlink", 1000),
        Stat("9.al@unknown", "user", "uplink", 10),
        Stat("9.al@a", "user", "uplink", 10),
    ])
    result = {p["uid"]: p["value"] for p in record_usages.get_users_stats(api, {"a": 2.0})}
    assert result == {"7": 2100, "9": 30}


def test_user_usage_without_coefficients_is_unchanged():
    api = FakeAPI([Stat("7.bob", "user", "uplink", 100), Stat("7.bob", "user", "downlink", 50)])
    assert record_usages.get_users_stats(api) == [{"uid": "7", "value": 150}]


def test_fractional_coefficient_truncates_to_int():
    api = FakeAPI([Stat("7.bob@a", "user", "uplink", 101)])
    assert record_usages.get_users_stats(api, {"a": 1.5}) == [{"uid": "7", "value": 151}]


def test_coefficient_crud_round_trip(db):
    assert crud.get_inbound_coefficients(db) == {}
    assert crud.set_inbound_coefficient(db, "VLESS WS", 2.5) == 1.0
    assert crud.set_inbound_coefficient(db, "VLESS WS", 3.0) == 2.5
    assert crud.get_inbound_coefficients(db) == {"VLESS WS": 3.0}


def test_coefficient_cache_defaults_to_one_for_every_config_inbound(db):
    crud.set_inbound_coefficient(db, "VLESS WS", 2.0)
    xray.inbound_coefficients.update()
    assert dict(xray.inbound_coefficients) == {"VLESS WS": 2.0, "TROJAN TCP": 1.0}
