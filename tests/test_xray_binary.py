"""Validate generated configs with the real Xray binary (skipped when it is not installed).

This is the check that catches schema drift between Marzban and a new Xray release.
"""
import json
import shutil
import subprocess

import pytest

from app.models.proxy import ProxyHost
from app.subscription.host_extras import apply_host_extras
from app.subscription.v2ray import V2rayJsonConfig

XRAY = shutil.which("xray") or ("/usr/local/bin/xray" if shutil.which("/usr/local/bin/xray") else None)
pytestmark = pytest.mark.skipif(not XRAY, reason="xray binary not installed")

PIN = "ab" * 32
USER = {"id": "11111111-1111-1111-1111-111111111111"}


def xray_test(tmp_path, config: dict) -> subprocess.CompletedProcess:
    path = tmp_path / "config.json"
    path.write_text(json.dumps(config))
    return subprocess.run([XRAY, "run", "-test", "-c", str(path)], capture_output=True, text=True)


def client_config(host: ProxyHost, network: str, tls: str = "tls") -> dict:
    data = host.model_dump(mode="json")
    data["tls"] = tls
    inbound = {"network": network, "protocol": "vless", "port": 443, "tls": tls, "sni": "x.com", "host": "x.com",
               "path": "/", "header_type": "", "fragment_setting": None, "noise_setting": None, "tls_extra": None,
               "mux_enable": data["mux_enable"], "pbk": "", "sid": "", "spx": ""}
    apply_host_extras(inbound, data)
    conf = V2rayJsonConfig()
    conf.add("r", "x.com", inbound, USER)
    config = json.loads(conf.render())[0]
    config["inbounds"] = [{"port": 10808, "listen": "127.0.0.1", "protocol": "socks"}]
    return config


@pytest.mark.parametrize("network", ["ws", "xhttp", "grpc", "tcp"])
def test_tls_pins_mux_and_xhttp_options_are_accepted(tmp_path, network):
    host = ProxyHost(
        remark="a", address="x.com", security="tls",
        tls_extra={"pinned_peer_cert_sha256": [PIN, "cd" * 32], "verify_peer_cert_by_name": ["x.com", "y.com"],
                   "ech_force_query": "full"},
        mux_settings={"enabled": True, "concurrency": 8, "xudp_concurrency": 4, "xudp_proxy_udp443": "reject"},
        xhttp_extra={"mode": "packet-up", "x_padding_bytes": "100-1000",
                     "xmux": {"max_concurrency": "16-32", "c_max_reuse_times": "64-128"}},
    )
    result = xray_test(tmp_path, client_config(host, network))
    assert result.returncode == 0, result.stdout + result.stderr


def test_reality_host_is_accepted(tmp_path):
    # a syntactically valid x25519 public key (32 bytes, base64url)
    host = ProxyHost(remark="a", address="x.com", security="reality",
                     reality_extra={"public_key": "A" * 43, "short_id": "ab12", "spider_x": "/"})
    result = xray_test(tmp_path, client_config(host, "tcp", tls="reality"))
    assert result.returncode == 0, result.stdout + result.stderr


def test_per_inbound_email_is_accepted_in_server_config(tmp_path):
    """Emails containing a space and '@' (VLESS WS-style tags) must be valid client emails."""
    config = {
        "inbounds": [{
            "tag": "VLESS WS", "port": 10809, "listen": "127.0.0.1", "protocol": "vless",
            "settings": {"decryption": "none", "clients": [
                {"id": USER["id"], "email": "7.bob@VLESS WS"},
                {"id": "22222222-2222-2222-2222-222222222222", "email": "8.al@tag.with.dots"}]},
            "streamSettings": {"network": "ws", "wsSettings": {"path": "/"}},
        }],
        "outbounds": [{"protocol": "freedom"}],
        "stats": {},
        "policy": {"levels": {"0": {"statsUserUplink": True, "statsUserDownlink": True}},
                   "system": {"statsInboundUplink": True, "statsInboundDownlink": True}},
    }
    result = xray_test(tmp_path, config)
    assert result.returncode == 0, result.stdout + result.stderr


def test_invalid_shape_is_really_rejected(tmp_path):
    """Guard the guard: the checker must fail on a config Xray refuses."""
    host = ProxyHost(remark="a", address="x.com", security="tls", tls_extra={"pinned_peer_cert_sha256": [PIN]})
    config = client_config(host, "ws")
    config["outbounds"][0]["streamSettings"]["tlsSettings"]["pinnedPeerCertSha256"] = [PIN]
    assert xray_test(tmp_path, config).returncode != 0
