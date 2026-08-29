"""The /api/user endpoints, end to end through the real router.

Covers what the dashboard and the CLI actually call: authentication, the
ownership rules that keep one reseller out of another's users, and the
request validation that turns a bad payload into a 4xx instead of a 500.
"""

from datetime import datetime, timedelta

import pytest

from app.db import crud
from app.routers.user import USERS_DEFAULT_LIMIT

from conftest import auth, new_user

GIGABYTE = 1024 ** 3


def payload(username="alice", **overrides):
    body = {"username": username, "proxies": {"vmess": {}}, "inbounds": {}}
    body.update(overrides)
    return body


@pytest.fixture
def owned_user(db, plain_admin):
    return crud.create_user(db, new_user("bob"), admin=plain_admin)


class TestAuthentication:
    ENDPOINTS = [
        ("get", "/api/users"),
        ("post", "/api/user"),
        ("get", "/api/user/alice"),
        ("put", "/api/user/alice"),
        ("delete", "/api/user/alice"),
    ]

    @pytest.mark.parametrize("method, path", ENDPOINTS)
    def test_no_credentials_is_rejected(self, client, method, path):
        assert getattr(client, method)(path).status_code == 401

    @pytest.mark.parametrize("method, path", ENDPOINTS)
    def test_a_forged_token_is_rejected(self, client, method, path):
        headers = {"Authorization": "Bearer not-a-token"}

        assert getattr(client, method)(path, headers=headers).status_code == 401

    def test_a_token_for_a_deleted_admin_is_rejected(self, client, db, sudo_admin):
        headers = auth(sudo_admin)
        crud.remove_admin(db, sudo_admin)

        assert client.get("/api/users", headers=headers).status_code == 401

    def test_the_session_cookie_authenticates_too(self, client, sudo_admin):
        from app.utils.auth_cookie import ACCESS_TOKEN_COOKIE_NAME

        token = auth(sudo_admin)["Authorization"].removeprefix("Bearer ")
        client.cookies.set(ACCESS_TOKEN_COOKIE_NAME, token)

        assert client.get("/api/users").status_code == 200


class TestAddUser:
    def test_a_user_is_created_and_returned(self, client, db, sudo_admin):
        response = client.post("/api/user", json=payload(), headers=auth(sudo_admin))

        assert response.status_code == 200
        assert response.json()["username"] == "alice"
        assert crud.get_user(db, "alice") is not None

    def test_the_response_carries_links_and_a_subscription_url(self, client, sudo_admin):
        body = client.post("/api/user", json=payload(), headers=auth(sudo_admin)).json()

        assert body["links"]
        assert body["subscription_url"].startswith("/sub/")

    def test_the_new_user_is_pushed_to_xray(self, client, sudo_admin, no_xray_calls):
        client.post("/api/user", json=payload(), headers=auth(sudo_admin))

        assert ("add_user", "alice") in no_xray_calls

    def test_the_caller_becomes_the_owner(self, client, sudo_admin, plain_admin):
        client.post("/api/user", json=payload(), headers=auth(plain_admin))

        body = client.get("/api/user/alice", headers=auth(sudo_admin)).json()
        assert body["admin"]["username"] == "reseller"

    def test_a_duplicate_username_is_a_conflict(self, client, sudo_admin):
        client.post("/api/user", json=payload(), headers=auth(sudo_admin))
        again = client.post("/api/user", json=payload(), headers=auth(sudo_admin))

        assert again.status_code == 409

    def test_a_protocol_the_server_does_not_run_is_refused(self, client, sudo_admin, xray_config):
        xray_config.inbounds_by_protocol.pop("vmess")

        response = client.post("/api/user", json=payload(), headers=auth(sudo_admin))

        assert response.status_code == 400
        assert response.json()["detail"] == "Protocol vmess is disabled on your server"

    @pytest.mark.parametrize("username", ["ab", "with space", "bad!"])
    def test_an_invalid_username_is_a_validation_error(self, client, sudo_admin, username):
        response = client.post("/api/user", json=payload(username), headers=auth(sudo_admin))

        assert response.status_code == 422

    def test_a_user_with_no_proxies_is_refused(self, client, sudo_admin):
        response = client.post("/api/user", json=payload(proxies={}), headers=auth(sudo_admin))

        assert response.status_code == 422

    def test_an_unknown_inbound_tag_is_refused(self, client, sudo_admin):
        body = payload(inbounds={"vmess": ["NO SUCH TAG"]})

        assert client.post("/api/user", json=body, headers=auth(sudo_admin)).status_code == 422


