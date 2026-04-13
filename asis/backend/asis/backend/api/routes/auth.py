from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from uuid import uuid4

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from asis.backend.api.dependencies import get_current_user
from asis.backend.api.security import (
    clear_refresh_cookie,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_refresh_token,
    set_refresh_cookie,
    verify_password,
)
from asis.backend.config.settings import get_settings
from asis.backend.db import models
from asis.backend.db.database import get_db
from asis.backend.schemas.auth import (
    AuthProvidersResponse,
    AuthResponse,
    LoginRequest,
    RefreshResponse,
    RegisterRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _settings():
    return get_settings()


def _initials(first_name: str, last_name: str) -> str:
    return (f"{first_name[:1]}{last_name[:1]}" or "AS").upper()


def _organisation_for_signup(db: Session, organisation_name: str | None, email: str) -> models.Organisation | None:
    if organisation_name:
        organisation = db.query(models.Organisation).filter(models.Organisation.name == organisation_name).one_or_none()
        if organisation:
            return organisation
        organisation = models.Organisation(id=uuid4().hex, name=organisation_name, domain=email.split("@")[-1])
        db.add(organisation)
        db.commit()
        db.refresh(organisation)
        return organisation
    return None


def _oauth_callback_frontend() -> str:
    return f"{_settings().frontend_url.rstrip('/')}/oauth/callback"


def _login_error_redirect(error_code: str) -> RedirectResponse:
    return RedirectResponse(f"{_settings().frontend_url.rstrip('/')}/login?error={error_code}")


def _oauth_available(provider: str) -> bool:
    settings = _settings()
    if provider == "google":
        return bool(settings.google_client_id and settings.google_client_secret and settings.google_callback_url)
    if provider == "github":
        return bool(settings.github_client_id and settings.github_client_secret and settings.github_callback_url)
    return False


def _create_oauth_state_token(provider: str) -> str:
    settings = _settings()
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    payload = {"sub": provider, "provider": provider, "type": "oauth_state", "jti": uuid4().hex, "exp": expires}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _validate_oauth_state(provider: str, state: str | None) -> bool:
    if not state:
        return False
    try:
        payload = decode_token(state, "oauth_state")
    except HTTPException:
        return False
    return payload.get("provider") == provider


def _oauth_authorize_redirect(provider: str, authorization_url: str, query: dict[str, str]) -> RedirectResponse:
    if not _oauth_available(provider):
        return _login_error_redirect(f"{provider}_unavailable")
    return RedirectResponse(f"{authorization_url}?{urlencode(query)}")


def _normalise_name(name: str | None, email: str) -> tuple[str, str]:
    if name and name.strip():
        parts = [part for part in name.strip().split() if part]
        if len(parts) == 1:
            return parts[0], "User"
        return parts[0], " ".join(parts[1:])
    handle = email.split("@", 1)[0]
    tokenised = [token for token in handle.replace(".", " ").replace("_", " ").replace("-", " ").split() if token]
    if not tokenised:
        return "ASIS", "User"
    if len(tokenised) == 1:
        return tokenised[0].title(), "User"
    return tokenised[0].title(), " ".join(token.title() for token in tokenised[1:])


def _create_auth_session(response: Response, user: models.User, db: Session) -> str:
    user.last_login_at = datetime.utcnow()
    access_token = create_access_token(user.id)
    refresh_token, expires_at = create_refresh_token(user.id)
    db.query(models.RefreshToken).filter(models.RefreshToken.user_id == user.id).delete()
    db.add(models.RefreshToken(id=uuid4().hex, user_id=user.id, token_hash=hash_refresh_token(refresh_token), expires_at=expires_at))
    db.commit()
    set_refresh_cookie(response, refresh_token)
    return access_token


def _upsert_oauth_user(
    *,
    db: Session,
    provider: str,
    provider_subject: str,
    email: str,
    first_name: str,
    last_name: str,
    avatar_url: str | None,
) -> models.User:
    email = email.lower().strip()
    provider_field = "google_id" if provider == "google" else "github_id"
    user = db.query(models.User).filter(getattr(models.User, provider_field) == provider_subject).one_or_none()
    if not user:
        user = db.query(models.User).filter(models.User.email == email).one_or_none()

    if user:
        setattr(user, provider_field, provider_subject)
        user.auth_provider = provider
        if avatar_url:
            user.avatar_url = avatar_url
        if not user.first_name:
            user.first_name = first_name
        if not user.last_name:
            user.last_name = last_name
        if not user.avatar_initials:
            user.avatar_initials = _initials(first_name, last_name)
        db.commit()
        db.refresh(user)
        return user

    user = models.User(
        id=uuid4().hex,
        email=email,
        password_hash=hash_password(uuid4().hex),
        first_name=first_name,
        last_name=last_name,
        title="",
        organisation_name="",
        organisation_id=None,
        avatar_initials=_initials(first_name, last_name),
        avatar_url=avatar_url,
        auth_provider=provider,
        google_id=provider_subject if provider == "google" else None,
        github_id=provider_subject if provider == "github" else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _google_profile(code: str) -> dict[str, str] | None:
    settings = _settings()
    token_response = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_callback_url,
            "grant_type": "authorization_code",
        },
        timeout=20.0,
    )
    token_response.raise_for_status()
    access_token = token_response.json().get("access_token")
    if not access_token:
        return None
    profile_response = httpx.get(
        "https://openidconnect.googleapis.com/v1/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=20.0,
    )
    profile_response.raise_for_status()
    profile = profile_response.json()
    if not profile.get("email") or not profile.get("email_verified"):
        return None
    return {
        "subject": str(profile.get("sub") or ""),
        "email": str(profile.get("email") or ""),
        "first_name": str(profile.get("given_name") or ""),
        "last_name": str(profile.get("family_name") or ""),
        "avatar_url": str(profile.get("picture") or "") or None,
    }


