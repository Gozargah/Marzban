"""The public /sub endpoint.

The only unauthenticated surface of the panel: it turns a token into a config
for whichever client asked. Two things matter here — that a token which should
no longer work is refused, and that each client gets the format it can read.
"""

import base64
import json
from datetime import datetime, timedelta

import pytest
import yaml

from app.db import crud
from app.utils.jwt import create_subscription_token

from conftest import new_user


@pytest.fixture
def user(db, sudo_admin):
    return crud.create_user(db, new_user("alice"), admin=sudo_admin)


@pytest.fixture
def token(user):
    return create_subscription_token(user.username)


def get(client, token, user_agent="", **kwargs):
    headers = {"user-agent": user_agent, **kwargs.pop("headers", {})}
    return client.get(f"/sub/{token}", headers=headers, **kwargs)


class TestAccess:
    def test_a_valid_token_is_served(self, client, token):
        assert get(client, token).status_code == 200

    def test_no_authentication_is_needed(self, client, token):
        assert "authorization" not in get(client, token).request.headers

    def test_the_trailing_slash_form_works_too(self, client, token):
        assert client.get(f"/sub/{token}/").status_code == 200

    def test_a_garbage_token_is_a_404(self, client):
        assert get(client, "not-a-real-token-at-all").status_code == 404

    def test_a_token_with_a_broken_signature_is_a_404(self, client, token):
        payload, _, signature = token.rpartition(".")
        forged = ("A" if signature[0] != "A" else "B") + signature[1:]

        assert get(client, f"{payload}.{forged}").status_code == 404

    def test_a_token_for_a_deleted_user_is_a_404(self, client, db, user, token):
        crud.remove_user(db, user)

        assert get(client, token).status_code == 404

    def test_a_token_older_than_the_account_is_a_404(self, client, db, user, token):
        # Reusing a name: the account behind the token is not this one.
        user.created_at = datetime.utcnow() + timedelta(days=1)
        db.commit()

        assert get(client, token).status_code == 404

    def test_a_revoked_token_is_a_404(self, client, db, user, token):
        user.sub_revoked_at = datetime.utcnow() + timedelta(minutes=1)
        db.commit()

        assert get(client, token).status_code == 404

    def test_a_token_issued_after_the_revocation_still_works(self, client, db, user):
        user.sub_revoked_at = datetime.utcnow() - timedelta(minutes=1)
        db.commit()

        assert get(client, create_subscription_token(user.username)).status_code == 200


class TestClientDetection:
    @pytest.mark.parametrize("user_agent", ["Clash/1.0", "Stash/2.1"])
    def test_clash_clients_get_yaml(self, client, token, user_agent):
        response = get(client, token, user_agent)

        assert response.headers["content-type"].startswith("text/yaml")
        assert yaml.safe_load(response.text)["proxies"]

    @pytest.mark.parametrize("user_agent", ["clash-meta/1.0", "mihomo/1.18", "Clash-verge/1.0"])
    def test_clash_meta_clients_get_yaml(self, client, token, user_agent):
        response = get(client, token, user_agent)

        assert response.headers["content-type"].startswith("text/yaml")
        assert yaml.safe_load(response.text)["proxies"]

    @pytest.mark.parametrize("user_agent", ["SFA/1.0", "SFI/1.0", "Karing/1.0", "singbox/1.9"])
    def test_sing_box_clients_get_json(self, client, token, user_agent):
        response = get(client, token, user_agent)

        assert response.headers["content-type"].startswith("application/json")
        assert json.loads(response.text)["outbounds"]

    @pytest.mark.xfail(
        strict=True,
        reason=(
            "The detection pattern is `.*sing[-b]?ox.*`, where [-b]? is one optional "
            "character, so it matches singbox and sing-ox but not the literal sing-box."
        ),
    )
    def test_a_client_calling_itself_sing_box_is_detected(self, client, token):
        response = get(client, token, "sing-box/1.9")

        assert response.headers["content-type"].startswith("application/json")

    def test_an_unknown_client_gets_base64_v2ray_links(self, client, token):
        response = get(client, token, "SomeBrandNewClient/1.0")

        assert response.headers["content-type"].startswith("text/plain")
        assert base64.b64decode(response.text).decode().startswith("vmess://")

    def test_a_browser_gets_the_subscription_page(self, client, token):
        response = get(client, token, headers={"Accept": "text/html"})

        assert response.headers["content-type"].startswith("text/html")

    @pytest.mark.parametrize(
        "client_type, media_type",
        [
            ("clash", "text/yaml"),
            ("clash-meta", "text/yaml"),
            ("sing-box", "application/json"),
            ("v2ray-json", "application/json"),
            ("v2ray", "text/plain"),
        ],
    )
    def test_the_format_can_be_asked_for_explicitly(self, client, token, client_type, media_type):
        response = client.get(f"/sub/{token}/{client_type}")

        assert response.status_code == 200
        assert response.headers["content-type"].startswith(media_type)

    def test_an_unknown_format_is_refused(self, client, token):
        assert client.get(f"/sub/{token}/nonsense").status_code == 422

    @pytest.mark.parametrize("client_type", ["xclash", "clashx", "xv2rayx"])
    def test_a_format_merely_containing_a_known_name_is_refused(self, client, token, client_type):
        """An unanchored pattern accepts these, and the lookup behind it then fails with a 500."""
        assert client.get(f"/sub/{token}/{client_type}").status_code == 422


