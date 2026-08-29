"""The /api/admin endpoints, from login to the sudo-only operations.

The existing suite covers the cookie and the rate limiter as units; this
exercises them through the real login endpoint, and covers the privilege
rules that decide who may create, edit or delete an admin.
"""

import pytest

from app.db import crud
from app.models.admin import AdminCreate
from app.utils.auth_cookie import ACCESS_TOKEN_COOKIE_NAME
from app.utils.jwt import get_admin_payload

from conftest import auth, new_user


@pytest.fixture(autouse=True)
def clean_rate_limiter():
    from app.routers.admin import login_rate_limiter

    login_rate_limiter.clear()
    yield
    login_rate_limiter.clear()


def login(client, username, password):
    return client.post("/api/admin/token", data={"username": username, "password": password})


class TestLogin:
    def test_correct_credentials_return_a_token(self, client, sudo_admin):
        response = login(client, "root", "rootpw")

        assert response.status_code == 200
        assert get_admin_payload(response.json()["access_token"])["username"] == "root"

    def test_the_token_carries_the_sudo_flag(self, client, sudo_admin, plain_admin):
        sudo = login(client, "root", "rootpw").json()["access_token"]
        plain = login(client, "reseller", "resellerpw").json()["access_token"]

        assert get_admin_payload(sudo)["is_sudo"] is True
        assert get_admin_payload(plain)["is_sudo"] is False

    def test_a_session_cookie_is_set(self, client, sudo_admin):
        response = login(client, "root", "rootpw")

        assert response.cookies[ACCESS_TOKEN_COOKIE_NAME]

    def test_the_cookie_is_httponly_and_strict(self, client, sudo_admin):
        header = login(client, "root", "rootpw").headers["set-cookie"].lower()

        assert "httponly" in header
        assert "samesite=strict" in header

    def test_the_cookie_alone_authenticates_the_next_request(self, client, sudo_admin):
        login(client, "root", "rootpw")

        assert client.get("/api/admin").status_code == 200

    def test_a_wrong_password_is_rejected(self, client, sudo_admin):
        assert login(client, "root", "wrong").status_code == 401

    def test_an_unknown_username_is_rejected(self, client, sudo_admin):
        assert login(client, "nobody", "rootpw").status_code == 401

    def test_a_failed_login_sets_no_cookie(self, client, sudo_admin):
        assert ACCESS_TOKEN_COOKIE_NAME not in login(client, "root", "wrong").cookies

    def test_repeated_failures_are_rate_limited(self, client, sudo_admin, monkeypatch):
        from app.routers import admin as admin_router

        monkeypatch.setattr(admin_router.login_rate_limiter, "attempts", 3)
        monkeypatch.setattr(admin_router.login_rate_limiter, "window", 300)

        for _ in range(3):
            assert login(client, "root", "wrong").status_code == 401

        blocked = login(client, "root", "wrong")
        assert blocked.status_code == 429
        assert int(blocked.headers["retry-after"]) > 0

    def test_the_correct_password_is_also_blocked_while_limited(self, client, sudo_admin, monkeypatch):
        from app.routers import admin as admin_router

        monkeypatch.setattr(admin_router.login_rate_limiter, "attempts", 2)
        monkeypatch.setattr(admin_router.login_rate_limiter, "window", 300)
        for _ in range(2):
            login(client, "root", "wrong")

        assert login(client, "root", "rootpw").status_code == 429

    def test_one_account_being_flooded_does_not_lock_out_another(
        self, client, sudo_admin, plain_admin, monkeypatch
    ):
        """Behind an unconfigured proxy every client shares one address, so
        counting by address alone would lock the whole panel."""
        from app.routers import admin as admin_router

        monkeypatch.setattr(admin_router.login_rate_limiter, "attempts", 2)
        monkeypatch.setattr(admin_router.login_rate_limiter, "window", 300)
        for _ in range(3):
            login(client, "root", "wrong")

        assert login(client, "root", "rootpw").status_code == 429
        assert login(client, "reseller", "resellerpw").status_code == 200

    def test_the_case_of_the_username_does_not_start_a_fresh_count(
        self, client, sudo_admin, monkeypatch
    ):
        from app.routers import admin as admin_router

        monkeypatch.setattr(admin_router.login_rate_limiter, "attempts", 2)
        monkeypatch.setattr(admin_router.login_rate_limiter, "window", 300)
        login(client, "root", "wrong")
        login(client, "ROOT", "wrong")

        assert login(client, "Root", "wrong").status_code == 429

    def test_a_success_clears_the_counter(self, client, sudo_admin, monkeypatch):
        from app.routers import admin as admin_router

        monkeypatch.setattr(admin_router.login_rate_limiter, "attempts", 3)
        monkeypatch.setattr(admin_router.login_rate_limiter, "window", 300)
        login(client, "root", "wrong")
        login(client, "root", "rootpw")

        for _ in range(2):
            assert login(client, "root", "wrong").status_code == 401


