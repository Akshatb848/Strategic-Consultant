from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from asis.backend.agents.types import now_ms
from asis.backend.db import models
from asis.backend.db.database import SessionLocal
from asis.backend.tasks.event_bus import event_bus


def publish_analysis_event(analysis_id: str, event_name: str, payload: dict) -> None:
    timestamp = int(payload.get("timestamp_ms") or now_ms())
    persisted_payload = {**payload, "timestamp_ms": timestamp}
    with SessionLocal() as db:
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
