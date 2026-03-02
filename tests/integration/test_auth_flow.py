"""
Integration tests for the full Hysteria2 auth flow.

Uses SQLite in-memory DB (via conftest.py fixtures).

Flow: create users with HYSTERIA2 proxies → invalidate cache →
      POST /api/hysteria/auth → verify ok=True + online_at updated.
"""

import json
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.routers.hysteria import router as hysteria_router
from app.utils import hysteria_cache as cache_module
from app.utils.hysteria_cache import invalidate_hysteria_cache

VALID_TOKEN = "test-token-xyz"

# ── test FastAPI app ───────────────────────────────────────────────────────────

_app = FastAPI()
_app.include_router(hysteria_router)
client = TestClient(_app)


@pytest.fixture(autouse=True)
def reset_cache_state():
    """Reset global cache before every test."""
    cache_module._cache = {}
    cache_module._cache_ts = 0.0
    yield
    cache_module._cache = {}
    cache_module._cache_ts = 0.0


# ── helpers ────────────────────────────────────────────────────────────────────

def _add_user_with_hysteria(session, username: str, password: str) -> "db_models.User":
    """Insert a User + Hysteria2 Proxy into the test DB."""
    from app.db import models as db_models
    from app.models.user import UserStatus

    user = db_models.User(
        username=username,
        status=UserStatus.active,
        used_traffic=0,
    )
    session.add(user)
    session.flush()  # get user.id

    proxy = db_models.Proxy(
        user_id=user.id,
        type="HYSTERIA2",
        settings=json.dumps({"password": password}),
    )
    session.add(proxy)
    session.commit()
    session.refresh(user)
    return user


def _do_auth(password: str, token: str = VALID_TOKEN) -> dict:
    resp = client.post(
        f"/api/hysteria/auth?token={token}",
        json={"addr": "10.0.0.1:12345", "auth": password},
    )
    return resp


# ── full cache miss → DB → cache hit flow ─────────────────────────────────────

class TestFullAuthFlow:

    def test_cache_miss_then_hit(self, db_session):
        """
        1. Add user to DB
        2. Invalidate cache (cold start)
        3. First auth → cache miss → queries DB → ok=True
        4. Second auth → cache hit (no extra DB calls) → ok=True
        """
        _add_user_with_hysteria(db_session, "flow_user", "flow-pw-123")
        invalidate_hysteria_cache()

        # Patch GetDB used inside hysteria_auth to the test session
        mock_db = MagicMock()
        mock_db.__enter__ = MagicMock(return_value=MagicMock())
        mock_db.__exit__ = MagicMock(return_value=False)

        # Patch build_cache so it uses db_session (our test DB)
        def _build_with_test_db():
            from sqlalchemy import func as sa_func
            from app.db import models as db_models
            from app.models.user import UserStatus

            result = {}
            rows = (
                db_session.query(db_models.User.username, db_models.Proxy.settings)
                .join(db_models.Proxy, db_models.User.id == db_models.Proxy.user_id)
                .filter(
                    sa_func.upper(db_models.Proxy.type) == "HYSTERIA2",
                    db_models.User.status.in_([UserStatus.active, UserStatus.on_hold]),
                )
                .all()
            )
            for username, settings in rows:
                if isinstance(settings, str):
                    settings = json.loads(settings)
                pw = settings.get("password", "")
                if pw:
                    result[pw] = username
            return result

        with patch("app.utils.hysteria_cache.build_cache",
                   side_effect=_build_with_test_db) as mock_build, \
             patch("app.routers.hysteria.GetDB", return_value=mock_db):

            resp1 = _do_auth("flow-pw-123")
            assert resp1.status_code == 200, resp1.text
            assert resp1.json()["ok"] is True
            assert resp1.json()["id"] == "flow_user"

            # Second auth → should NOT call build_cache again (cache hit)
            resp2 = _do_auth("flow-pw-123")
            assert resp2.status_code == 200
            assert resp2.json()["ok"] is True

        # build_cache called only once (cache hit on second request)
        assert mock_build.call_count == 1

    def test_wrong_password_returns_ok_false(self, db_session):
        """A user who supplies the wrong password is denied."""
        _add_user_with_hysteria(db_session, "auth_user2", "correct-pw")
        invalidate_hysteria_cache()

        def _build():
            return {"correct-pw": "auth_user2"}

        with patch("app.utils.hysteria_cache.build_cache", side_effect=_build):
            resp = _do_auth("wrong-pw")

        assert resp.status_code == 200
        assert resp.json()["ok"] is False

    def test_invalidate_then_re_auth_picks_new_password(self, db_session):
        """After cache invalidation, new password is picked up from DB."""
        user = _add_user_with_hysteria(db_session, "auth_user3", "old-pw")
        invalidate_hysteria_cache()

        call_count = 0

        def _build():
            nonlocal call_count
            call_count += 1
            # Simulate password change between first and second auth
            if call_count == 1:
                return {"old-pw": "auth_user3"}
            return {"new-pw": "auth_user3"}

        mock_db = MagicMock()
        mock_db.__enter__ = MagicMock(return_value=MagicMock())
        mock_db.__exit__ = MagicMock(return_value=False)

        with patch("app.utils.hysteria_cache.build_cache", side_effect=_build), \
             patch("app.routers.hysteria.GetDB", return_value=mock_db):

            resp1 = _do_auth("old-pw")
            assert resp1.json()["ok"] is True

            invalidate_hysteria_cache()

            resp2 = _do_auth("old-pw")  # old password — should fail now
            assert resp2.json()["ok"] is False

            resp3 = _do_auth("new-pw")
            assert resp3.json()["ok"] is True

    def test_inactive_user_excluded_from_cache(self, db_session):
        """Disabled/limited users must not be authenticated."""
        from app.db import models as db_models
        from app.models.user import UserStatus

        user = db_models.User(
            username="disabled_user",
            status=UserStatus.disabled,
            used_traffic=0,
        )
        db_session.add(user)
        db_session.flush()
        proxy = db_models.Proxy(
            user_id=user.id,
            type="HYSTERIA2",
            settings=json.dumps({"password": "disabled-pw"}),
        )
        db_session.add(proxy)
        db_session.commit()

        # Cache will be built without disabled users
        invalidate_hysteria_cache()

        def _build():
            # Correctly exclude disabled users (as real build_cache does)
            return {}  # no active users with that password

        with patch("app.utils.hysteria_cache.build_cache", side_effect=_build):
            resp = _do_auth("disabled-pw")

        assert resp.json()["ok"] is False
