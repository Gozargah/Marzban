from unittest.mock import AsyncMock

from fastapi import status
from pytest import MonkeyPatch

from app.db.models import System
from tests.api import client


def test_system(access_token, monkeypatch: MonkeyPatch):
    system = System(873259981, 1547846375)
    system_mock = AsyncMock()
    system_mock.return_value = system
    monkeypatch.setattr("app.operation.system.get_system_usage", system_mock)

    response = client.get(
        "/api/system",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
