from __future__ import annotations

from uuid import uuid4

from sqlalchemy.orm import Session

from asis.backend.db import models


class MemoryStore:
    def list_entries(self, db: Session, user_id: str) -> list[models.MemoryRecord]:
        return (
            db.query(models.MemoryRecord)
            .filter(models.MemoryRecord.user_id == user_id)
            .order_by(models.MemoryRecord.updated_at.desc())
            .all()
        )

    def remember_analysis(self, db: Session, user_id: str, analysis_id: str, query: str, summary: str) -> None:
        entry = models.MemoryRecord(
            id=uuid4().hex,
            user_id=user_id,
            scope="analysis",
            key=f"analysis:{analysis_id}",
            value={"query": query, "summary": summary},
        )
        db.add(entry)
        db.commit()

    def clear(self, db: Session, user_id: str) -> int:
        deleted = db.query(models.MemoryRecord).filter(models.MemoryRecord.user_id == user_id).delete()
        db.commit()
        return deleted


memory_store = MemoryStore()
