from datetime import datetime

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app import xray
from app.db import get_db
from app.db.models import InboundUsage
from app.models.admin import Admin
from app.routers import system
from app.xray import operations


def build_client(sudo: bool = True) -> TestClient:
    app = FastAPI()
    app.include_router(system.router)

    def fake_sudo():
        if not sudo:
            raise HTTPException(status_code=403, detail="You're not allowed")
        return Admin(username="root", is_sudo=True)

    app.dependency_overrides[Admin.check_sudo_admin] = fake_sudo
    app.dependency_overrides[Admin.get_current] = lambda: Admin(username="root", is_sudo=sudo)
    return TestClient(app)


@pytest.fixture()
def client(db, monkeypatch):
    resyncs = []
    monkeypatch.setattr(operations, "resync_active_users", lambda: resyncs.append(1))
    c = build_client()
    c.resyncs = resyncs
    return c


def test_inbounds_lists_default_coefficient(client):
    data = client.get("/api/inbounds").json()
    tags = {i["tag"]: i["usage_coefficient"] for items in data.values() for i in items}
    assert tags == {"VLESS WS": 1.0, "TROJAN TCP": 1.0}


def test_set_coefficient_updates_cache_response_and_resyncs(client):
    r = client.put("/api/inbounds/VLESS WS/usage-coefficient", json={"usage_coefficient": 2})
    assert r.status_code == 200 and r.json() == {"tag": "VLESS WS", "usage_coefficient": 2}
    assert xray.inbound_coefficients["VLESS WS"] == 2.0
    tags = {i["tag"]: i["usage_coefficient"] for items in client.get("/api/inbounds").json().values() for i in items}
    assert tags["VLESS WS"] == 2.0 and tags["TROJAN TCP"] == 1.0
    assert client.resyncs == [1]


def test_same_value_does_not_resync(client):
    client.put("/api/inbounds/VLESS WS/usage-coefficient", json={"usage_coefficient": 2})
    client.put("/api/inbounds/VLESS WS/usage-coefficient", json={"usage_coefficient": 2})
    assert client.resyncs == [1]


@pytest.mark.parametrize("value", [0, -1, 100.5, "abc", None])
def test_invalid_coefficient_rejected(client, value):
    r = client.put("/api/inbounds/VLESS WS/usage-coefficient", json={"usage_coefficient": value})
    assert r.status_code == 422
    assert client.resyncs == []


def test_unknown_inbound_is_404(client):
    r = client.put("/api/inbounds/nope/usage-coefficient", json={"usage_coefficient": 2})
    assert r.status_code == 404


def test_non_sudo_cannot_set_coefficient(db):
    r = build_client(sudo=False).put("/api/inbounds/VLESS WS/usage-coefficient", json={"usage_coefficient": 2})
    assert r.status_code == 403


def test_usage_endpoint_returns_ratios(client, db):
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    db.add_all([InboundUsage(created_at=now, inbound_tag="a", uplink=1, downlink=3),
                InboundUsage(created_at=now, inbound_tag="b", uplink=0, downlink=4)])
    db.commit()
    r = client.get("/api/inbounds/usage")
    assert r.status_code == 200
    usages = {u["tag"]: u for u in r.json()["usages"]}
    assert usages["a"]["ratio"] == pytest.approx(0.5) and usages["b"]["total"] == 4


def test_hosts_round_trip_keeps_all_extras(client, monkeypatch):
    monkeypatch.setattr(xray.hosts, "update", lambda: None)
    pin = "ab" * 32
    host = {
        "remark": "edge", "address": "e.example.com", "security": "reality",
        "tls_extra": {"ech_config_list": "QUJD", "pinned_peer_cert_sha256": [pin]},
        "reality_extra": {"public_key": "PBK", "short_id": "ab12", "spider_x": "/"},
        "xhttp_extra": {"mode": "packet-up", "xmux": {"max_concurrency": "16-32"}},
        "mux_settings": {"enabled": True, "concurrency": 8},
    }
    assert client.put("/api/hosts", json={"VLESS WS": [host]}).status_code == 200
    got = client.get("/api/hosts").json()["VLESS WS"][0]
    for key in ("tls_extra", "reality_extra", "mux_settings"):
        for field, value in host[key].items():
            assert got[key][field] == value
    assert got["xhttp_extra"]["mode"] == "packet-up"
    assert got["xhttp_extra"]["xmux"]["max_concurrency"] == "16-32"
    assert got["security"] == "reality"


def test_old_clients_without_extras_still_save(client, monkeypatch):
    monkeypatch.setattr(xray.hosts, "update", lambda: None)
    r = client.put("/api/hosts", json={"VLESS WS": [{"remark": "old", "address": "o.com"}]})
    assert r.status_code == 200
    assert r.json()["VLESS WS"][0]["tls_extra"] is None


def test_reality_host_without_key_is_rejected(client):
    r = client.put("/api/hosts", json={"VLESS WS": [{"remark": "r", "address": "a.com", "security": "reality"}]})
    assert r.status_code == 422
