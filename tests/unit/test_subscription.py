"""
Unit tests for Hysteria2 subscription link generation.

Tests app/subscription/v2ray.py :: V2rayShareLink.hysteria2()
No DB or Xray connection required — pure URL construction.
"""

import urllib.parse as urlparse

import pytest

from app.subscription.v2ray import V2rayJsonConfig, V2rayShareLink


class TestHysteria2Link:
    """Tests for the hy2:// URL builder."""

    def test_basic_link(self):
        """Minimal link: hy2://password@host:port#remark"""
        link = V2rayShareLink.hysteria2(
            remark="My Server",
            address="example.com",
            port=2083,
            password="secret123",
        )
        assert link.startswith("hy2://")
        assert "example.com:2083" in link
        assert urlparse.unquote(link.split("@")[0].replace("hy2://", "")) == "secret123"
        assert link.endswith("#My%20Server")

    def test_password_url_encoded(self):
        """Passwords with special characters must be URL-encoded."""
        link = V2rayShareLink.hysteria2(
            remark="R",
            address="h.com",
            port=443,
            password="pass/word=special",
        )
        # '/' and '=' should be percent-encoded
        raw_pw = link.split("@")[0].replace("hy2://", "")
        assert "/" not in raw_pw
        assert "=" not in raw_pw

    def test_with_salamander_obfs(self):
        """obfs=salamander adds both obfs and obfs-password params."""
        link = V2rayShareLink.hysteria2(
            remark="R",
            address="h.com",
            port=2083,
            password="pw",
            obfs="salamander",
            obfs_password="obfs-secret",
        )
        params = dict(urlparse.parse_qsl(urlparse.urlparse(link).query))
        assert params.get("obfs") == "salamander"
        assert params.get("obfs-password") == "obfs-secret"

    def test_obfs_without_password_omits_obfs_password(self):
        """When obfs_password is empty, the param is omitted."""
        link = V2rayShareLink.hysteria2(
            remark="R",
            address="h.com",
            port=2083,
            password="pw",
            obfs="salamander",
            obfs_password="",
        )
        params = dict(urlparse.parse_qsl(urlparse.urlparse(link).query))
        assert "obfs-password" not in params

    def test_no_obfs_no_obfs_params(self):
        """When obfs is empty, no obfs-related params are added."""
        link = V2rayShareLink.hysteria2(
            remark="R",
            address="h.com",
            port=2083,
            password="pw",
        )
        assert "obfs" not in link

    def test_with_pin_sha256(self):
        """pinSHA256 adds the cert-pinning param."""
        link = V2rayShareLink.hysteria2(
            remark="R",
            address="h.com",
            port=2083,
            password="pw",
            pin_sha256="deadbeef1234",
        )
        params = dict(urlparse.parse_qsl(urlparse.urlparse(link).query))
        assert params.get("pinSHA256") == "deadbeef1234"

    def test_empty_pin_sha256_omitted(self):
        """When pin_sha256 is empty string, no pinSHA256 param is added."""
        link = V2rayShareLink.hysteria2(
            remark="R",
            address="h.com",
            port=2083,
            password="pw",
            pin_sha256="",
        )
        assert "pinSHA256" not in link

    def test_with_sni(self):
        """sni param is included when provided."""
        link = V2rayShareLink.hysteria2(
            remark="R",
            address="h.com",
            port=2083,
            password="pw",
            sni="myserver.example.com",
        )
        params = dict(urlparse.parse_qsl(urlparse.urlparse(link).query))
        assert params.get("sni") == "myserver.example.com"

    def test_insecure_flag(self):
        """ais=1 adds insecure=1 to the link."""
        link = V2rayShareLink.hysteria2(
            remark="R",
            address="h.com",
            port=2083,
            password="pw",
            ais="1",
        )
        params = dict(urlparse.parse_qsl(urlparse.urlparse(link).query))
        assert params.get("insecure") == "1"

    def test_all_params_together(self):
        """All parameters combined produce a complete hy2:// URL."""
        link = V2rayShareLink.hysteria2(
            remark="Full Node",
            address="vpn.example.com",
            port=2083,
            password="my-secret-pw",
            obfs="salamander",
            obfs_password="obfs-key",
            sni="vpn.example.com",
            ais="1",
            pin_sha256="abc123",
        )
        params = dict(urlparse.parse_qsl(urlparse.urlparse(link).query))
        assert params["obfs"] == "salamander"
        assert params["obfs-password"] == "obfs-key"
        assert params["sni"] == "vpn.example.com"
        assert params["insecure"] == "1"
        assert params["pinSHA256"] == "abc123"
        assert "Full%20Node" in link

    def test_no_params_no_query_string(self):
        """When no optional params are given, no '?' appears in the link."""
        link = V2rayShareLink.hysteria2(
            remark="R",
            address="h.com",
            port=2083,
            password="pw",
        )
        assert "?" not in link.split("#")[0]

    def test_remark_url_encoded(self):
        """Spaces and special characters in remark are URL-encoded."""
        link = V2rayShareLink.hysteria2(
            remark="My Server #1 (fast)",
            address="h.com",
            port=2083,
            password="pw",
        )
        fragment = link.split("#", 1)[1]
        assert " " not in fragment


class TestHysteria2V2rayJson:
    """v2ray-json subscription (Happ ≥1.63.1) must include TLS/obfs like hy2://."""

    def test_tls_sni_alpn_defaults(self):
        cfg = V2rayJsonConfig.hysteria2_config(
            address="10.0.0.1",
            port=443,
            password="secret",
            sni="cdn.example.com",
        )
        srv = cfg["servers"][0]
        assert srv["address"] == "10.0.0.1"
        assert srv["tls"]["serverName"] == "cdn.example.com"
        assert srv["tls"]["alpn"] == ["h3"]
        assert srv["tls"]["allowInsecure"] is False
        assert "obfs" not in cfg

    def test_obfs_and_insecure(self):
        cfg = V2rayJsonConfig.hysteria2_config(
            address="1.2.3.4",
            port=8443,
            password="p",
            sni="",
            allow_insecure=True,
            obfs_type="salamander",
            obfs_password="mask",
        )
        assert cfg["servers"][0]["tls"]["serverName"] == "1.2.3.4"
        assert cfg["servers"][0]["tls"]["allowInsecure"] is True
        assert cfg["obfs"] == {"type": "salamander", "password": "mask"}