class TestEnvironmentSudoer:
    """SUDO_USERNAME / SUDO_PASSWORD from .env, checked before the database."""

    @pytest.fixture
    def env_sudoer(self, monkeypatch):
        """Two modules read this setting: one to check the password, the other
        to recognise the account behind a token it never stored."""
        from app import dependencies
        from app.models import admin as admin_model

        for module in (dependencies, admin_model):
            monkeypatch.setattr(module, "SUDOERS", {"owner": "sekret-pärool"})

    def test_the_configured_password_is_accepted(self, client, env_sudoer):
        response = login(client, "owner", "sekret-pärool")

        assert response.status_code == 200

    def test_a_wrong_password_is_not(self, client, env_sudoer):
        assert login(client, "owner", "sekret-parool").status_code == 401

    def test_the_account_is_a_sudoer(self, client, env_sudoer):
        token = login(client, "owner", "sekret-pärool").json()["access_token"]

        me = client.get("/api/admin", headers={"Authorization": f"Bearer {token}"})

        assert me.json() == {
            "username": "owner",
            "is_sudo": True,
            "telegram_id": None,
            "discord_webhook": None,
            "users_usage": None,
        }

    def test_another_username_still_reaches_the_database(self, client, env_sudoer, sudo_admin):
        assert login(client, "root", "rootpw").status_code == 200


class TestLogout:
    def test_logging_out_clears_the_cookie(self, client, sudo_admin):
        login(client, "root", "rootpw")

        client.post("/api/admin/logout")

        assert not client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)

    def test_logging_out_without_a_session_is_still_fine(self, client):
        assert client.post("/api/admin/logout").status_code == 200


class TestCurrentAdmin:
    def test_the_caller_is_described(self, client, plain_admin):
        body = client.get("/api/admin", headers=auth(plain_admin)).json()

        assert body == {
            "username": "reseller",
            "is_sudo": False,
            "telegram_id": None,
            "discord_webhook": None,
            "users_usage": 0,
        }

    def test_no_credentials_is_a_401(self, client):
        assert client.get("/api/admin").status_code == 401


