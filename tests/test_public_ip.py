"""Working out the host's own public address.

Four sources are tried in turn and the last one is local: a panel with no
outbound access at all still has to come back with something rather than
raise, because this runs while a subscription is being rendered.
"""

import pytest
import requests

from app.utils import system


@pytest.fixture
def failing_lookups(monkeypatch):
    """Every HTTP source refuses to answer."""
    def refuse(*args, **kwargs):
        raise requests.ConnectionError("no route to host")

    monkeypatch.setattr(system.requests, "get", refuse)


def answer(monkeypatch, body: str):
    monkeypatch.setattr(
        system.requests, "get", lambda *a, **kw: type("R", (), {"text": body})()
    )


class TestPublicIP:
    def test_the_first_source_that_answers_wins(self, monkeypatch):
        answer(monkeypatch, " 8.8.4.4\n")

        assert system.get_public_ip() == "8.8.4.4"

    def test_a_body_that_is_not_an_address_is_skipped(self, monkeypatch):
        answer(monkeypatch, "<html>captive portal</html>")

        assert system.get_public_ip() == "127.0.0.1"

    def test_a_private_address_is_not_taken_as_public(self, monkeypatch):
        answer(monkeypatch, "192.168.1.10")

        assert system.get_public_ip() == "127.0.0.1"

    def test_the_socket_route_answers_when_no_source_does(self, failing_lookups, monkeypatch):
        class FakeSocket:
            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

            def connect(self, address):
                pass

            def getsockname(self):
                return ("8.8.4.4", 51234)

        monkeypatch.setattr(system.socket, "socket", lambda *a, **kw: FakeSocket())

        assert system.get_public_ip() == "8.8.4.4"

    def test_running_out_of_descriptors_falls_back_instead_of_raising(
        self, failing_lookups, monkeypatch
    ):
        """The socket is opened inside the try for this reason: closing one
        that was never created used to raise NameError over the real error."""
        def no_descriptors(*args, **kwargs):
            raise OSError(24, "Too many open files")

        monkeypatch.setattr(system.socket, "socket", no_descriptors)

        assert system.get_public_ip() == "127.0.0.1"

    def test_an_interrupt_is_not_swallowed(self, monkeypatch):
        """These blocks used to catch everything, Ctrl-C included."""
        def interrupt(*args, **kwargs):
            raise KeyboardInterrupt

        monkeypatch.setattr(system.requests, "get", interrupt)

        with pytest.raises(KeyboardInterrupt):
            system.get_public_ip()

    def test_ipv6_is_switched_back_on_however_the_lookup_ends(self, monkeypatch):
        """The third source is asked with IPv6 disabled process-wide. Leaving
        it that way would take IPv6 off every other request the panel makes."""
        calls = []

        def third_one_interrupts(*args, **kwargs):
            calls.append(args[0])
            if len(calls) < 3:
                raise requests.ConnectionError("no route to host")
            raise KeyboardInterrupt

        monkeypatch.setattr(system.requests, "get", third_one_interrupts)

        with pytest.raises(KeyboardInterrupt):
            system.get_public_ip()

        assert "ifconfig.io" in calls[2]
        assert requests.packages.urllib3.util.connection.HAS_IPV6 is True


class TestPublicIPv6:
    def test_an_address_is_bracketed(self, monkeypatch):
        answer(monkeypatch, "2001:4860:4860::8888")

        assert system.get_public_ipv6() == "[2001:4860:4860::8888]"

    def test_nothing_reachable_falls_back_to_loopback(self, failing_lookups):
        assert system.get_public_ipv6() == "[::1]"

    def test_a_body_that_is_not_an_address_is_skipped(self, monkeypatch):
        answer(monkeypatch, "nope")

        assert system.get_public_ipv6() == "[::1]"
