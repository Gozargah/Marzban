"""Generating subscription content from a user's proxies and hosts.

This is what every client application actually consumes: if a link comes out
with the wrong port, transport or remark, the panel looks fine and the user
simply cannot connect.
"""

import base64
import json
from urllib.parse import parse_qs, urlparse

import pytest
import yaml

from app import xray
from app.models.proxy import ProxySettings, ProxyTypes
from app.subscription.share import (encode_title, format_time_left,
                                    generate_subscription,
                                    setup_format_variables)

from conftest import make_host

ALL_PROTOCOLS = {
    ProxyTypes.VMess: "VMESS TCP",
    ProxyTypes.VLESS: "VLESS WS",
    ProxyTypes.Trojan: "TROJAN GRPC",
    ProxyTypes.Shadowsocks: "SHADOWSOCKS TCP",
}


def stored_settings(proxy_type: ProxyTypes) -> ProxySettings:
    """Proxy settings the way they come back out of the database.

    The round trip through dict(no_obj=True) is the point: ProxySettings sets
    use_enum_values, which only applies to values that were validated, so a
    default that never was — shadowsocks `method`, vless `flow` — stays an enum
    object. Everything the panel renders has been stored and reloaded first,
    and building the settings in-process instead would test a shape that never
    reaches a real subscription.
    """
    fresh = ProxySettings.from_dict(proxy_type, {})
    return ProxySettings.from_dict(proxy_type, fresh.dict(no_obj=True))


class FakeUser:
    """The duck-typed shape generate_subscription() reads."""

    def __init__(self, username="alice", protocols=None, **extra):
        protocols = protocols or list(ALL_PROTOCOLS)
        self.username = username
        self.status = "active"
        self.expire = None
        self.data_limit = None
        self.used_traffic = 0
        self.on_hold_expire_duration = None
        self.__dict__.update(extra)
        self.proxies = {p: stored_settings(p) for p in protocols}
        self.inbounds = {p: [ALL_PROTOCOLS[p]] for p in protocols}


def links(user, **kwargs) -> list:
    kwargs.setdefault("as_base64", False)
    kwargs.setdefault("reverse", False)
    rendered = generate_subscription(user, "v2ray", **kwargs)
    return rendered.splitlines()


class TestV2rayLinks:
    def test_one_link_per_enabled_inbound(self):
        assert len(links(FakeUser())) == 4

    def test_each_protocol_gets_its_own_scheme(self):
        schemes = [link.split("://")[0] for link in links(FakeUser())]

        assert schemes == ["vmess", "vless", "trojan", "ss"]

    def test_a_protocol_without_settings_is_skipped(self):
        user = FakeUser(protocols=[ProxyTypes.VMess])
        # The inbound is enabled but the user has no trojan credentials.
        user.inbounds[ProxyTypes.Trojan] = ["TROJAN GRPC"]

        assert len(links(user)) == 1

    def test_an_inbound_missing_from_the_config_is_skipped(self):
        user = FakeUser(protocols=[ProxyTypes.VMess])
        user.inbounds[ProxyTypes.VMess] = ["VMESS TCP", "GONE"]

        assert len(links(user)) == 1

    def test_a_user_with_no_hosts_produces_nothing(self, hosts):
        hosts["VMESS TCP"] = []

        assert links(FakeUser(protocols=[ProxyTypes.VMess])) == []

    def test_two_hosts_on_one_inbound_produce_two_links(self, hosts):
        hosts["VMESS TCP"] = [make_host(), make_host(address=["backup.example.com"])]

        assert len(links(FakeUser(protocols=[ProxyTypes.VMess]))) == 2

    def test_links_follow_the_order_of_the_xray_config(self):
        user = FakeUser()
        user.inbounds = {p: [tag] for p, tag in reversed(list(ALL_PROTOCOLS.items()))}

        assert [link.split("://")[0] for link in links(user)] == ["vmess", "vless", "trojan", "ss"]

    def test_reverse_flips_the_order(self):
        assert [link.split("://")[0] for link in links(FakeUser(), reverse=True)] == [
            "ss", "trojan", "vless", "vmess"
        ]

    def test_base64_wraps_the_whole_document(self):
        plain = generate_subscription(FakeUser(), "v2ray", as_base64=False, reverse=False)
        encoded = generate_subscription(FakeUser(), "v2ray", as_base64=True, reverse=False)

        # The credentials are regenerated per call, so compare the shape.
        assert base64.b64decode(encoded).decode().count("\n") == plain.count("\n")

    def test_an_unknown_format_is_refused(self):
        with pytest.raises(ValueError):
            generate_subscription(FakeUser(), "nonsense", as_base64=False, reverse=False)


