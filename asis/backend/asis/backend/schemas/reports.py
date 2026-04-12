from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from asis.backend.schemas.analysis import StrategicBrief
from asis.backend.schemas.common import OrmModel


class ReportResponse(OrmModel):
    id: str
    analysis_id: str
    user_id: str
    strategic_brief: dict | StrategicBrief
    evaluation: dict | None
    pdf_url: str | None
    pdf_status: str | None = None
    pdf_progress: int | None = None
    pdf_error: str | None = None
    pdf_generated_at: datetime | None = None
    report_version: int
    created_at: datetime
    updated_at: datetime


class EvaluationResponse(BaseModel):
    multi_agent_score: float
    baseline_score: float
    delta: float
    dimension_scores: dict[str, float]
