from __future__ import annotations

import pytest
from sqlalchemy import text

from conftest import register_user


@pytest.mark.anyio
async def test_memory_endpoint_recovers_missing_table(client):
    headers = await register_user(client, email="memory@example.com")

    from asis.backend.db.database import engine

    with engine.begin() as connection:
        connection.execute(text("DROP TABLE IF EXISTS memory_records"))

    create_response = await client.post(
        "/api/v1/memory",
        headers=headers,
        json={
            "scope": "profile",
            "key": "company_profile",
            "value": {"company_name": "ASIS Labs"},
        },
    )
    assert create_response.status_code == 200, create_response.text
    assert create_response.json()["item"]["value"]["company_name"] == "ASIS Labs"

    list_response = await client.get("/api/v1/memory", headers=headers)
    assert list_response.status_code == 200, list_response.text
    assert len(list_response.json()["items"]) == 1
