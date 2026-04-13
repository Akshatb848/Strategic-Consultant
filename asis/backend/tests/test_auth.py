from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from conftest import register_user


class MockHttpxResponse:
    def __init__(self, payload: dict | list, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            request = httpx.Request("GET", "https://example.com")
            response = httpx.Response(self.status_code, request=request)
            raise httpx.HTTPStatusError("mocked oauth failure", request=request, response=response)


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


@pytest.mark.anyio
async def test_auth_providers_default_to_unavailable(client):
    response = await client.get("/api/v1/auth/providers")
    assert response.status_code == 200
    assert response.json() == {"google": False, "github": False}


@pytest.mark.anyio
async def test_google_oauth_round_trip(client, monkeypatch):
    from asis.backend.api.routes import auth as auth_routes

    current_settings = auth_routes._settings()
    monkeypatch.setattr(current_settings, "google_client_id", "google-client", raising=False)
    monkeypatch.setattr(current_settings, "google_client_secret", "google-secret", raising=False)
    monkeypatch.setattr(
        current_settings,
        "google_callback_url",
        "http://testserver/api/v1/auth/google/callback",
        raising=False,
    )
    monkeypatch.setattr(current_settings, "frontend_url", "http://localhost:3001", raising=False)

    auth_redirect = await client.get("/api/v1/auth/google", follow_redirects=False)
    assert auth_redirect.status_code in {302, 307}
    parsed_redirect = urlparse(auth_redirect.headers["location"])
    state = parse_qs(parsed_redirect.query)["state"][0]

    def fake_post(url: str, *args, **kwargs):
        assert "oauth2.googleapis.com/token" in url
        return MockHttpxResponse({"access_token": "google-access"})

    def fake_get(url: str, *args, **kwargs):
        assert "openidconnect.googleapis.com" in url
        return MockHttpxResponse(
            {
                "sub": "google-user-1",
                "email": "google.user@example.com",
                "email_verified": True,
                "given_name": "Google",
                "family_name": "User",
                "picture": "https://example.com/google-user.png",
            }
        )

    monkeypatch.setattr(auth_routes.httpx, "post", fake_post)
    monkeypatch.setattr(auth_routes.httpx, "get", fake_get)

    callback = await client.get(
        f"/api/v1/auth/google/callback?code=demo-code&state={state}",
        follow_redirects=False,
    )
    assert callback.status_code in {302, 307}
    location = callback.headers["location"]
    assert location.startswith("http://localhost:3001/oauth/callback?token=")
    assert "refresh_token=" in callback.headers.get("set-cookie", "")

    token = parse_qs(urlparse(location).query)["token"][0]
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "google.user@example.com"
    assert me.json()["user"]["auth_provider"] == "google"


@pytest.mark.anyio
async def test_github_oauth_round_trip(client, monkeypatch):
    from asis.backend.api.routes import auth as auth_routes

    current_settings = auth_routes._settings()
    monkeypatch.setattr(current_settings, "github_client_id", "github-client", raising=False)
    monkeypatch.setattr(current_settings, "github_client_secret", "github-secret", raising=False)
    monkeypatch.setattr(
        current_settings,
        "github_callback_url",
        "http://testserver/api/v1/auth/github/callback",
        raising=False,
    )
    monkeypatch.setattr(current_settings, "frontend_url", "http://localhost:3001", raising=False)

    auth_redirect = await client.get("/api/v1/auth/github", follow_redirects=False)
    assert auth_redirect.status_code in {302, 307}
    parsed_redirect = urlparse(auth_redirect.headers["location"])
    state = parse_qs(parsed_redirect.query)["state"][0]

    def fake_post(url: str, *args, **kwargs):
        assert "github.com/login/oauth/access_token" in url
        return MockHttpxResponse({"access_token": "github-access"})

    def fake_get(url: str, *args, **kwargs):
        if url.endswith("/user"):
            return MockHttpxResponse(
                {
                    "id": 42,
                    "name": "GitHub User",
                    "avatar_url": "https://example.com/github-user.png",
                }
            )
        if url.endswith("/user/emails"):
            return MockHttpxResponse(
                [
                    {"email": "github.user@example.com", "primary": True, "verified": True},
                ]
            )
        raise AssertionError(f"Unexpected URL {url}")

    monkeypatch.setattr(auth_routes.httpx, "post", fake_post)
    monkeypatch.setattr(auth_routes.httpx, "get", fake_get)

    callback = await client.get(
        f"/api/v1/auth/github/callback?code=demo-code&state={state}",
        follow_redirects=False,
    )
    assert callback.status_code in {302, 307}
    location = callback.headers["location"]
    assert location.startswith("http://localhost:3001/oauth/callback?token=")
    assert "refresh_token=" in callback.headers.get("set-cookie", "")

    token = parse_qs(urlparse(location).query)["token"][0]
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "github.user@example.com"
    assert me.json()["user"]["auth_provider"] == "github"
