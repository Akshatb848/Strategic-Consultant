from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from asis.backend.api.dependencies import get_current_user
from asis.backend.db import models
from asis.backend.db.database import get_db
from asis.backend.memory.store import memory_store
from asis.backend.schemas.memory import MemoryEntryResponse, MemoryUpsertRequest

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("", response_model=dict)
def list_memory(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    items = memory_store.list_entries(db, user.id)
    return {"items": [MemoryEntryResponse.model_validate(item) for item in items]}


@router.post("", response_model=dict)
def upsert_memory(
    payload: MemoryUpsertRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    entry = memory_store.upsert(db, user.id, payload.scope, payload.key, payload.value)
    return {"item": MemoryEntryResponse.model_validate(entry)}


@router.delete("", response_model=dict)
def clear_memory(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    deleted = memory_store.clear(db, user.id)
    return {"message": f"Deleted {deleted} memory entries"}
