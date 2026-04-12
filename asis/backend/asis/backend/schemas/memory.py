from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from asis.backend.schemas.common import OrmModel


class MemoryEntryResponse(OrmModel):
    id: str
    scope: str
    key: str
    value: dict
    created_at: datetime
    updated_at: datetime


class MemoryListResponse(BaseModel):
    items: list[MemoryEntryResponse]


class MemoryUpsertRequest(BaseModel):
    scope: str
    key: str
    value: dict
