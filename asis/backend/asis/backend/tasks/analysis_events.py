from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from asis.backend.agents.types import now_ms
from asis.backend.db import models
import asis.backend.db.database as _db_module
from asis.backend.tasks.event_bus import event_bus


def publish_analysis_event(analysis_id: str, event_name: str, payload: dict) -> None:
    timestamp = int(payload.get("timestamp_ms") or now_ms())
    persisted_payload = {**payload, "timestamp_ms": timestamp}
    # Access SessionLocal via the module reference so reset_engine() changes are picked up
    with _db_module.SessionLocal() as db:
        db.add(
            models.AnalysisEvent(
                id=uuid4().hex,
                analysis_id=analysis_id,
                event_name=event_name,
                payload=persisted_payload,
                timestamp_ms=timestamp,
                created_at=datetime.utcnow(),
            )
        )
        db.commit()
    event_bus.publish(analysis_id, event_name, persisted_payload)
