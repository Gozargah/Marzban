from datetime import datetime as dt
from fastapi import status

from tests.api import client

usernames = ["user1", "user2"]


def create_test_users(access_token):
    """Helper function to create users for testing."""
    for username in usernames:
        client.post(
            "/api/user",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"username": username},
        )
    response = client.get("/api/users", headers={"Authorization": f"Bearer {access_token}"})
    users = response.json()["users"]
    return [u["id"] for u in users if u["username"] in usernames]


def test_add_groups_to_users(access_token):
    """Test bulk adding groups to users."""

    create_test_users(access_token)
    response = client.get("/api/groups", headers={"Authorization": f"Bearer {access_token}"})
    group_ids = [g["id"] for g in response.json()["groups"]]

    response = client.post(
        "/api/groups/bulk/add",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"group_ids": group_ids},
    )

    assert response.status_code == status.HTTP_200_OK
    for username in usernames:
        response = client.get(f"/api/user/{username}", headers={"Authorization": f"Bearer {access_token}"})
        assert {id for id in response.json()["group_ids"]} == set(group_ids)


def test_remove_groups_from_users(access_token):
    """Test bulk removing groups from users."""
    response = client.get("/api/groups", headers={"Authorization": f"Bearer {access_token}"})
    group_ids = [g["id"] for g in response.json()["groups"]]

    response = client.post(
        "/api/groups/bulk/remove",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"group_ids": [group_ids[0]]},
    )

    assert response.status_code == status.HTTP_200_OK
    for username in usernames:
        response = client.get(f"/api/user/{username}", headers={"Authorization": f"Bearer {access_token}"})
        assert {id for id in response.json()["group_ids"]} == set(group_ids[1:])


def test_update_users_datalimit(access_token):
    """Test bulk updating user data limits."""
    client.post(
        "/api/user",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"username": "user7", "data_limit": 100},
    )
    client.post(
        "/api/user",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"username": "user8", "data_limit": 200},
    )
    response = client.get("/api/users", headers={"Authorization": f"Bearer {access_token}"})
    users = response.json()["users"]
    user_ids = [u["id"] for u in users if u["username"] in ["user7", "user8"]]

    response = client.post(
        "/api/users/bulk/data_limit",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "amount": 50,
            "users": user_ids,
        },
    )

    assert response.status_code == status.HTTP_200_OK
    response = client.get("/api/users", headers={"Authorization": f"Bearer {access_token}"})
    users = response.json()["users"]
    user7 = next(u for u in users if u["username"] == "user7")
    user8 = next(u for u in users if u["username"] == "user8")
    assert user7["data_limit"] == 150
    assert user8["data_limit"] == 250


def test_update_users_expire(access_token):
    """Test bulk updating user expiration dates."""
    client.put(
        f"/api/user/{usernames[0]}",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"expire": "2025-01-01T00:00:00+00:00"},
    )
    client.put(
        f"/api/user/{usernames[1]}",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"expire": "2026-01-01T00:00:00+00:00"},
    )

    response = client.post(
        "/api/users/bulk/expire",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"amount": 3600},
    )

    assert response.status_code == status.HTTP_200_OK
    response = client.get("/api/users", headers={"Authorization": f"Bearer {access_token}"})
    users = response.json()["users"]
    user1 = next(u for u in users if u["username"] == usernames[0])
    user2 = next(u for u in users if u["username"] == usernames[1])
    assert dt.fromisoformat(user1["expire"]).replace(tzinfo=None).strftime("%Y-%m-%dT%H:%M:%S") == "2025-01-01T01:00:00"
    assert dt.fromisoformat(user2["expire"]).replace(tzinfo=None).strftime("%Y-%m-%dT%H:%M:%S") == "2026-01-01T01:00:00"


def test_update_users_proxy_settings(access_token):
    """Test bulk updating user proxy settings."""
    response = client.post(
        "/api/users/bulk/proxy_settings",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"flow": "xtls-rprx-vision"},
    )

    assert response.status_code == status.HTTP_200_OK
    response = client.get("/api/users", headers={"Authorization": f"Bearer {access_token}"})
    users = response.json()["users"]
    user1 = next(u for u in users if u["username"] == usernames[0])
    user2 = next(u for u in users if u["username"] == usernames[1])
    assert user1["proxy_settings"]["vless"]["flow"] == "xtls-rprx-vision"
    assert user2["proxy_settings"]["vless"]["flow"] == "xtls-rprx-vision"
