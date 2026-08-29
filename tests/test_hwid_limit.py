"""The per-user device limit, end to end.

A subscription is gated on the hardware id the client reports: known devices
are served, new ones are served while there is room, and everything else is
refused. The limit is off until somebody sets one, which is what keeps the
feature from cutting off every existing user the day it ships.

What it deliberately does not do is cut off a device that already holds a
configuration — Xray knows nothing about a hwid. Removing a device frees its
slot; revoking the subscription is what actually stops it.
"""

from datetime import datetime, timedelta

import pytest

from app.db import crud
from app.utils import hwid
from app.utils.jwt import create_subscription_token

from conftest import auth, new_user


@pytest.fixture(autouse=True)
def no_global_default(monkeypatch):
    """Off unless a test says otherwise, the way a fresh panel is."""
    monkeypatch.setattr(hwid, "USERS_DEFAULT_HWID_DEVICE_LIMIT", 0)


@pytest.fixture
def user(db, sudo_admin):
    return crud.create_user(db, new_user("alice"), admin=sudo_admin)


@pytest.fixture
def token(user):
    return create_subscription_token(user.username)


@pytest.fixture
def limited(db, user):
    """A user allowed two devices."""
    user.hwid_device_limit = 2
    db.commit()
    return user


def fetch(client, token, hwid_value=None, path="", **details):
    headers = {"user-agent": "Happ/1.12.0"}
    if hwid_value:
        headers["x-hwid"] = hwid_value
    headers.update({key.replace("_", "-"): value for key, value in details.items()})
    return client.get(f"/sub/{token}{path}", headers=headers)


class TestWithoutALimit:
    """Nothing changes for a user nobody has limited."""

    def test_a_client_that_does_not_identify_itself_is_served(self, client, token):
        assert fetch(client, token).status_code == 200

    def test_nothing_is_recorded(self, client, db, user, token):
        fetch(client, token, "device-one")

        assert crud.count_user_devices(db, user) == 0

    def test_a_user_exempted_from_the_panel_default_is_served(self, client, db, user, token, monkeypatch):
        monkeypatch.setattr(hwid, "USERS_DEFAULT_HWID_DEVICE_LIMIT", 1)
        user.hwid_device_limit = 0
        db.commit()

        assert fetch(client, token).status_code == 200


class TestRegistration:
    def test_the_first_device_is_registered_and_served(self, client, db, limited, token):
        assert fetch(client, token, "device-one").status_code == 200
        assert crud.count_user_devices(db, limited) == 1

    def test_what_the_client_said_about_itself_is_kept(self, client, db, limited, token):
        fetch(
            client, token, "device-one",
            x_device_os="iOS", x_ver_os="18.2", x_device_model="iPhone15,2",
        )
        device = crud.get_user_devices(db, limited)[0]

        assert (device.os, device.os_version, device.model) == ("iOS", "18.2", "iPhone15,2")
        assert device.user_agent == "Happ/1.12.0"

    def test_the_same_device_is_not_counted_twice(self, client, db, limited, token):
        for _ in range(5):
            assert fetch(client, token, "device-one").status_code == 200

        assert crud.count_user_devices(db, limited) == 1

    def test_a_second_device_fits_under_the_limit(self, client, db, limited, token):
        fetch(client, token, "device-one")

        assert fetch(client, token, "device-two").status_code == 200
        assert crud.count_user_devices(db, limited) == 2

    def test_a_returning_device_updates_what_it_reports(self, client, db, limited, token):
        fetch(client, token, "device-one", x_ver_os="18.1")
        fetch(client, token, "device-one", x_ver_os="18.2")

        assert crud.get_user_devices(db, limited)[0].os_version == "18.2"

    def test_devices_are_counted_per_user(self, client, db, sudo_admin, limited, token):
        """One person's phone must not fill somebody else's allowance."""
        other = crud.create_user(db, new_user("bob"), admin=sudo_admin)
        other.hwid_device_limit = 1
        db.commit()

        fetch(client, token, "shared-hwid")
        fetch(client, token, "second-hwid")

        assert fetch(client, create_subscription_token("bob"), "shared-hwid").status_code == 200


