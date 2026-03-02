"""
Unit tests for app/models/proxy.py

Tests Hysteria2Settings defaults, revoke(), is_external, and pin_sha256.
No DB or Xray connection required.
"""

import pytest

from app.models.proxy import (
    Hysteria2Settings,
    ProxyTypes,
    ShadowsocksSettings,
    TrojanSettings,
    VMessSettings,
)


class TestProxyTypes:
    def test_hysteria2_is_external(self):
        assert ProxyTypes.HYSTERIA2.is_external is True

    def test_other_protocols_not_external(self):
        for pt in (ProxyTypes.VMess, ProxyTypes.VLESS,
                   ProxyTypes.Trojan, ProxyTypes.Shadowsocks):
            assert pt.is_external is False, f"{pt} should not be external"

    def test_hysteria2_account_model_is_none(self):
        """No gRPC account model for Hysteria2 — handled externally."""
        assert ProxyTypes.HYSTERIA2.account_model is None

    def test_hysteria2_settings_model(self):
        assert ProxyTypes.HYSTERIA2.settings_model is Hysteria2Settings


class TestHysteria2Settings:
    def test_default_password_generated(self):
        s = Hysteria2Settings()
        assert s.password
        assert len(s.password) > 0

    def test_two_instances_have_different_passwords(self):
        s1 = Hysteria2Settings()
        s2 = Hysteria2Settings()
        assert s1.password != s2.password

    def test_optional_fields_default_none(self):
        s = Hysteria2Settings()
        assert s.obfs_type is None
        assert s.obfs_password is None
        assert s.masquerade is None
        assert s.up_mbps is None
        assert s.down_mbps is None
        assert s.pin_sha256 is None

    def test_pin_sha256_can_be_set(self):
        s = Hysteria2Settings(pin_sha256="abc123deadbeef")
        assert s.pin_sha256 == "abc123deadbeef"

    def test_revoke_changes_password(self):
        s = Hysteria2Settings()
        old_pw = s.password
        s.revoke()
        assert s.password != old_pw

    def test_custom_password(self):
        s = Hysteria2Settings(password="my-custom-password")
        assert s.password == "my-custom-password"

    def test_obfs_type_set(self):
        s = Hysteria2Settings(obfs_type="salamander", obfs_password="secret")
        assert s.obfs_type == "salamander"
        assert s.obfs_password == "secret"

    def test_dict_no_obj_serialisable(self):
        """dict(no_obj=True) returns a plain dict without non-JSON objects."""
        s = Hysteria2Settings(password="test-pw", pin_sha256="fp1234")
        d = s.dict(no_obj=True)
        assert isinstance(d, dict)
        assert d["password"] == "test-pw"
        assert d["pin_sha256"] == "fp1234"
        assert d["obfs_type"] is None

    def test_up_down_mbps_set(self):
        s = Hysteria2Settings(up_mbps=100, down_mbps=200)
        assert s.up_mbps == 100
        assert s.down_mbps == 200


class TestShadowsocksSettings:
    def test_revoke_changes_password(self):
        from app.models.proxy import ShadowsocksSettings
        s = ShadowsocksSettings()
        old_pw = s.password
        s.revoke()
        assert s.password != old_pw


class TestTrojanSettings:
    def test_revoke_changes_password(self):
        s = TrojanSettings()
        old_pw = s.password
        s.revoke()
        assert s.password != old_pw