class TestOwnership:
    def test_a_reseller_cannot_read_another_admins_user(self, client, db, sudo_admin, plain_admin):
        crud.create_user(db, new_user("alice"), admin=sudo_admin)

        response = client.get("/api/user/alice", headers=auth(plain_admin))

        assert response.status_code == 403

    def test_a_reseller_cannot_delete_another_admins_user(self, client, db, sudo_admin, plain_admin):
        crud.create_user(db, new_user("alice"), admin=sudo_admin)

        assert client.delete("/api/user/alice", headers=auth(plain_admin)).status_code == 403

    def test_a_sudo_admin_reads_anyones_user(self, client, owned_user, sudo_admin):
        assert client.get("/api/user/bob", headers=auth(sudo_admin)).status_code == 200

    def test_a_reseller_only_lists_its_own_users(self, client, db, sudo_admin, plain_admin):
        crud.create_user(db, new_user("alice"), admin=sudo_admin)
        crud.create_user(db, new_user("bob"), admin=plain_admin)

        body = client.get("/api/users", headers=auth(plain_admin)).json()

        assert [user["username"] for user in body["users"]] == ["bob"]
        assert body["total"] == 1

    def test_a_sudo_admin_lists_everyone(self, client, db, sudo_admin, plain_admin):
        crud.create_user(db, new_user("alice"), admin=sudo_admin)
        crud.create_user(db, new_user("bob"), admin=plain_admin)

        body = client.get("/api/users", headers=auth(sudo_admin)).json()

        assert body["total"] == 2

    def test_only_a_sudo_admin_can_reassign_an_owner(self, client, owned_user, sudo_admin, plain_admin):
        forbidden = client.put(
            "/api/user/bob/set-owner", params={"admin_username": "root"}, headers=auth(plain_admin)
        )
        allowed = client.put(
            "/api/user/bob/set-owner", params={"admin_username": "root"}, headers=auth(sudo_admin)
        )

        assert forbidden.status_code == 403
        assert allowed.status_code == 200
        assert allowed.json()["admin"]["username"] == "root"


class TestReadUsers:
    @pytest.fixture
    def population(self, db, sudo_admin):
        crud.create_user(db, new_user("alice", note="vip"), admin=sudo_admin)
        crud.create_user(db, new_user("bob"), admin=sudo_admin)
        disabled = crud.create_user(db, new_user("carol"), admin=sudo_admin)
        disabled.status = "disabled"
        db.commit()

    def test_a_missing_user_is_a_404(self, client, sudo_admin):
        assert client.get("/api/user/nobody", headers=auth(sudo_admin)).status_code == 404

    def test_search_narrows_the_list(self, client, population, sudo_admin):
        body = client.get("/api/users", params={"search": "vip"}, headers=auth(sudo_admin)).json()

        assert [user["username"] for user in body["users"]] == ["alice"]

    def test_status_narrows_the_list(self, client, population, sudo_admin):
        body = client.get("/api/users", params={"status": "disabled"}, headers=auth(sudo_admin)).json()

        assert [user["username"] for user in body["users"]] == ["carol"]

    def test_the_total_ignores_the_page_size(self, client, population, sudo_admin):
        body = client.get("/api/users", params={"limit": 1}, headers=auth(sudo_admin)).json()

        assert len(body["users"]) == 1
        assert body["total"] == 3

    def test_the_page_size_is_capped(self, client, population, sudo_admin):
        assert client.get(
            "/api/users", params={"limit": 5000}, headers=auth(sudo_admin)
        ).status_code == 422

    def test_a_nonsense_page_is_refused(self, client, population, sudo_admin):
        for params in ({"limit": 0}, {"limit": -1}, {"offset": -1}):
            assert client.get(
                "/api/users", params=params, headers=auth(sudo_admin)
            ).status_code == 422

    def test_a_client_that_asks_for_no_page_gets_the_default_one(self, client, db, sudo_admin):
        """Without a limit the endpoint used to return every user there is."""
        extra = USERS_DEFAULT_LIMIT + 1
        for index in range(extra):
            crud.create_user(db, new_user(f"bulk_{index:04}"), admin=sudo_admin)

        body = client.get("/api/users", headers=auth(sudo_admin)).json()

        assert len(body["users"]) == USERS_DEFAULT_LIMIT
        assert body["total"] == extra

    def test_sorting_is_applied(self, client, population, sudo_admin):
        body = client.get("/api/users", params={"sort": "-username"}, headers=auth(sudo_admin)).json()

        assert [user["username"] for user in body["users"]] == ["carol", "bob", "alice"]

    def test_an_unknown_sort_key_is_a_400(self, client, population, sudo_admin):
        response = client.get("/api/users", params={"sort": "nonsense"}, headers=auth(sudo_admin))

        assert response.status_code == 400


