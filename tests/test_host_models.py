import pytest
from pydantic import ValidationError

from app.models.proxy import ProxyHost, ProxyHostSecurity

PIN = "AB" * 32


def host(**kw):
    return ProxyHost(remark="r", address="example.com", **kw)


def test_legacy_payload_without_new_fields_is_valid():
    h = host(security="tls", mux_enable=True)
    assert h.tls_extra is None and h.reality_extra is None
    assert h.xhttp_extra is None and h.mux_settings is None


def test_pins_are_normalised_and_validated():
    h = host(security="tls", tls_extra={"pinned_peer_cert_sha256": [PIN]})
    assert h.tls_extra.pinned_peer_cert_sha256 == [PIN.lower()]
    with pytest.raises(ValidationError):
        host(tls_extra={"pinned_peer_cert_sha256": ["not-hex"]})
    with pytest.raises(ValidationError):
        host(tls_extra={"pinned_peer_cert_sha256": ["a" * 63]})


def test_reality_requires_public_key():
    with pytest.raises(ValidationError):
        host(security="reality")
    ok = host(security="reality", reality_extra={"public_key": "pbk", "short_id": "ab12"})
    assert ok.security is ProxyHostSecurity.reality


@pytest.mark.parametrize("sid", ["a", "abc", "zz", "a" * 18])
def test_invalid_short_id(sid):
    with pytest.raises(ValidationError):
        host(security="reality", reality_extra={"public_key": "p", "short_id": sid})


def test_empty_short_id_allowed():
    host(security="reality", reality_extra={"public_key": "p", "short_id": ""})


@pytest.mark.parametrize("value", [-2, 1025])
def test_mux_concurrency_bounds(value):
    with pytest.raises(ValidationError):
        host(mux_settings={"enabled": True, "concurrency": value})


def test_invalid_enums_rejected():
    with pytest.raises(ValidationError):
        host(xhttp_extra={"mode": "bogus"})
    with pytest.raises(ValidationError):
        host(tls_extra={"ech_force_query": "bogus"})
    with pytest.raises(ValidationError):
        host(mux_settings={"enabled": True, "xudp_proxy_udp443": "bogus"})