class TestVlessLink:
    def link(self, **host_overrides):
        if host_overrides:
            xray.hosts["VLESS WS"] = [make_host(**host_overrides)]
        return links(FakeUser(protocols=[ProxyTypes.VLESS]))[0]

    def parsed(self, **host_overrides):
        return urlparse(self.link(**host_overrides))

    def test_address_and_port_come_from_the_inbound_by_default(self):
        url = self.parsed()

        assert url.hostname == "example.com"
        assert url.port == 2002

    def test_a_host_port_overrides_the_inbound_port(self):
        assert self.parsed(port=8443).port == 8443

    def test_the_transport_and_path_are_carried_over(self):
        query = parse_qs(self.parsed().query)

        assert query["type"] == ["ws"]
        assert query["path"] == ["/vless"]

    def test_a_host_path_overrides_the_inbound_path(self):
        assert parse_qs(self.parsed(path="/custom").query)["path"] == ["/custom"]

    def test_tls_is_taken_from_the_inbound(self):
        assert parse_qs(self.parsed().query)["security"] == ["tls"]

    def test_a_host_can_turn_tls_off(self):
        assert parse_qs(self.parsed(tls="none").query)["security"] == ["none"]

    def test_the_sni_is_sent_when_the_host_sets_one(self):
        assert parse_qs(self.parsed(sni=["sni.example.com"]).query)["sni"] == ["sni.example.com"]

    def test_use_sni_as_host_copies_the_sni_into_the_host_header(self):
        query = parse_qs(self.parsed(sni=["sni.example.com"], use_sni_as_host=True).query)

        assert query["host"] == ["sni.example.com"]

    def test_a_star_in_the_address_is_replaced_with_a_random_label(self):
        first = urlparse(self.link(address=["*.example.com"])).hostname
        second = urlparse(self.link(address=["*.example.com"])).hostname

        assert first.endswith(".example.com") and not first.startswith("*")
        assert first != second


class TestRemarks:
    def remark(self, user, **host_overrides):
        xray.hosts["VMESS TCP"] = [make_host(**host_overrides)]
        link = links(user)[0]
        return json.loads(base64.b64decode(link.removeprefix("vmess://")))["ps"]

    def test_the_username_protocol_and_transport_are_substituted(self):
        user = FakeUser(protocols=[ProxyTypes.VMess])

        assert self.remark(user) == "alice (VMess - tcp)"

    def test_traffic_variables_are_substituted(self):
        user = FakeUser(protocols=[ProxyTypes.VMess], data_limit=10 * 1024 ** 3, used_traffic=1024 ** 3)

        assert self.remark(user, remark="{DATA_USAGE} of {DATA_LIMIT}") == "1.0 GB of 10.0 GB"

    def test_an_unlimited_user_reads_as_infinite(self):
        user = FakeUser(protocols=[ProxyTypes.VMess])

        assert self.remark(user, remark="{DATA_LIMIT}/{DAYS_LEFT}") == "∞/∞"

    def test_an_unknown_variable_does_not_raise(self):
        user = FakeUser(protocols=[ProxyTypes.VMess])

        assert self.remark(user, remark="{NOT_A_VARIABLE}") == "<missing>"


