from fastapi import status

from tests.api import client

id = 1


def test_user_template_delete(access_token):
    """Test that the user template delete route is accessible."""
    response = client.delete(
        f"/api/user_template/{id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_204_NO_CONTENT


def test_user_template_create(access_token):
    """Test that the user template create route is accessible."""
    response = client.post(
        "/api/user_template",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "name": "test_user_template",
            "group_ids": [2],
            "data_limit": (1024 * 1024 * 1024),
            "expire_duration": 3600,
            "extra_settings": {"flow": "", "method": None},
            "status": "active",
            "reset_usages": True,
        },
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["name"] == "test_user_template"
    assert response.json()["group_ids"] == [2]
    assert response.json()["data_limit"] == (1024 * 1024 * 1024)
    assert response.json()["expire_duration"] == 3600
    assert response.json()["reset_usages"]
    assert response.json()["status"] == "active"
    assert response.json()["extra_settings"]["flow"] == ""
    assert response.json()["extra_settings"]["method"] is None

    global id
    id = response.json()["id"]


def test_user_templates_get(access_token):
    """Test that the user template get route is accessible."""
    response = client.get(
        "/api/user_templates",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) > 0


def test_user_template_update(access_token):
    """Test that the user template update route is accessible."""
    response = client.put(
        f"/api/user_template/{id}",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "name": "test_user_template_updated",
            "group_ids": [2, 3],
            "expire_duration": (86400 * 30),
            "extra_settings": {"flow": "xtls-rprx-vision", "method": "xchacha20-poly1305"},
            "status": "active",
            "reset_usages": False,
        },
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["name"] == "test_user_template_updated"
    assert response.json()["group_ids"] == [2, 3]
    assert response.json()["expire_duration"] == (86400 * 30)
    assert not response.json()["reset_usages"]
    assert response.json()["status"] == "active"
    assert response.json()["extra_settings"]["flow"] == "xtls-rprx-vision"
    assert response.json()["extra_settings"]["method"] == "xchacha20-poly1305"


def test_user_template_get_by_id(access_token):
    """Test that the user template get by id route is accessible."""
    response = client.get(
        f"/api/user_template/{id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["name"] == "test_user_template_updated"
    assert response.json()["group_ids"] == [2, 3]
    assert response.json()["expire_duration"] == (86400 * 30)