class TestRefusal:
    def test_a_client_that_does_not_identify_itself_is_refused(self, client, limited, token):
        response = fetch(client, token)

        assert response.status_code == 403
        assert "did not identify" in response.json()["detail"]

    def test_a_device_past_the_limit_is_refused(self, client, limited, token):
        fetch(client, token, "device-one")
        fetch(client, token, "device-two")

        response = fetch(client, token, "device-three")

        assert response.status_code == 403
        assert "device limit" in response.json()["detail"]

    def test_a_refused_device_is_not_recorded(self, client, db, limited, token):
        fetch(client, token, "device-one")
        fetch(client, token, "device-two")
        fetch(client, token, "device-three")

        assert crud.count_user_devices(db, limited) == 2

    def test_a_known_device_is_still_served_after_the_limit_is_lowered(self, client, db, limited, token):
        """Taking a device away is an admin's decision, not a side effect of
        editing a number."""
        fetch(client, token, "device-one")
        fetch(client, token, "device-two")

        limited.hwid_device_limit = 1
        db.commit()

        assert fetch(client, token, "device-two").status_code == 200

    def test_an_unknown_token_looks_the_same_either_way(self, client, limited):
        """The limit must not be a way of telling real tokens from made-up ones."""
        assert fetch(client, "not-a-real-token-at-all", "device-one").status_code == 404

    def test_a_revoked_subscription_is_still_a_404(self, client, db, limited, token):
        """Revocation is settled before the device is looked at, so a device
        that was within its limit does not turn a 404 into a 403 — or worse,
        into a config. The timestamp is set explicitly because tokens carry a
        whole-second issue time, which a revocation in the same second loses to."""
        limited.sub_revoked_at = datetime.utcnow() + timedelta(minutes=1)
        db.commit()

        assert fetch(client, token, "device-one").status_code == 404

    def test_a_revoked_subscription_records_nothing(self, client, db, limited, token):
        limited.sub_revoked_at = datetime.utcnow() + timedelta(minutes=1)
        db.commit()

        fetch(client, token, "device-one")

        assert crud.count_user_devices(db, limited) == 0


class TestEverySubscriptionRoute:
    """A configuration must not leak out of a route that skipped the check."""

    @pytest.mark.parametrize("path", ["", "/", "/info", "/usage", "/clash-meta", "/v2ray"])
    def test_the_route_is_gated(self, client, limited, token, path):
        assert fetch(client, token, path=path).status_code == 403

    @pytest.mark.parametrize("path", ["", "/", "/info", "/usage", "/clash-meta", "/v2ray"])
    def test_the_route_serves_a_known_device(self, client, limited, token, path):
        assert fetch(client, token, "device-one", path=path).status_code == 200

    def test_the_html_page_is_gated_too(self, client, limited, token):
        """It renders the configuration links, so it hands out configs."""
        response = client.get(f"/sub/{token}", headers={"Accept": "text/html"})

        assert response.status_code == 403


class TestGlobalDefault:
    def test_it_applies_to_a_user_who_has_no_limit_of_their_own(self, client, token, monkeypatch):
        monkeypatch.setattr(hwid, "USERS_DEFAULT_HWID_DEVICE_LIMIT", 1)

        assert fetch(client, token, "device-one").status_code == 200
        assert fetch(client, token, "device-two").status_code == 403

    def test_a_users_own_limit_wins(self, client, db, user, token, monkeypatch):
        monkeypatch.setattr(hwid, "USERS_DEFAULT_HWID_DEVICE_LIMIT", 1)
        user.hwid_device_limit = 2
        db.commit()

        fetch(client, token, "device-one")

        assert fetch(client, token, "device-two").status_code == 200


