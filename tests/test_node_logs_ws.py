"""The node log stream's handshake.

The same shape as test_core_logs_ws.py, and for the same reason: everything
here happens before the socket is accepted, so it can be exercised without a
core running. The two handlers are near-identical copies, which is how a fix
to one of them came to be missing from the other — a negative interval passed
the check here long after /api/core/logs stopped accepting it.
"""

import pytest
from starlette.websockets import WebSocketDisconnect

from app import xray
from conftest import auth

NODE_ID = 1
URL = f"/api/node/{NODE_ID}/logs"


class FakeNode:
    """Enough of a node to get past the lookup and the connection check."""

    def __init__(self, connected: bool = True):
        self.connected = connected


@pytest.fixture
def node(monkeypatch):
    """One connected node, so the interval check is what a test reaches."""
    monkeypatch.setattr(xray, "nodes", {NODE_ID: FakeNode()})


def connect(client, token=None, **params):
    """Open the stream, returning the close code when it is refused."""
    query = "&".join(f"{key}={value}" for key, value in params.items())
    if token:
        query = f"token={token}&{query}" if query else f"token={token}"

    try:
        with client.websocket_connect(f"{URL}?{query}"):
            return None
    except WebSocketDisconnect as disconnect:
        return disconnect.code


def token_for(admin) -> str:
    return auth(admin)["Authorization"].removeprefix("Bearer ")


class TestAuthentication:
    def test_no_token_is_refused(self, client, node):
        assert connect(client) == 4401

    def test_a_reseller_is_refused(self, client, node, plain_admin):
        assert connect(client, token_for(plain_admin)) == 4403

    def test_authentication_is_checked_before_the_node_exists(self, client, monkeypatch):
        """A stranger must not learn which node ids are real."""
        monkeypatch.setattr(xray, "nodes", {})

        assert connect(client) == 4401


class TestNodeState:
    def test_an_unknown_node_is_refused(self, client, sudo_admin, monkeypatch):
        monkeypatch.setattr(xray, "nodes", {})

        assert connect(client, token_for(sudo_admin)) == 4404

    def test_a_disconnected_node_is_refused(self, client, sudo_admin, monkeypatch):
        monkeypatch.setattr(xray, "nodes", {NODE_ID: FakeNode(connected=False)})

        assert connect(client, token_for(sudo_admin)) == 4400


class TestInterval:
    @pytest.mark.parametrize("interval", ["-5", "-0.5"])
    def test_a_negative_interval_is_refused(self, client, node, sudo_admin, interval):
        """It used to pass the check and then behave like no interval at all,
        while the message said it had to be more than zero."""
        assert connect(client, token_for(sudo_admin), interval=interval) == 4400

    def test_an_interval_past_the_ceiling_is_refused(self, client, node, sudo_admin):
        assert connect(client, token_for(sudo_admin), interval="11") == 4400

    def test_something_that_is_not_a_number_is_refused(self, client, node, sudo_admin):
        assert connect(client, token_for(sudo_admin), interval="soon") == 4400
