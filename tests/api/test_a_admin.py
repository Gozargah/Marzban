from fastapi import status

from tests.api import client


def test_admin_login():
    """Test that the admin login route is accessible."""

    response = client.post(
        url="/api/admin/token",
        data={"username": "testadmin", "password": "testadmin", "grant_type": "password"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert "access_token" in response.json()
    return response.json()["access_token"]


def test_get_admin(access_token):
    """Test that the admin get route is accessible."""

    # mock_settings(monkeypatch)
    username = "testadmin"
    response = client.get(
        url="/api/admin",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["username"] == username


def test_admin_create(access_token):
    """Test that the admin create route is accessible."""

    username = "testadmincreate"
    password = "TestAdmincreate#11"
    response = client.post(
        url="/api/admin",
        json={"username": username, "password": password, "is_sudo": False},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["username"] == username


def test_admin_db_login():
    """Test that the admin db login route is accessible."""

    username = "testadmincreate"
    password = "TestAdmincreate#11"
    response = client.post(
        url="/api/admin/token",
        data={"username": username, "password": password, "grant_type": "password"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert "access_token" in response.json()


def test_update_admin(access_token):
    """Test that the admin update route is accessible."""

    username = "testadmincreate"
    password = "TestAdminupdate#11"
    response = client.put(
        url=f"/api/admin/{username}",
        json={
            "password": password,
            "is_sudo": True,
            "is_disabled": True,
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["username"] == username
    assert response.json()["is_sudo"] is True
    assert response.json()["is_disabled"] is True


def test_get_admins(access_token):
    """Test that the admins get route is accessible."""

    username = "testadmincreate"
    response = client.get(
        url="/api/admins",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert username in [admin["username"] for admin in response.json()]


def test_disable_admin():
    """Test that the admin disable route is accessible."""

    username = "testadmincreate"
    password = "TestAdminupdate#11"
    response = client.post(
        url="/api/admin/token",
        data={"username": username, "password": password, "grant_type": "password"},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == "your account has been disabled"


def test_admin_delete(access_token):
    """Test that the admin delete route is accessible."""

    username = "testadmincreate"
    response = client.delete(
        url=f"/api/admin/{username}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_204_NO_CONTENT