class TestModifyUser:
    def test_a_field_is_updated(self, client, owned_user, plain_admin):
        response = client.put(
            "/api/user/bob", json={"note": "changed"}, headers=auth(plain_admin)
        )

        assert response.status_code == 200
        assert response.json()["note"] == "changed"

    def test_a_past_expiry_expires_the_user(self, client, owned_user, plain_admin):
        past = int((datetime.utcnow() - timedelta(days=1)).timestamp())

        body = client.put("/api/user/bob", json={"expire": past}, headers=auth(plain_admin)).json()

        assert body["status"] == "expired"

    def test_an_expired_user_is_pulled_out_of_xray(self, client, owned_user, plain_admin, no_xray_calls):
        past = int((datetime.utcnow() - timedelta(days=1)).timestamp())

        client.put("/api/user/bob", json={"expire": past}, headers=auth(plain_admin))

        assert ("remove_user", "bob") in no_xray_calls

    def test_an_active_user_is_pushed_to_xray(self, client, owned_user, plain_admin, no_xray_calls):
        client.put("/api/user/bob", json={"note": "still active"}, headers=auth(plain_admin))

        assert ("update_user", "bob") in no_xray_calls

    def test_a_protocol_the_server_does_not_run_is_refused(self, client, owned_user, plain_admin, xray_config):
        xray_config.inbounds_by_protocol.pop("vmess")

        response = client.put(
            "/api/user/bob", json={"proxies": {"vmess": {}}}, headers=auth(plain_admin)
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "Protocol vmess is disabled on your server"

    def test_a_missing_user_is_a_404(self, client, sudo_admin):
        assert client.put("/api/user/nobody", json={}, headers=auth(sudo_admin)).status_code == 404


class TestResetAndRevoke:
    def test_reset_zeroes_the_traffic(self, client, db, owned_user, plain_admin):
        owned_user.used_traffic = 5 * GIGABYTE
        db.commit()

        body = client.post("/api/user/bob/reset", headers=auth(plain_admin)).json()

        assert body["used_traffic"] == 0
        assert body["lifetime_used_traffic"] == 5 * GIGABYTE

    def test_revoking_stamps_the_revocation_time(self, client, db, owned_user, plain_admin):
        assert owned_user.sub_revoked_at is None

        client.post("/api/user/bob/revoke_sub", headers=auth(plain_admin))

        db.refresh(owned_user)
        assert owned_user.sub_revoked_at is not None

    def test_revoking_changes_the_proxy_credentials(self, client, owned_user, plain_admin):
        before = client.get("/api/user/bob", headers=auth(plain_admin)).json()["proxies"]

        after = client.post("/api/user/bob/revoke_sub", headers=auth(plain_admin)).json()["proxies"]

        assert after["vmess"]["id"] != before["vmess"]["id"]

    def test_resetting_everyones_traffic_needs_sudo(self, client, owned_user, plain_admin, sudo_admin):
        assert client.post("/api/users/reset", headers=auth(plain_admin)).status_code == 403
        assert client.post("/api/users/reset", headers=auth(sudo_admin)).status_code == 200


class TestRemoveUser:
    def test_a_user_is_deleted(self, client, db, owned_user, plain_admin):
        assert client.delete("/api/user/bob", headers=auth(plain_admin)).status_code == 200
        assert crud.get_user(db, "bob") is None

    def test_the_user_is_pulled_out_of_xray(self, client, owned_user, plain_admin, no_xray_calls):
        client.delete("/api/user/bob", headers=auth(plain_admin))

        assert ("remove_user", "bob") in no_xray_calls

    def test_a_missing_user_is_a_404(self, client, sudo_admin):
        assert client.delete("/api/user/nobody", headers=auth(sudo_admin)).status_code == 404


class TestExpiredUsers:
    @pytest.fixture
    def expired(self, db, sudo_admin):
        user = crud.create_user(db, new_user("alice"), admin=sudo_admin)
        user.status = "expired"
        user.expire = int((datetime.utcnow() - timedelta(days=2)).timestamp())
        db.commit()
        return user

    def test_expired_users_are_listed(self, client, expired, sudo_admin):
        response = client.get("/api/users/expired", headers=auth(sudo_admin))

        assert response.json() == ["alice"]

    def test_active_users_are_not_listed(self, client, db, sudo_admin):
        crud.create_user(db, new_user("bob"), admin=sudo_admin)

        assert client.get("/api/users/expired", headers=auth(sudo_admin)).json() == []

    def test_expired_users_can_be_deleted_in_bulk(self, client, db, expired, sudo_admin):
        response = client.delete("/api/users/expired", headers=auth(sudo_admin))

        assert response.json() == ["alice"]
        assert crud.get_user(db, "alice") is None
