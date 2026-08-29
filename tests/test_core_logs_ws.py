"""The core log stream's handshake.

Everything here happens before the socket is accepted: who is allowed to
listen, and what a client may ask for. The streaming itself needs a running
core and is not covered.
"""

import pytest
from starlette.websockets import WebSocketDisconnect

from conftest import auth

URL = "/api/core/logs"


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
    def test_no_token_is_refused(self, client):
        assert connect(client) == 4401

    def test_a_reseller_is_refused(self, client, plain_admin):
        assert connect(client, token_for(plain_admin)) == 4403


class TestInterval:
    @pytest.mark.parametrize("interval", ["-5", "-0.5"])
    def test_a_negative_interval_is_refused(self, client, sudo_admin, interval):
        """It used to pass the check and then behave like no interval at all,
        while the message said it had to be more than zero."""
        assert connect(client, token_for(sudo_admin), interval=interval) == 4400

    def test_an_interval_past_the_ceiling_is_refused(self, client, sudo_admin):
        assert connect(client, token_for(sudo_admin), interval="11") == 4400

    def test_something_that_is_not_a_number_is_refused(self, client, sudo_admin):
        assert connect(client, token_for(sudo_admin), interval="soon") == 4400
