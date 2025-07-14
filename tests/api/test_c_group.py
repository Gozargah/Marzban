import random

from fastapi import status

from tests.api import client

group_names = ["testgroup", "testgroup2", "testgroup3"]


def test_group_create(access_token):
    """Test that the group create route is accessible."""

    inbounds = client.get(
        url="/api/inbounds",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert inbounds.status_code == status.HTTP_200_OK
    for group_name in group_names:
        random_inbound = random.sample(
            inbounds.json(),
            k=min(3, len(inbounds.json())),
        )
        response = client.post(
            url="/api/group",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"name": group_name, "inbound_tags": random_inbound},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["name"] == group_name
        for inbound in response.json()["inbound_tags"]:
            assert inbound in random_inbound


def test_group_update(access_token):
    """Test that the group update route is accessible."""
    response = client.put(
        url="/api/group/1",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"name": "testgroup4", "is_disabled": True},
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["name"] == "testgroup4"
    assert response.json()["is_disabled"] is True


def test_group_delete(access_token):
    """Test that the group delete route is accessible."""
    response = client.delete(
        url="/api/group/1",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_204_NO_CONTENT


def test_group_get_by_id(access_token):
    """Test that the group get by id route is accessible."""
    response = client.get(
        url="/api/group/2",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["name"] == "testgroup2"


def test_groups_get(access_token):
    """Test that the group get route is accessible."""
    response = client.get(
        url="/api/groups",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["total"] == 2
    return response.json()["groups"]