class TestResponseHeaders:
    def test_the_client_is_told_how_often_to_refresh(self, client, token):
        assert get(client, token).headers["profile-update-interval"] == "12"

    def test_the_title_is_base64_tagged(self, client, token):
        title = get(client, token).headers["profile-title"]

        assert title.startswith("base64:")
        assert base64.b64decode(title.removeprefix("base64:"))

    def test_the_userinfo_header_carries_the_quota(self, client, db, user, token):
        user.used_traffic = 500
        user.data_limit = 1000
        db.commit()

        info = dict(part.strip().split("=") for part in get(client, token).headers["subscription-userinfo"].split(";"))

        assert info["download"] == "500"
        assert info["total"] == "1000"

    def test_an_unlimited_user_reports_zero_rather_than_null(self, client, token):
        info = dict(part.strip().split("=") for part in get(client, token).headers["subscription-userinfo"].split(";"))

        assert info["total"] == "0"
        assert info["expire"] == "0"

    def test_the_file_is_named_after_the_user(self, client, token):
        assert 'filename="alice"' in get(client, token).headers["content-disposition"]


class TestUsageIsRecorded:
    def test_fetching_stamps_the_update_time(self, client, db, user, token):
        assert user.sub_updated_at is None

        get(client, token, "Clash/1.0")

        db.refresh(user)
        assert user.sub_updated_at is not None

    def test_the_client_is_remembered(self, client, db, user, token):
        get(client, token, "Clash/1.0")

        db.refresh(user)
        assert user.sub_last_user_agent == "Clash/1.0"

    def test_the_html_page_does_not_count_as_a_fetch(self, client, db, user, token):
        get(client, token, headers={"Accept": "text/html"})

        db.refresh(user)
        assert user.sub_updated_at is None

    def test_asking_for_a_format_explicitly_counts_too(self, client, db, user, token):
        """It did not: the route that takes the format in the path skipped the
        bookkeeping entirely, so a client pinned to one showed as never having
        fetched its configuration."""
        client.get(f"/sub/{token}/clash-meta", headers={"user-agent": "Clash/1.0"})

        db.refresh(user)
        assert user.sub_updated_at is not None
        assert user.sub_last_user_agent == "Clash/1.0"

    @pytest.mark.parametrize("client_type", ["v2ray", "sing-box", "outline", "v2ray-json"])
    def test_every_format_records_the_fetch(self, client, db, user, token, client_type):
        client.get(f"/sub/{token}/{client_type}")

        db.refresh(user)
        assert user.sub_updated_at is not None

    def test_the_info_endpoint_is_not_a_fetch(self, client, db, user, token):
        """Reading the subscription's own status page is not a client pulling
        its config, and must not look like one."""
        client.get(f"/sub/{token}/info")

        db.refresh(user)
        assert user.sub_updated_at is None


class TestSubscriptionInfo:
    def test_info_returns_the_user(self, client, token):
        body = client.get(f"/sub/{token}/info").json()

        assert body["username"] == "alice"
        assert body["status"] == "active"

    def test_info_hides_the_owning_admin_and_the_note(self, client, token):
        body = client.get(f"/sub/{token}/info").json()

        assert "admin" not in body
        assert "note" not in body

    def test_info_refuses_a_bad_token(self, client):
        assert client.get("/sub/not-a-real-token-at-all/info").status_code == 404

    def test_usage_is_reported(self, client, token):
        response = client.get(f"/sub/{token}/usage")

        assert response.status_code == 200
        assert "usages" in response.json()