def _github_profile(code: str) -> dict[str, str] | None:
    settings = _settings()
    token_response = httpx.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        data={
            "client_id": settings.github_client_id,
            "client_secret": settings.github_client_secret,
            "code": code,
            "redirect_uri": settings.github_callback_url,
        },
        timeout=20.0,
    )
    token_response.raise_for_status()
    access_token = token_response.json().get("access_token")
    if not access_token:
        return None

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    profile_response = httpx.get("https://api.github.com/user", headers=headers, timeout=20.0)
    profile_response.raise_for_status()
    profile = profile_response.json()
    emails_response = httpx.get("https://api.github.com/user/emails", headers=headers, timeout=20.0)
    emails_response.raise_for_status()
    emails = emails_response.json()
    primary_email = next((item.get("email") for item in emails if item.get("primary") and item.get("verified")), None)
    if not primary_email:
        primary_email = next((item.get("email") for item in emails if item.get("verified")), None)
    if not primary_email:
        return None
    first_name, last_name = _normalise_name(profile.get("name"), primary_email)
    return {
        "subject": str(profile.get("id") or ""),
        "email": str(primary_email),
        "first_name": first_name,
        "last_name": last_name,
        "avatar_url": str(profile.get("avatar_url") or "") or None,
    }


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    email = payload.email.lower().strip()
    existing = db.query(models.User).filter(models.User.email == email).one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="ALREADY_EXISTS")
    organisation = _organisation_for_signup(db, payload.organisation_name, email)
    user = models.User(
        id=uuid4().hex,
        email=email,
        password_hash=hash_password(payload.password),
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        title=payload.title or "",
        organisation_name=payload.organisation_name or "",
        organisation_id=organisation.id if organisation else None,
        avatar_initials=_initials(payload.first_name, payload.last_name),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    access_token = _create_auth_session(response, user, db)
    return AuthResponse(user=UserResponse.model_validate(user), access_token=access_token)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    email = payload.email.lower().strip()
    user = db.query(models.User).filter(models.User.email == email).one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="INVALID_CREDENTIALS")
    access_token = _create_auth_session(response, user, db)
    return AuthResponse(user=UserResponse.model_validate(user), access_token=access_token)


