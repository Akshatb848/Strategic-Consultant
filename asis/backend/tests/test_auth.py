from __future__ import annotations

import pytest

from conftest import register_user


@pytest.mark.anyio
async def test_register_me_refresh_and_logout(client):
    headers = await register_user(client, email="auth@example.com")

    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "auth@example.com"

    refreshed = await client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200
    refreshed_token = refreshed.json()["access_token"]
    assert refreshed_token

    logout = await client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {refreshed_token}"})
    assert logout.status_code == 200

    refreshed_again = await client.post("/api/v1/auth/refresh")
    assert refreshed_again.status_code == 401
