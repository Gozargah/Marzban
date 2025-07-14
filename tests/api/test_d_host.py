from fastapi import status

from tests.api import client
from tests.api.test_c_group import test_groups_get

host_data = {
    "remark": "test_host",
    "address": "127.0.0.1",
    "port": 443,
    "sni": "test_sni.com",
    "inbound_tag": "",
    "priority": 1,
}


def test_host_create(access_token):
    """Test that the host create route is accessible."""

    groups = test_groups_get(access_token)

    for i, group in enumerate(groups):
        for j, inbound in enumerate(group["inbound_tags"]):
            host_data["inbound_tag"] = inbound
            host_data["priority"] = (i + j) + 1
            host_data["sni"] = f"test_sni_{i}_{j}.com"
            host_data["remark"] = f"test_host_{i}_{j}"
            response = client.post(
                "/api/host",
                headers={"Authorization": f"Bearer {access_token}"},
                json=host_data,
            )
            assert response.status_code == status.HTTP_201_CREATED
            assert response.json()["remark"] == f"test_host_{i}_{j}"
            assert response.json()["address"] == "127.0.0.1"
            assert response.json()["port"] == 443
            assert response.json()["sni"] == f"test_sni_{i}_{j}.com"
            assert response.json()["inbound_tag"] == inbound


def test_host_get(access_token):
    """Test that the host get route is accessible."""
    response = client.get(
        "/api/hosts",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) > 0


def test_host_update(access_token):
    """Test that the host update route is accessible."""
    response = client.put(
        "/api/host/1",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "remark": "test_host_updated",
            "priority": 666,
            "address": "127.0.0.2",
            "port": 443,
            "sni": "test_sni_updated.com",
            "inbound_tag": "Trojan Websocket TLS",
        },
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["remark"] == "test_host_updated"
    assert response.json()["address"] == "127.0.0.2"
    assert response.json()["port"] == 443
    assert response.json()["sni"] == "test_sni_updated.com"
    assert response.json()["priority"] == 666
    assert response.json()["inbound_tag"] == "Trojan Websocket TLS"


def test_host_delete(access_token):
    """Test that the host delete route is accessible."""
    response = client.delete(
        "/api/host/1",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_204_NO_CONTENT
