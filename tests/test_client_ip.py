"""IP клиента и выбор IP для устройства подписки (NPVPN-2148)."""

from types import SimpleNamespace

import pytest

from app.utils.client_ip import UNKNOWN_CLIENT_IP, device_ip, get_client_ip

NODES = {"191.10.23.12", "45.12.0.7"}


def _request(headers: dict[str, str] | None = None, host: str | None = "10.0.0.1"):
    client = SimpleNamespace(host=host) if host else None
    return SimpleNamespace(headers=headers or {}, client=client)


def test_client_ip_takes_first_forwarded_address():
    request = _request({"X-Forwarded-For": "8.8.8.8, 10.0.0.2"})
    assert get_client_ip(request) == "8.8.8.8"


def test_client_ip_falls_back_to_peer_address():
    assert get_client_ip(_request()) == "10.0.0.1"


def test_client_ip_without_client_is_unknown():
    assert get_client_ip(_request(host=None)) == UNKNOWN_CLIENT_IP


def test_device_ip_keeps_regular_address():
    assert device_ip("8.8.8.8", NODES) == "8.8.8.8"


def test_device_ip_skips_node_exit_address():
    # Клиент с включённым VPN тянет подписку через туннель — к /sub приходит IP ноды.
    assert device_ip("191.10.23.12", NODES) is None


@pytest.mark.parametrize("raw", [None, "", UNKNOWN_CLIENT_IP])
def test_device_ip_skips_empty_and_unknown(raw):
    assert device_ip(raw, NODES) is None


def test_whitespace_forwarded_header_yields_nothing_to_store():
    # пустой X-Forwarded-For не должен затирать прежний IP.
    assert device_ip(get_client_ip(_request({"X-Forwarded-For": " , 10.0.0.2"})), NODES) is None


@pytest.mark.parametrize("raw", ["garbage", "x" * 100, "1.2.3", "8.8.8.8:80"])
def test_device_ip_skips_non_ip(raw):
    assert device_ip(raw, NODES) is None


@pytest.mark.parametrize("raw", ["172.18.0.1", "10.0.0.5", "127.0.0.1", "192.168.1.10", "::1", "fe80::1"])
def test_device_ip_skips_non_global(raw):
    assert device_ip(raw, NODES) is None


def test_device_ip_normalizes_ipv6():
    assert device_ip("2001:4860:4860:0000:0000:0000:0000:8888", NODES) == "2001:4860:4860::8888"


def test_device_ip_skips_ipv6_node_in_other_notation():
    nodes = {"2001:4860:4860:0:0:0:0:8888", "not-an-ip"}
    assert device_ip("2001:4860:4860::8888", nodes) is None
    assert device_ip("8.8.8.8", nodes) == "8.8.8.8"
