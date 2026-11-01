import json
from collections import defaultdict
from urllib.parse import parse_qs, urlparse

import pytest
import yaml

from app import xray
from app.models.proxy import ProxyHost, ProxyTypes
from app.subscription.clash import ClashMetaConfiguration
from app.subscription.host_extras import apply_host_extras, ech_config_b64, xray_mux
from app.subscription.share import process_inbounds_and_tags
from app.subscription.singbox import SingBoxConfiguration
from app.subscription.v2ray import V2rayJsonConfig, V2rayShareLink

PIN = "ab" * 32
USER = {"id": "11111111-1111-1111-1111-111111111111", "password": "pw", "flow": ""}


def host_dict(**kw) -> dict:
    data = ProxyHost(remark="h", address="edge.example.com", **kw).model_dump(mode="json")
    data["tls"] = None if data["security"] == "inbound_default" else data["security"]
    return data


def inbound(**kw) -> dict:
    base = {
        "tag": "VLESS WS", "protocol": "vless", "network": "ws", "port": 443, "tls": "tls",
        "sni": "x.com", "host": "x.com", "path": "/", "header_type": "",
        "fragment_setting": None, "noise_setting": None,
    }
    return {**base, **kw}


def merged(host: dict, **inbound_kw) -> dict:
    result = inbound(**inbound_kw)
    result["tls_extra"] = None
    result["mux_enable"] = host["mux_enable"]  # share.py copies this before apply_host_extras
    apply_host_extras(result, host)
    return result


def query(link: str) -> dict:
    return {k: v[0] for k, v in parse_qs(urlparse(link).query).items()}


def test_tls_extra_in_vless_link():
    h = host_dict(security="tls", tls_extra={
        "ech_config_list": "QUJD", "pinned_peer_cert_sha256": [PIN, PIN], "verify_peer_cert_by_name": ["a.com", "b.com"]})
    link = V2rayShareLink()
    link.add("r", "x.com", merged(h), USER)
    q = query(link.links[0])
    assert q["ech"] == "QUJD" and q["pcs"] == f"{PIN},{PIN}" and q["vcn"] == "a.com,b.com"


def test_no_extras_leaves_link_unchanged():
    link = V2rayShareLink()
    link.add("r", "x.com", merged(host_dict(security="tls")), USER)
    assert not {"ech", "pcs", "vcn"} & set(query(link.links[0]))


def test_extras_not_emitted_for_non_tls_security():
    h = host_dict(security="none", tls_extra={"ech_config_list": "QUJD"})
    link = V2rayShareLink()
    link.add("r", "x.com", merged(h, tls="none"), USER)
    assert "ech" not in query(link.links[0])


def test_reality_host_overrides_inbound_keys():
    h = host_dict(security="reality", reality_extra={"public_key": "PBK", "short_id": "ab12", "spider_x": "/s"})
    link = V2rayShareLink()
    link.add("r", "x.com", merged(h, tls="reality", network="tcp"), USER)
    q = query(link.links[0])
    assert (q["security"], q["pbk"], q["sid"], q["spx"]) == ("reality", "PBK", "ab12", "/s")


def test_xhttp_extra_maps_to_camel_case_extra():
    h = host_dict(security="tls", xhttp_extra={
        "mode": "packet-up", "x_padding_bytes": "100-1000",
        "xmux": {"max_concurrency": "16-32", "h_keep_alive_period": 30}})
    link = V2rayShareLink()
    link.add("r", "x.com", merged(h, network="xhttp"), USER)
    q = query(link.links[0])
    extra = json.loads(q["extra"])
    assert q["mode"] == "packet-up"
    assert extra["xPaddingBytes"] == "100-1000"
    assert extra["xmux"] == {"maxConcurrency": "16-32", "hKeepAlivePeriod": 30}


def test_json_config_tls_and_mux():
    h = host_dict(security="tls", tls_extra={"ech_config_list": "QUJD", "ech_force_query": "full",
                                             "pinned_peer_cert_sha256": [PIN], "verify_peer_cert_by_name": ["a.com"]},
                  mux_settings={"enabled": True, "concurrency": 8, "xudp_concurrency": 4, "xudp_proxy_udp443": "reject"})
    conf = V2rayJsonConfig()
    conf.add("r", "x.com", merged(h), USER)
    outbound = json.loads(conf.render())[0]["outbounds"][0]
    tls = outbound["streamSettings"]["tlsSettings"]
    assert tls["echConfigList"] == "QUJD" and tls["echForceQuery"] == "full"
    assert tls["pinnedPeerCertSha256"] == PIN and tls["verifyPeerCertByName"] == "a.com"
    assert outbound["mux"]["enabled"] is True and outbound["mux"]["concurrency"] == 8
    assert outbound["mux"]["xudpConcurrency"] == 4 and outbound["mux"]["xudpProxyUDP443"] == "reject"


