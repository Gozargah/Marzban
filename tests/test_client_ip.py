import pytest
from starlette.datastructures import Headers

from app.utils import client_ip as module
from app.utils.client_ip import get_client_ip


class FakeClient:
    def __init__(self, host):
        self.host = host


class FakeRequest:
    def __init__(self, peer, **headers):
        self.client = FakeClient(peer) if peer else None
        self.headers = Headers(headers)


@pytest.fixture
def trust():
    """Set the trusted proxy list for one test, then restore the configured one."""
    original = module._trusted_networks
    yield module.configure
    module._trusted_networks = original


class TestWithoutTrustedProxies:
    def test_forwarded_header_is_ignored(self, trust):
        trust([])
        request = FakeRequest("203.0.113.9", **{"X-Forwarded-For": "1.2.3.4"})

        assert get_client_ip(request) == "203.0.113.9"

    def test_real_ip_header_is_ignored(self, trust):
        trust([])

        assert get_client_ip(FakeRequest("203.0.113.9", **{"X-Real-IP": "1.2.3.4"})) == "203.0.113.9"

    def test_missing_client_is_unknown(self, trust):
        trust([])

        assert get_client_ip(FakeRequest(None, **{"X-Forwarded-For": "1.2.3.4"})) == "Unknown"


class TestBehindATrustedProxy:
    def test_forwarded_header_is_used(self, trust):
        trust(["10.0.0.1"])
        request = FakeRequest("10.0.0.1", **{"X-Forwarded-For": "1.2.3.4"})

        assert get_client_ip(request) == "1.2.3.4"

    def test_cidr_entries_match(self, trust):
        trust(["10.0.0.0/8"])

        assert get_client_ip(FakeRequest("10.9.9.9", **{"X-Forwarded-For": "1.2.3.4"})) == "1.2.3.4"

    def test_spoofed_hops_before_the_real_client_are_skipped(self, trust):
        trust(["10.0.0.1"])
        # The client claimed to be 9.9.9.9; our proxy appended the address it
        # actually saw, so the rightmost untrusted hop is the real one.
        request = FakeRequest("10.0.0.1", **{"X-Forwarded-For": "9.9.9.9, 1.2.3.4"})

        assert get_client_ip(request) == "1.2.3.4"

    def test_chained_trusted_proxies_are_walked_through(self, trust):
        trust(["10.0.0.0/8"])
        request = FakeRequest("10.0.0.1", **{"X-Forwarded-For": "1.2.3.4, 10.0.0.2, 10.0.0.3"})

        assert get_client_ip(request) == "1.2.3.4"

    def test_falls_back_to_real_ip(self, trust):
        trust(["10.0.0.1"])

        assert get_client_ip(FakeRequest("10.0.0.1", **{"X-Real-IP": "1.2.3.4"})) == "1.2.3.4"

    def test_falls_back_to_peer_without_headers(self, trust):
        trust(["10.0.0.1"])

        assert get_client_ip(FakeRequest("10.0.0.1")) == "10.0.0.1"

    def test_garbage_hops_are_dropped(self, trust):
        trust(["10.0.0.1"])
        request = FakeRequest("10.0.0.1", **{"X-Forwarded-For": "not-an-ip, 1.2.3.4, bogus"})

        assert get_client_ip(request) == "1.2.3.4"

    def test_only_garbage_falls_back_to_peer(self, trust):
        trust(["10.0.0.1"])

        assert get_client_ip(FakeRequest("10.0.0.1", **{"X-Forwarded-For": "unknown"})) == "10.0.0.1"

    def test_ports_are_stripped(self, trust):
        trust(["10.0.0.1"])
        request = FakeRequest("10.0.0.1", **{"X-Forwarded-For": "1.2.3.4:51234"})

        assert get_client_ip(request) == "1.2.3.4"

    def test_ipv6_hops_are_supported(self, trust):
        trust(["10.0.0.1"])
        request = FakeRequest("10.0.0.1", **{"X-Forwarded-For": "[2001:db8::1]:443"})

        assert get_client_ip(request) == "2001:db8::1"


class TestUntrustedPeer:
    def test_direct_client_cannot_spoof(self, trust):
        trust(["10.0.0.1"])
        request = FakeRequest("203.0.113.9", **{"X-Forwarded-For": "1.2.3.4"})

        assert get_client_ip(request) == "203.0.113.9"


class TestWildcard:
    def test_star_trusts_every_peer(self, trust):
        trust(["*"])
        request = FakeRequest("203.0.113.9", **{"X-Forwarded-For": "1.2.3.4"})

        assert get_client_ip(request) == "1.2.3.4"


class TestUnconfiguredForwarding:
    """What tells the panel its client addresses are probably a proxy's own."""

    @pytest.mark.parametrize("address", ["127.0.0.1", "::1", "10.0.0.1", "192.168.1.4", "172.17.0.1"])
    def test_a_local_peer_with_nothing_trusted_is_flagged(self, trust, address):
        trust([])

        assert module.forwarding_is_unconfigured(address) is True

    def test_a_routable_peer_is_not(self, trust):
        """8.8.8.8 rather than the 203.0.113.0/24 used elsewhere here: that one
        is documentation space, which ipaddress counts as private."""
        trust([])

        assert module.forwarding_is_unconfigured("8.8.8.8") is False

    def test_nothing_is_flagged_once_a_proxy_is_trusted(self, trust):
        trust(["127.0.0.1"])

        assert module.forwarding_is_unconfigured("127.0.0.1") is False

    def test_an_unparseable_address_is_not_flagged(self, trust):
        trust([])

        assert module.forwarding_is_unconfigured("Unknown") is False


class TestConfigValidation:
    def test_invalid_entry_is_rejected(self):
        with pytest.raises(ValueError, match="TRUSTED_PROXIES"):
            module._parse_networks(["not-a-network"])