@router.post("/refresh", response_model=RefreshResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> RefreshResponse:
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="NO_REFRESH_TOKEN")
    payload = decode_token(refresh_token, "refresh")
    token_hash = hash_refresh_token(refresh_token)
    stored = db.query(models.RefreshToken).filter(models.RefreshToken.token_hash == token_hash).one_or_none()
    if not stored:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="INVALID_REFRESH_TOKEN")
    db.delete(stored)
    new_refresh_token, expires_at = create_refresh_token(payload["sub"])
    db.add(models.RefreshToken(id=uuid4().hex, user_id=payload["sub"], token_hash=hash_refresh_token(new_refresh_token), expires_at=expires_at))
    db.commit()
    set_refresh_cookie(response, new_refresh_token)
    return RefreshResponse(access_token=create_access_token(payload["sub"]))


@router.post("/logout")
def logout(
    response: Response,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    db.query(models.RefreshToken).filter(models.RefreshToken.user_id == user.id).delete()
    db.commit()
    clear_refresh_cookie(response)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=dict)
def me(user: models.User = Depends(get_current_user)) -> dict:
    return {"user": UserResponse.model_validate(user)}


@router.get("/providers", response_model=AuthProvidersResponse)
def providers() -> AuthProvidersResponse:
    return AuthProvidersResponse(google=_oauth_available("google"), github=_oauth_available("github"))


@router.get("/google")
def google_oauth() -> RedirectResponse:
    settings = _settings()
    return _oauth_authorize_redirect(
        "google",
        "https://accounts.google.com/o/oauth2/v2/auth",
        {
            "client_id": settings.google_client_id or "",
            "redirect_uri": settings.google_callback_url,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "consent",
            "state": _create_oauth_state_token("google"),
        },
    )


@router.get("/google/callback")
def google_callback(code: str | None = None, state: str | None = None, error: str | None = None, db: Session = Depends(get_db)) -> RedirectResponse:
    if error:
        return _login_error_redirect("google_failed")
    if not _oauth_available("google") or not _validate_oauth_state("google", state) or not code:
        return _login_error_redirect("google_failed")
    try:
        profile = _google_profile(code)
    except httpx.HTTPError:
        profile = None
    if not profile or not profile.get("subject"):
        return _login_error_redirect("google_failed")
    user = _upsert_oauth_user(
        db=db,
        provider="google",
        provider_subject=profile["subject"],
        email=profile["email"],
        first_name=profile["first_name"] or _normalise_name(None, profile["email"])[0],
        last_name=profile["last_name"] or _normalise_name(None, profile["email"])[1],
        avatar_url=profile.get("avatar_url"),
    )
    response = RedirectResponse(_oauth_callback_frontend())
    access_token = _create_auth_session(response, user, db)
    response.headers["Location"] = f"{_oauth_callback_frontend()}?token={access_token}"
    return response


@router.get("/github")
def github_oauth() -> RedirectResponse:
    settings = _settings()
    return _oauth_authorize_redirect(
        "github",
        "https://github.com/login/oauth/authorize",
        {
            "client_id": settings.github_client_id or "",
            "redirect_uri": settings.github_callback_url,
            "scope": "read:user user:email",
            "state": _create_oauth_state_token("github"),
        },
    )


@router.get("/github/callback")
def github_callback(code: str | None = None, state: str | None = None, error: str | None = None, db: Session = Depends(get_db)) -> RedirectResponse:
    if error:
        return _login_error_redirect("github_failed")
    if not _oauth_available("github") or not _validate_oauth_state("github", state) or not code:
        return _login_error_redirect("github_failed")
    try:
        profile = _github_profile(code)
    except httpx.HTTPError:
        profile = None
    if not profile or not profile.get("subject"):
        return _login_error_redirect("github_failed")
    user = _upsert_oauth_user(
        db=db,
        provider="github",
        provider_subject=profile["subject"],
        email=profile["email"],
        first_name=profile["first_name"],
        last_name=profile["last_name"],
        avatar_url=profile.get("avatar_url"),
    )
    response = RedirectResponse(_oauth_callback_frontend())
    access_token = _create_auth_session(response, user, db)
    response.headers["Location"] = f"{_oauth_callback_frontend()}?token={access_token}"
    return response