def test_json_config_without_mux_has_no_mux_block():
    conf = V2rayJsonConfig()
    conf.add("r", "x.com", merged(host_dict(security="tls")), USER)
    assert "mux" not in json.loads(conf.render())[0]["outbounds"][0]


def test_legacy_mux_enable_still_works():
    h = host_dict(security="tls", mux_enable=True)
    conf = V2rayJsonConfig()
    conf.add("r", "x.com", merged(h), USER)
    assert json.loads(conf.render())[0]["outbounds"][0]["mux"]["enabled"] is True


def test_mux_settings_disabled_overrides_legacy_flag():
    h = host_dict(security="tls", mux_enable=True, mux_settings={"enabled": False})
    conf = V2rayJsonConfig()
    conf.add("r", "x.com", merged(h), USER)
    assert "mux" not in json.loads(conf.render())[0]["outbounds"][0]


def test_singbox_gets_ech_only_for_tls():
    h = host_dict(security="tls", tls_extra={"ech_config_list": "QUJD", "pinned_peer_cert_sha256": [PIN]})
    conf = SingBoxConfiguration()
    conf.add("r", "x.com", merged(h), USER)
    proxy = next(o for o in json.loads(conf.render())["outbounds"] if o.get("type") == "vless")
    tls = proxy["tls"]
    assert tls["ech"]["enabled"] is True and "QUJD" in tls["ech"]["config"]
    assert "certificate_public_key_sha256" not in tls


def test_clash_meta_ech_and_pin():
    h = host_dict(security="tls", tls_extra={"ech_config_list": "QUJD", "pinned_peer_cert_sha256": [PIN, "cd" * 32]})
    conf = ClashMetaConfiguration()
    conf.add("r", "x.com", merged(h), USER)
    node = yaml.safe_load(conf.render())["proxies"][0]
    assert node["ech-opts"] == {"enable": True, "config": "QUJD"}
    assert node["fingerprint"] == PIN


def test_doh_style_ech_is_not_written_to_other_clients():
    assert ech_config_b64({"ech_config_list": "example.com+https://dns.google/dns-query"}) is None
    assert ech_config_b64({"ech_config_list": "QUJD"}) == "QUJD"
    assert ech_config_b64(None) is None


def test_xray_mux_defaults():
    assert xray_mux(None, {"concurrency": 8}) == {"concurrency": 8, "enabled": True}


def test_host_extras_do_not_leak_between_hosts(monkeypatch):
    """The second (plain) host must not inherit the first host's reality/xhttp/ech/mux options."""
    first = host_dict(security="tls", tls_extra={"ech_config_list": "QUJD"}, xhttp_extra={"mode": "packet-up"})
    second = host_dict(security="inbound_default")
    second["address"] = "plain.example.com"
    base = inbound(network="xhttp")
    base_hosts = {"VLESS WS": [
        {**first, "address": ["a.com"], "sni": [], "host": [], "fingerprint": "", "alpn": "", "tls": "tls"},
        {**second, "address": ["b.com"], "sni": [], "host": [], "fingerprint": "", "alpn": "", "tls": None},
    ]}
    monkeypatch.setattr(xray.config, "inbounds_by_tag", {"VLESS WS": base})
    monkeypatch.setattr(xray.hosts, "get", lambda tag, default=None: base_hosts.get(tag, default))
    for k in ("sids",):
        base.pop(k, None)
    conf = V2rayShareLink()
    process_inbounds_and_tags(
        {ProxyTypes.VLESS: ["VLESS WS"]}, {ProxyTypes.VLESS: type("S", (), {"model_dump": lambda self: dict(USER)})()},
        defaultdict(lambda: "x", {"PROTOCOL": "vless", "TRANSPORT": "xhttp"}), conf)
    links = conf.links if hasattr(conf, "links") else []
    assert len(links) == 2
    by_host = {urlparse(l).hostname: query(l) for l in links}
    assert by_host["a.com"].get("ech") == "QUJD" and by_host["a.com"].get("mode") == "packet-up"
    assert "ech" not in by_host["b.com"]
    assert by_host["b.com"].get("mode") != "packet-up"


def test_json_config_joins_multiple_pins_and_names_with_commas():
    h = host_dict(security="tls", tls_extra={"pinned_peer_cert_sha256": [PIN, "cd" * 32],
                                             "verify_peer_cert_by_name": ["a.com", "b.com"]})
    conf = V2rayJsonConfig()
    conf.add("r", "x.com", merged(h), USER)
    tls = json.loads(conf.render())[0]["outbounds"][0]["streamSettings"]["tlsSettings"]
    assert tls["pinnedPeerCertSha256"] == f"{PIN},{'cd' * 32}"
    assert tls["verifyPeerCertByName"] == "a.com,b.com"
