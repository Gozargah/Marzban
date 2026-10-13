"""NPVPN-2169: клиентский extra xhttp берётся из инбаунда без дефолтов панели."""

from __future__ import annotations

from app.xray.xhttp_extra import inbound_xhttp_extra


def test_bare_inbound_gives_empty_extra():
    assert inbound_xhttp_extra({"path": "/p", "host": "h.com", "mode": "auto"}) == {}


def test_explicit_values_pass_through_as_is():
    net_settings = {
        "path": "/p",
        "scMaxEachPostBytes": 500000,
        "scMaxConcurrentPosts": 10,
        "scMinPostsIntervalMs": 20,
        "xPaddingBytes": "1-2",
        "noGRPCHeader": False,
        "keepAlivePeriod": 0,
        "xmux": {"maxConcurrency": 16},
    }
    assert inbound_xhttp_extra(net_settings) == {
        "scMaxEachPostBytes": 500000,
        "scMaxConcurrentPosts": 10,
        "scMinPostsIntervalMs": 20,
        "xPaddingBytes": "1-2",
        "noGRPCHeader": False,
        "keepAlivePeriod": 0,
        "xmux": {"maxConcurrency": 16},
    }


def test_result_does_not_alias_inbound_config():
    net_settings = {"xmux": {"maxConcurrency": 16}}
    extra = inbound_xhttp_extra(net_settings)
    extra["xmux"]["maxConcurrency"] = 1
    assert net_settings["xmux"]["maxConcurrency"] == 16