class TestManageAdmins:
    BODY = {"username": "newbie", "password": "s3cret", "is_sudo": False}

    def test_a_sudo_admin_can_create_one(self, client, db, sudo_admin):
        response = client.post("/api/admin", json=self.BODY, headers=auth(sudo_admin))

        assert response.status_code == 200
        assert crud.get_admin(db, "newbie") is not None

    def test_the_password_is_stored_hashed(self, client, db, sudo_admin):
        client.post("/api/admin", json=self.BODY, headers=auth(sudo_admin))

        assert crud.get_admin(db, "newbie").hashed_password != "s3cret"

    def test_the_new_admin_can_log_in(self, client, sudo_admin):
        client.post("/api/admin", json=self.BODY, headers=auth(sudo_admin))

        assert login(client, "newbie", "s3cret").status_code == 200

    def test_a_reseller_cannot_create_one(self, client, plain_admin):
        assert client.post("/api/admin", json=self.BODY, headers=auth(plain_admin)).status_code == 403

    def test_a_duplicate_username_is_a_conflict(self, client, sudo_admin):
        client.post("/api/admin", json=self.BODY, headers=auth(sudo_admin))

        assert client.post("/api/admin", json=self.BODY, headers=auth(sudo_admin)).status_code == 409

    def test_a_discord_webhook_from_another_host_is_refused(self, client, sudo_admin):
        body = {**self.BODY, "discord_webhook": "https://evil.example.com/hook"}

        assert client.post("/api/admin", json=body, headers=auth(sudo_admin)).status_code == 422

    def test_admins_are_listed_for_sudo_only(self, client, sudo_admin, plain_admin):
        allowed = client.get("/api/admins", headers=auth(sudo_admin))

        assert {admin["username"] for admin in allowed.json()} == {"root", "reseller"}
        assert client.get("/api/admins", headers=auth(plain_admin)).status_code == 403

    def test_a_reseller_can_be_edited(self, client, sudo_admin, plain_admin):
        response = client.put(
            "/api/admin/reseller", json={"is_sudo": True}, headers=auth(sudo_admin)
        )

        assert response.status_code == 200
        assert response.json()["is_sudo"] is True

    def test_the_contact_fields_can_be_set_and_cleared(self, client, db, sudo_admin, plain_admin):
        client.put(
            "/api/admin/reseller",
            json={
                "is_sudo": False,
                "telegram_id": 4242,
                "discord_webhook": "https://discord.com/api/webhooks/1/x",
            },
            headers=auth(sudo_admin),
        )
        db.refresh(plain_admin)
        assert plain_admin.telegram_id == 4242

        response = client.put(
            "/api/admin/reseller", json={"is_sudo": False}, headers=auth(sudo_admin)
        )

        assert response.status_code == 200
        db.refresh(plain_admin)
        assert plain_admin.telegram_id is None
        assert plain_admin.discord_webhook is None

    def test_a_sudo_admin_cannot_demote_itself(self, client, db, sudo_admin):
        response = client.put(
            "/api/admin/root", json={"is_sudo": False}, headers=auth(sudo_admin)
        )

        assert response.status_code == 403
        db.refresh(sudo_admin)
        assert sudo_admin.is_sudo is True

    def test_another_sudo_account_cannot_be_edited(self, client, db, sudo_admin):
        crud.create_admin(db, AdminCreate(username="other", password="pw", is_sudo=True))

        response = client.put("/api/admin/other", json={"is_sudo": False}, headers=auth(sudo_admin))

        assert response.status_code == 403

    def test_changing_a_password_invalidates_the_old_session(self, client, db, sudo_admin, plain_admin):
        headers = auth(plain_admin)
        assert client.get("/api/admin", headers=headers).status_code == 200

        client.put(
            "/api/admin/reseller",
            json={"is_sudo": False, "password": "brand-new"},
            headers=auth(sudo_admin),
        )

        assert client.get("/api/admin", headers=headers).status_code == 401

    def test_a_reseller_can_be_deleted(self, client, db, sudo_admin, plain_admin):
        assert client.delete("/api/admin/reseller", headers=auth(sudo_admin)).status_code == 200
        assert crud.get_admin(db, "reseller") is None

    def test_a_sudo_account_cannot_be_deleted_through_the_api(self, client, sudo_admin):
        assert client.delete("/api/admin/root", headers=auth(sudo_admin)).status_code == 403

    def test_deleting_an_unknown_admin_is_a_404(self, client, sudo_admin):
        assert client.delete("/api/admin/nobody", headers=auth(sudo_admin)).status_code == 404


class TestBulkUserOperations:
    @pytest.fixture
    def users(self, db, plain_admin):
        return [crud.create_user(db, new_user(name), admin=plain_admin) for name in ("alice", "bob")]

    def test_all_of_an_admins_users_can_be_disabled(self, client, db, users, sudo_admin):
        response = client.post("/api/admin/reseller/users/disable", headers=auth(sudo_admin))

        assert response.status_code == 200
        assert {user.status.value for user in users} == {"disabled"}

    def test_and_activated_again(self, client, db, users, sudo_admin):
        client.post("/api/admin/reseller/users/disable", headers=auth(sudo_admin))

        client.post("/api/admin/reseller/users/activate", headers=auth(sudo_admin))

        assert {user.status.value for user in users} == {"active"}

    def test_a_reseller_cannot_do_it(self, client, users, plain_admin):
        response = client.post("/api/admin/reseller/users/disable", headers=auth(plain_admin))

        assert response.status_code == 403

    def test_the_change_is_pushed_to_the_core(self, client, users, sudo_admin, no_xray_calls):
        client.post("/api/admin/reseller/users/disable", headers=auth(sudo_admin))

        assert ("restart_core", None) in no_xray_calls


class TestAdminUsage:
    def test_usage_is_readable_and_resettable(self, client, db, sudo_admin, plain_admin):
        plain_admin.users_usage = 5000
        db.commit()

        assert client.get("/api/admin/usage/reseller", headers=auth(sudo_admin)).json() == 5000

        client.post("/api/admin/usage/reset/reseller", headers=auth(sudo_admin))

        assert client.get("/api/admin/usage/reseller", headers=auth(sudo_admin)).json() == 0

    def test_a_reseller_cannot_read_it(self, client, plain_admin):
        assert client.get("/api/admin/usage/reseller", headers=auth(plain_admin)).status_code == 403