class TestDevicesApi:
    def test_the_devices_are_listed_with_the_limit(self, client, db, sudo_admin, limited, token):
        fetch(client, token, "device-one")

        body = client.get("/api/user/alice/devices", headers=auth(sudo_admin)).json()

        assert body["total"] == 1
        assert body["limit"] == 2
        assert body["enforced"] is True
        assert body["devices"][0]["hwid"] == "device-one"

    def test_a_user_with_no_limit_says_so(self, client, sudo_admin, user):
        body = client.get("/api/user/alice/devices", headers=auth(sudo_admin)).json()

        assert body["enforced"] is False
        assert body["limit"] == 0

    def test_removing_a_device_frees_its_slot(self, client, db, sudo_admin, limited, token):
        fetch(client, token, "device-one")
        fetch(client, token, "device-two")
        assert fetch(client, token, "device-three").status_code == 403

        device_id = client.get("/api/user/alice/devices", headers=auth(sudo_admin)).json()["devices"][0]["id"]
        client.delete(f"/api/user/alice/devices/{device_id}", headers=auth(sudo_admin))

        assert fetch(client, token, "device-three").status_code == 200

    def test_removing_a_device_returns_what_is_left(self, client, db, sudo_admin, limited, token):
        fetch(client, token, "device-one")
        device_id = client.get("/api/user/alice/devices", headers=auth(sudo_admin)).json()["devices"][0]["id"]

        body = client.delete(f"/api/user/alice/devices/{device_id}", headers=auth(sudo_admin)).json()

        assert body["total"] == 0

    def test_resetting_forgets_them_all(self, client, db, sudo_admin, limited, token):
        fetch(client, token, "device-one")
        fetch(client, token, "device-two")

        body = client.delete("/api/user/alice/devices", headers=auth(sudo_admin)).json()

        assert body["total"] == 0
        assert crud.count_user_devices(db, limited) == 0

    def test_a_device_of_another_user_is_not_reachable_by_id(self, client, db, sudo_admin, limited, token):
        """Scoped to the user in the path, not looked up by id alone."""
        other = crud.create_user(db, new_user("bob"), admin=sudo_admin)
        other.hwid_device_limit = 1
        db.commit()
        fetch(client, create_subscription_token("bob"), "bobs-device")
        device_id = client.get("/api/user/bob/devices", headers=auth(sudo_admin)).json()["devices"][0]["id"]

        response = client.delete(f"/api/user/alice/devices/{device_id}", headers=auth(sudo_admin))

        assert response.status_code == 404
        assert crud.count_user_devices(db, other) == 1

    def test_an_unknown_device_is_a_404(self, client, sudo_admin, limited):
        assert client.delete("/api/user/alice/devices/999", headers=auth(sudo_admin)).status_code == 404

    def test_a_reseller_cannot_see_another_admins_user(self, client, plain_admin, limited):
        assert client.get("/api/user/alice/devices", headers=auth(plain_admin)).status_code == 403

    def test_a_reseller_cannot_reset_another_admins_user(self, client, plain_admin, limited):
        assert client.delete("/api/user/alice/devices", headers=auth(plain_admin)).status_code == 403

    def test_authentication_is_required(self, client, limited):
        assert client.get("/api/user/alice/devices").status_code == 401


class TestLimitThroughTheUserApi:
    def test_a_limit_can_be_set_when_creating_a_user(self, client, sudo_admin):
        payload = {
            "username": "carol",
            "proxies": {"vmess": {}},
            "inbounds": {},
            "hwid_device_limit": 3,
        }

        body = client.post("/api/user", json=payload, headers=auth(sudo_admin)).json()

        assert body["hwid_device_limit"] == 3

    def test_a_limit_can_be_changed(self, client, sudo_admin, user):
        body = client.put(
            "/api/user/alice", json={"hwid_device_limit": 4}, headers=auth(sudo_admin)
        ).json()

        assert body["hwid_device_limit"] == 4

    def test_zero_is_kept_rather_than_treated_as_absent(self, client, db, sudo_admin, limited):
        """Zero exempts a user from the panel default, so it has to survive
        the round trip that a falsy value usually does not."""
        body = client.put(
            "/api/user/alice", json={"hwid_device_limit": 0}, headers=auth(sudo_admin)
        ).json()

        assert body["hwid_device_limit"] == 0
        db.refresh(limited)
        assert hwid.is_enforced(limited) is False

    def test_omitting_it_leaves_the_limit_alone(self, client, db, sudo_admin, limited):
        client.put("/api/user/alice", json={"note": "unrelated edit"}, headers=auth(sudo_admin))

        db.refresh(limited)
        assert limited.hwid_device_limit == 2

    def test_it_is_not_shown_to_the_subscriber(self, client, limited, token):
        """Admin-side policy has no business in the subscription payload."""
        body = fetch(client, token, "device-one", path="/info").json()

        assert "hwid_device_limit" not in body


class TestDeletingAUser:
    def test_the_devices_go_with_them(self, client, db, sudo_admin, limited, token):
        fetch(client, token, "device-one")

        client.delete("/api/user/alice", headers=auth(sudo_admin))

        assert crud.get_users(db) == []
