from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from asis.backend.schemas.common import OrmModel


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    title: str | None = None
    organisation_name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)


class UserResponse(OrmModel):
    id: str
    email: str
    first_name: str
    last_name: str
    title: str
    role: str
    organisation_name: str
    plan: str
    avatar_initials: str
    avatar_url: str | None
    auth_provider: str
    is_active: bool
    is_admin: bool
    analysis_count: int
    last_login_at: datetime | None
    created_at: datetime


class AuthResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str = "bearer"


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthProvidersResponse(BaseModel):
    google: bool
    github: bool
