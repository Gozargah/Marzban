"""Tests for Happ subscription: announce encoding, serverDescription fragments, v2ray-json meta."""

import base64
import urllib.parse as urlparse

from app.subscription.share import encode_subscription_announce
from app.subscription.v2ray import V2rayJsonConfig, append_happ_server_description


class TestAppendHappServerDescription:
    def test_empty_description_returns_unchanged(self):
        link = "vless://u@h:443?type=tcp#Title"
        assert append_happ_server_description(link, "Title", None) == link
        assert append_happ_server_description(link, "Title", "") == link

    def test_vless_appends_query_to_fragment(self):
        link = "vless://u@h:443?type=tcp#My%20Title"
        desc = "Line two"
        out = append_happ_server_description(link, "My Title", desc)
        frag = urlparse.urlparse(out).fragment
        assert frag.startswith("My%20Title?serverDescription=")
        b64 = frag.split("serverDescription=", 1)[1]
        assert base64.b64decode(b64).decode("utf-8") == desc

    def test_vmess_no_fragment_gets_title_and_description(self):
        b64 = base64.b64encode(b'{"v":"2"}').decode()
        link = f"vmess://{b64}"
        out = append_happ_server_description(link, "Node A", "fast")
        frag = urlparse.urlparse(out).fragment
        assert frag.startswith(urlparse.quote("Node A") + "?serverDescription=")

    def test_idempotent_when_already_present(self):
        link = "vless://u@h:443#t?serverDescription=eA=="
        assert append_happ_server_description(link, "t", "x") == link


class TestEncodeSubscriptionAnnounce:
    def test_roundtrip_base64_prefix(self):
        raw = "Привет"
        enc = encode_subscription_announce(raw)
        assert enc.startswith("base64:")
        payload = enc.split(":", 1)[1]
        assert base64.b64decode(payload).decode("utf-8") == raw


class TestV2rayJsonMeta:
    def test_add_config_sets_meta_server_description(self):
        cfg = V2rayJsonConfig.__new__(V2rayJsonConfig)
        cfg.template = '{"remarks":"","outbounds":[]}'
        cfg.config = []
        V2rayJsonConfig.add_config(
            cfg,
            "R1",
            [{"tag": "proxy", "protocol": "vless"}],
            server_description="caption",
        )
        assert len(cfg.config) == 1
        assert cfg.config[0]["meta"]["serverDescription"] == "caption"

    def test_add_config_omits_meta_without_description(self):
        cfg = V2rayJsonConfig.__new__(V2rayJsonConfig)
        cfg.template = '{"remarks":"","outbounds":[]}'
        cfg.config = []
        V2rayJsonConfig.add_config(
            cfg,
            "R1",
            [{"tag": "proxy", "protocol": "vless"}],
            server_description=None,
        )
        assert "meta" not in cfg.config[0]