class TestOtherFormats:
    """The client-specific formats, for the three uuid/password protocols.

    Shadowsocks has a cipher field each format spells differently, so it gets
    its own class below.
    """

    NO_SHADOWSOCKS = [ProxyTypes.VMess, ProxyTypes.VLESS, ProxyTypes.Trojan]

    @pytest.fixture
    def user(self):
        return FakeUser(protocols=self.NO_SHADOWSOCKS)

    def render(self, user, config_format):
        return generate_subscription(user, config_format, as_base64=False, reverse=False)

    def test_clash_carries_one_proxy_per_supported_link(self, user):
        parsed = yaml.safe_load(self.render(user, "clash"))

        assert all("alice" in proxy["name"] for proxy in parsed["proxies"])

    def test_plain_clash_drops_vless(self, user):
        """Clash without Meta has no vless outbound, so those links are skipped."""
        parsed = yaml.safe_load(self.render(user, "clash"))

        assert [proxy["type"] for proxy in parsed["proxies"]] == ["vmess", "trojan"]

    def test_clash_meta_keeps_vless(self, user):
        parsed = yaml.safe_load(self.render(user, "clash-meta"))

        assert [proxy["type"] for proxy in parsed["proxies"]] == ["vmess", "vless", "trojan"]

    def test_clash_lists_every_proxy_in_its_group(self, user):
        parsed = yaml.safe_load(self.render(user, "clash"))
        names = [proxy["name"] for proxy in parsed["proxies"]]

        assert all(name in parsed["proxy-groups"][0]["proxies"] for name in names)

    def test_sing_box_carries_one_outbound_per_link(self, user):
        outbounds = json.loads(self.render(user, "sing-box"))["outbounds"]
        tags = [outbound["tag"] for outbound in outbounds]

        assert sum("alice" in tag for tag in tags) == 3

    def test_v2ray_json_parses(self, user):
        assert json.loads(self.render(user, "v2ray-json"))

    def test_the_host_address_reaches_the_rendered_config(self, user):
        assert "example.com" in self.render(user, "clash")
        assert "example.com" in self.render(user, "sing-box")


class TestShadowsocks:
    """Shadowsocks carries a cipher name, which every format spells its own way."""

    @pytest.fixture
    def user(self):
        return FakeUser(protocols=[ProxyTypes.Shadowsocks])

    def render(self, user, config_format):
        return generate_subscription(user, config_format, as_base64=False, reverse=False)

    def test_the_link_carries_the_cipher_and_password(self, user):
        userinfo = links(user)[0].split("://")[1].split("@")[0]
        method, _, password = base64.b64decode(
            userinfo + "=" * (-len(userinfo) % 4)
        ).decode().partition(":")

        assert method == "chacha20-ietf-poly1305"
        assert password

    def test_clash_names_it_cipher(self, user):
        proxy = yaml.safe_load(self.render(user, "clash"))["proxies"][0]

        assert proxy["cipher"] == "chacha20-ietf-poly1305"

    def test_sing_box_names_it_method(self, user):
        outbounds = json.loads(self.render(user, "sing-box"))["outbounds"]
        # The template contributes its own outbounds; the user's carry the remark.
        mine = next(o for o in outbounds if "alice" in o.get("tag", ""))

        assert mine["method"] == "chacha20-ietf-poly1305"

    def test_outline_carries_the_whole_access_key(self, user):
        parsed = json.loads(self.render(user, "outline"))

        assert parsed["server"] == "example.com"
        assert parsed["server_port"] == 2004
        assert parsed["method"] == "chacha20-ietf-poly1305"

    def test_v2ray_json_parses(self, user):
        assert json.loads(self.render(user, "v2ray-json"))


class TestFormatHelpers:
    @pytest.mark.parametrize(
        "seconds, expected",
        [
            (0, "∞"),
            (-10, "∞"),
            (30, "30s"),
            (90, "1m 30s"),
            (3 * 24 * 3600, "3d"),
            (65 * 24 * 3600, "2m 5d"),
        ],
    )
    def test_time_left_is_humanised(self, seconds, expected):
        assert format_time_left(seconds) == expected

    def test_titles_are_base64_tagged(self):
        assert encode_title("Xenith") == "base64:WGVuaXRo"

    def test_missing_variables_fall_back_instead_of_raising(self):
        variables = setup_format_variables({"username": "alice", "used_traffic": 0})

        assert variables["ANYTHING_ELSE"] == "<missing>"
        assert variables["USERNAME"] == "alice"
