"""
Unit tests for the Hysteria2 auth endpoint.

app/routers/hysteria.py :: POST /api/hysteria/auth

Uses a standalone FastAPI test app to avoid importing the full Marzban
application (which requires a running Xray process).
"""

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# ── minimal test app (no full Marzban startup) ────────────────────────────────

from app.routers.hysteria import router as hysteria_router

_test_app = FastAPI()
_test_app.include_router(hysteria_router)

client = TestClient(_test_app)

VALID_TOKEN = "test-token-xyz"   # matches os.environ set in conftest.py


def _make_auth_request(auth_password: str, token: str = "",
                       use_header: bool = False) -> dict:
    """Helper: POST to /api/hysteria/auth."""
    url = "/api/hysteria/auth"
    if token and not use_header:
        url += f"?token={token}"

    headers = {"Content-Type": "application/json"}
    if use_header and token:
        headers["Authorization"] = f"Bearer {token}"

    body = {"addr": "1.2.3.4:50000", "auth": auth_password}
    return client.post(url, json=body, headers=headers)


# ── token validation ───────────────────────────────────────────────────────────

class TestTokenValidation:
    def test_missing_token_returns_403(self):
        with patch("app.routers.hysteria.get_cache", return_value={}):
            resp = _make_auth_request("any-password", token="")
        assert resp.status_code == 403

    def test_wrong_token_returns_403(self):
        with patch("app.routers.hysteria.get_cache", return_value={}):
            resp = _make_auth_request("any-password", token="wrong-token")
        assert resp.status_code == 403
        assert "Invalid hook token" in resp.json()["detail"]

    def test_valid_token_query_param_returns_200(self):
        with patch("app.routers.hysteria.get_cache", return_value={}):
            resp = _make_auth_request("pw", token=VALID_TOKEN)
        assert resp.status_code == 200

    def test_valid_token_bearer_header_returns_200(self):
        """Token in Authorization: Bearer header is accepted."""
        with patch("app.routers.hysteria.get_cache", return_value={}):
            resp = _make_auth_request("pw", token=VALID_TOKEN, use_header=True)
        assert resp.status_code == 200

    def test_bearer_header_takes_effect_when_no_query_param(self):
        """If query param is absent, Bearer header provides the token."""
        with patch("app.routers.hysteria.get_cache", return_value={}):
            # Pass token only via header (no ?token= in URL)
            resp = client.post(
                "/api/hysteria/auth",
                json={"addr": "1.2.3.4:1", "auth": "pw"},
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {VALID_TOKEN}",
                },
            )
        assert resp.status_code == 200


# ── password lookup ────────────────────────────────────────────────────────────

class TestPasswordLookup:
    def test_valid_password_returns_ok_true(self):
        cache = {"secret-password": "alice"}
        with patch("app.routers.hysteria.get_cache", return_value=cache), \
             patch("app.routers.hysteria.GetDB") as mock_db:
            mock_db.return_value.__enter__ = MagicMock(return_value=MagicMock())
            mock_db.return_value.__exit__ = MagicMock(return_value=False)
            resp = _make_auth_request("secret-password", token=VALID_TOKEN)

        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["id"] == "alice"

    def test_wrong_password_returns_ok_false(self):
        cache = {"right-password": "bob"}
        with patch("app.routers.hysteria.get_cache", return_value=cache):
            resp = _make_auth_request("wrong-password", token=VALID_TOKEN)

        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is False
        assert data["id"] == ""

    def test_empty_auth_returns_ok_false(self):
        cache = {"pw": "user"}
        with patch("app.routers.hysteria.get_cache", return_value=cache):
            resp = client.post(
                f"/api/hysteria/auth?token={VALID_TOKEN}",
                json={"addr": "1.2.3.4:1", "auth": ""},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is False

    def test_valid_password_response_includes_username(self):
        cache = {"my-pw": "carol"}
        with patch("app.routers.hysteria.get_cache", return_value=cache), \
             patch("app.routers.hysteria.GetDB") as mock_db:
            ctx = MagicMock()
            mock_db.return_value.__enter__ = MagicMock(return_value=ctx)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)
            resp = _make_auth_request("my-pw", token=VALID_TOKEN)

        assert resp.json()["id"] == "carol"


# ── online_at update ───────────────────────────────────────────────────────────

class TestOnlineAtUpdate:
    def test_successful_auth_updates_online_at(self):
        """A valid auth must trigger a DB update of User.online_at."""
        cache = {"valid-pw": "dave"}
        mock_db_session = MagicMock()

        with patch("app.routers.hysteria.get_cache", return_value=cache), \
             patch("app.routers.hysteria.GetDB") as mock_db_cls:
            mock_db_cls.return_value.__enter__ = MagicMock(return_value=mock_db_session)
            mock_db_cls.return_value.__exit__ = MagicMock(return_value=False)
            resp = _make_auth_request("valid-pw", token=VALID_TOKEN)

        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        # DB session must have been used to execute the update
        mock_db_session.execute.assert_called_once()
        mock_db_session.commit.assert_called_once()

    def test_failed_auth_does_not_touch_db(self):
        """A failed auth (wrong password) must not update the DB."""
        cache = {"right-pw": "user"}
        with patch("app.routers.hysteria.get_cache", return_value=cache), \
             patch("app.routers.hysteria.GetDB") as mock_db_cls:
            resp = _make_auth_request("wrong-pw", token=VALID_TOKEN)

        assert resp.status_code == 200
        assert resp.json()["ok"] is False
        mock_db_cls.assert_not_called()
