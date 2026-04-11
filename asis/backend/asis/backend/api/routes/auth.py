from __future__ import annotations

from uuid import uuid4

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
from asis.backend.schemas.auth import AuthResponse, LoginRequest, RefreshResponse, RegisterRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _initials(first_name: str, last_name: str) -> str:
    return f"{first_name[:1]}{last_name[:1]}".upper()


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
    access_token = create_access_token(user.id)
    refresh_token, expires_at = create_refresh_token(user.id)
    db.add(models.RefreshToken(id=uuid4().hex, user_id=user.id, token_hash=hash_refresh_token(refresh_token), expires_at=expires_at))
    db.commit()
    set_refresh_cookie(response, refresh_token)
    return AuthResponse(user=UserResponse.model_validate(user), access_token=access_token)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    email = payload.email.lower().strip()
    user = db.query(models.User).filter(models.User.email == email).one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="INVALID_CREDENTIALS")
    user.last_login_at = user.updated_at
    access_token = create_access_token(user.id)
    refresh_token, expires_at = create_refresh_token(user.id)
    db.query(models.RefreshToken).filter(models.RefreshToken.user_id == user.id).delete()
    db.add(models.RefreshToken(id=uuid4().hex, user_id=user.id, token_hash=hash_refresh_token(refresh_token), expires_at=expires_at))
    db.commit()
    set_refresh_cookie(response, refresh_token)
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


@router.get("/google")
def google_oauth() -> RedirectResponse:
    return RedirectResponse(f"{settings.frontend_url}/login?error=google_unavailable")


@router.get("/google/callback")
def google_callback() -> RedirectResponse:
    return RedirectResponse(f"{settings.frontend_url}/login?error=google_unavailable")


@router.get("/github")
def github_oauth() -> RedirectResponse:
    return RedirectResponse(f"{settings.frontend_url}/login?error=github_unavailable")


@router.get("/github/callback")
def github_callback() -> RedirectResponse:
    return RedirectResponse(f"{settings.frontend_url}/login?error=github_unavailable")
