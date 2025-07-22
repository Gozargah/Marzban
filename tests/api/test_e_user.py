from datetime import datetime, timedelta, timezone

from fastapi import status

from tests.api import client
from tests.api.test_f_user_template import test_user_template_create  # noqa


def test_user_create_active(access_token):
    """Test that the user create active route is accessible."""
    expire = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=30)
    response = client.post(
        "/api/user",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "username": "test_user_active",
            "proxy_settings": {},
            "group_ids": [2, 3],
            "expire": expire.isoformat(),
            "data_limit": (1024 * 1024 * 1024 * 10),
            "data_limit_reset_strategy": "no_reset",
            "status": "active",
        },
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["username"] == "test_user_active"
    assert response.json()["data_limit"] == (1024 * 1024 * 1024 * 10)
    assert response.json()["data_limit_reset_strategy"] == "no_reset"
    assert response.json()["status"] == "active"

    for group in response.json()["group_ids"]:
        assert group in [2, 3]

    # Parse the response date string back to datetime
    response_datetime = datetime.fromisoformat(response.json()["expire"])
    # Format both to the same format without microseconds
    expected_formatted = expire.replace(tzinfo=None).strftime("%Y-%m-%dT%H:%M:%S")
    response_formatted = response_datetime.strftime("%Y-%m-%dT%H:%M:%S")

    assert response_formatted == expected_formatted


def test_user_create_on_hold(access_token):
    """Test that the user create on hold route is accessible."""
    expire = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=30)
    response = client.post(
        "/api/user",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "username": "test_user_on_hold",
            "proxy_settings": {},
            "group_ids": [2, 3],
            "data_limit": (1024 * 1024 * 1024 * 10),
            "data_limit_reset_strategy": "no_reset",
            "status": "on_hold",
            "on_hold_timeout": expire.isoformat(),
            "on_hold_expire_duration": (86400 * 30),
        },
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["username"] == "test_user_on_hold"
    assert response.json()["data_limit"] == (1024 * 1024 * 1024 * 10)
    assert response.json()["data_limit_reset_strategy"] == "no_reset"
    assert response.json()["status"] == "on_hold"
    assert response.json()["on_hold_expire_duration"] == (86400 * 30)

    for group in response.json()["group_ids"]:
        assert group in [2, 3]

    # Parse the response date string back to datetime
    response_datetime = datetime.fromisoformat(response.json()["on_hold_timeout"])
    # Format both to the same format without microseconds
    expected_formatted = expire.replace(tzinfo=None).strftime("%Y-%m-%dT%H:%M:%S")
    response_formatted = response_datetime.strftime("%Y-%m-%dT%H:%M:%S")

    assert response_formatted == expected_formatted


def test_users_get(access_token):
    """Test that the users get route is accessible."""
    response = client.get(
        "/api/users?load_sub=true",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()["users"]) > 0
    return response.json()["users"]


def test_user_subscriptions(access_token):
    """Test that the user subscriptions route is accessible."""
    user_subscription_formats = [
        "",
        "info",
        "sing_box",
        "clash_meta",
        "clash",
        "outline",
        "links",
        "links_base64",
        "xray",
    ]

    users = test_users_get(access_token)

    for user in users:
        for usf in user_subscription_formats:
            url = f"{user['subscription_url']}/{usf}"
            response = client.get(url, headers={"Accept": "text/html"} if usf == "" else None)
            assert response.status_code == status.HTTP_200_OK


def test_user_sub_update_user_agent(access_token):
    """Test that the user sub_update user_agent is accessible."""
    users = test_users_get(access_token)
    user = users[0]
    url = f"{user['subscription_url']}"
    user_agent = "v2rayNG/1.9.46 This is Marzban Test"
    client.get(url, headers={"User-Agent": user_agent})
    response = client.get(
        f"/api/user/{user['username']}/sub_update",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["updates"][0]["user_agent"] == user_agent


def test_user_get(access_token):
    """Test that the user get by id route is accessible."""
    response = client.get(
        "/api/users?username=test_user_active",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()["users"]) == 1
    assert response.json()["users"][0]["username"] == "test_user_active"


def test_reset_user_usage(access_token):
    """Test that the user usage can be reset."""
    response = client.post(
        "/api/user/test_user_active/reset",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK


def test_user_update(access_token):
    """Test that the user update route is accessible."""
    response = client.put(
        "/api/user/test_user_active",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "group_ids": [3],
            "data_limit": (1024 * 1024 * 1024 * 10),
            "next_plan": {"data_limit": 10000, "expire": 10000, "add_remaining_traffic": False},
        },
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["username"] == "test_user_active"
    assert response.json()["group_ids"] == [3]
    assert response.json()["data_limit"] == (1024 * 1024 * 1024 * 10)
    assert response.json()["next_plan"]["data_limit"] == 10000
    assert response.json()["next_plan"]["expire"] == 10000
    assert response.json()["next_plan"]["add_remaining_traffic"] is False


def test_reset_by_next_user_usage(access_token):
    """Test that the user next plan is available."""
    response = client.post(
        "/api/user/test_user_active/active_next",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK


def test_revoke_user_subscription(access_token):
    """Test revoke user subscription info."""
    response = client.post(
        "/api/user/test_user_active/revoke_sub",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK


def test_user_delete(access_token):
    """Test that the user delete route is accessible."""
    response = client.delete(
        "/api/user/test_user_active",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_204_NO_CONTENT


def test_create_user_with_template(access_token):
    response = client.post(
        "/api/user/from_template",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"username": "test_user_template", "user_template_id": 1},
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["username"] == "test_user_template"
    assert response.json()["data_limit"] == (1024 * 1024 * 1024)
    assert response.json()["status"] == "active"


def test_modify_user_with_template(access_token):
    response = client.put(
        "/api/user/from_template/test_user_template",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"user_template_id": 1},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["data_limit"] == (1024 * 1024 * 1024)
    assert response.json()["status"] == "active"
