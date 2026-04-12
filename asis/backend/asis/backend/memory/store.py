from __future__ import annotations

from uuid import uuid4

from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from asis.backend.config.logging import logger
from asis.backend.db import models
from asis.backend.db.database import init_db


class MemoryStore:
    @staticmethod
    def _is_schema_error(exc: Exception) -> bool:
        message = str(getattr(exc, "orig", exc)).lower()
        return any(
            marker in message
            for marker in [
                "memory_records",
                "no such table",
                "does not exist",
                "undefined table",
                "no such column",
            ]
        )

    def _run_with_schema_recovery(self, db: Session, operation):
        try:
            return operation()
        except (OperationalError, ProgrammingError) as exc:
            if not self._is_schema_error(exc):
                raise
            logger.warning("memory_store_schema_recovery", error=str(exc))
            db.rollback()
            init_db()
            return operation()

    def list_entries(self, db: Session, user_id: str) -> list[models.MemoryRecord]:
        return self._run_with_schema_recovery(
            db,
            lambda: (
                db.query(models.MemoryRecord)
                .filter(models.MemoryRecord.user_id == user_id)
                .order_by(models.MemoryRecord.updated_at.desc())
                .all()
            )
        )

    def remember_analysis(self, db: Session, user_id: str, analysis_id: str, query: str, summary: str) -> None:
        def operation() -> None:
            entry = models.MemoryRecord(
                id=uuid4().hex,
                user_id=user_id,
                scope="analysis",
                key=f"analysis:{analysis_id}",
                value={"query": query, "summary": summary},
            )
            db.add(entry)
            db.commit()

        self._run_with_schema_recovery(db, operation)

    def upsert(self, db: Session, user_id: str, scope: str, key: str, value: dict) -> models.MemoryRecord:
        def operation() -> models.MemoryRecord:
            entry = (
                db.query(models.MemoryRecord)
                .filter(
                    models.MemoryRecord.user_id == user_id,
                    models.MemoryRecord.scope == scope,
                    models.MemoryRecord.key == key,
                )
                .one_or_none()
            )
            if entry:
                entry.value = value
            else:
                entry = models.MemoryRecord(
                    id=uuid4().hex,
                    user_id=user_id,
                    scope=scope,
                    key=key,
                    value=value,
                )
                db.add(entry)
            db.commit()
            db.refresh(entry)
            return entry

        return self._run_with_schema_recovery(db, operation)

    def clear(self, db: Session, user_id: str) -> int:
        return self._run_with_schema_recovery(
            db,
            lambda: self._clear(db, user_id)
        )

    @staticmethod
    def _clear(db: Session, user_id: str) -> int:
        deleted = db.query(models.MemoryRecord).filter(models.MemoryRecord.user_id == user_id).delete()
        db.commit()
        return deleted


memory_store = MemoryStore()
