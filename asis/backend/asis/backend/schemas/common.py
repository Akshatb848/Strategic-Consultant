from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Citation(BaseModel):
    id: str | None = None
    title: str
    source: str
    url: str
    published_at: str
    excerpt: str
    verification_status: str = "unverified"
    retrieved_at: str | None = None
    retrieval_query: str | None = None
    source_type: str = "web"


class MessageResponse(BaseModel):
    message: str


class PaginatedResponse(BaseModel):
    total: int
    items: list[Any]


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    demo_mode: bool | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
