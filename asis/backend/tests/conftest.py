from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
import httpx

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


@pytest.fixture()
async def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("RUN_ANALYSES_INLINE", "true")
    monkeypatch.setenv("ASIS_DEMO_MODE", "true")
    monkeypatch.setenv("ENABLE_AUTO_SCHEMA", "true")
    monkeypatch.setenv("JWT_SECRET", "test-secret-test-secret-test-secret")
    monkeypatch.setenv("ENVIRONMENT", "test")
    # Disable rate limits so tests can create multiple analyses without hitting caps
    monkeypatch.setenv("RATE_LIMIT_ANALYSES_PER_MINUTE", "9999")
    monkeypatch.setenv("RATE_LIMIT_ANALYSES_PER_DAY", "9999")

    from asis.backend.config.settings import get_settings
    from asis.backend.db.database import init_db, reset_engine
    from asis.backend.main import app

    get_settings.cache_clear()
    reset_engine()
    init_db()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as test_client:
        yield test_client


async def register_user(client: httpx.AsyncClient, email: str = "user@example.com") -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "supersecure123",
            "first_name": "Akshat",
            "last_name": "Banga",
            "organisation_name": "ASIS Labs",
        },
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
