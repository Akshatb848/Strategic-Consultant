from __future__ import annotations

import html
import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from asis.backend.schemas.common import Citation, OrmModel

# Patterns that suggest prompt-injection or script-injection attempts
_INJECTION_PATTERNS = re.compile(
    r"(<script|</script|javascript:|on\w+\s*=|<iframe|<object|<embed|"
    r"ignore previous|disregard.*instruction|you are now|act as|"
    r"system:\s*you|###\s*instruction)",
    re.IGNORECASE,
)


def _sanitise_text(value: str) -> str:
    """Strip leading/trailing whitespace, decode HTML entities, reject injection."""
    cleaned = html.unescape(value).strip()
    if _INJECTION_PATTERNS.search(cleaned):
        raise ValueError(
            "Query contains disallowed patterns. "
            "Please rephrase your strategic question without HTML or prompt-injection tokens."
        )
    return cleaned


class CompanyContext(BaseModel):
    company_name: str | None = None
    sector: str | None = None
    geography: str | None = None
    decision_type: str | None = None
    headquarters: str | None = None
    annual_revenue: str | None = None
    employees: str | None = None
    strategic_constraints: list[str] = Field(default_factory=list)

    @field_validator("company_name", "sector", "geography", "decision_type", "headquarters", "annual_revenue", "employees", mode="before")
    @classmethod
    def sanitise_string_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _sanitise_text(str(value))


class AnalysisCreateRequest(BaseModel):
    query: str = Field(min_length=12, max_length=5000)
    company_context: CompanyContext = Field(default_factory=CompanyContext)
    run_baseline: bool = False

    @field_validator("query", mode="before")
    @classmethod
    def sanitise_query(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("query must be a string")
        return _sanitise_text(value)


class AgentLogResponse(OrmModel):
    id: str
    agent_id: str
    agent_name: str
    event_type: str
    status: str
    confidence_score: float | None
    model_used: str | None = None
    tools_called: list | None = None
    langfuse_trace_id: str | None = None
    attempt_number: int
    self_corrected: bool
    correction_reason: str | None
    duration_ms: int | None
    token_usage: dict | None
    tokens_in: int | None = None
    tokens_out: int | None = None
    cost_usd: float | None = None
    citations: list | None
    parsed_output: dict | None
    created_at: datetime


class AnalysisSummary(OrmModel):
    id: str
    query: str
    company_context: dict
    extracted_context: dict
    status: str
    current_agent: str | None
    pipeline_version: str
    overall_confidence: float | None
    decision_recommendation: str | None
    executive_summary: str | None
    error_message: str | None = None
    duration_seconds: float | None
    total_cost_usd: float | None = None
    created_at: datetime
    completed_at: datetime | None


class StrategicBrief(BaseModel):
    executive_summary: str | dict[str, Any]
    board_narrative: str
    recommendation: str
    overall_confidence: float
    frameworks_applied: list[str]
    context: dict[str, Any]
    market_analysis: dict[str, Any]
    financial_analysis: dict[str, Any]
    risk_analysis: dict[str, Any]
    red_team: dict[str, Any]
    verification: dict[str, Any] | str
    roadmap: list[dict[str, Any]] | list[Any]
    balanced_scorecard: list[dict[str, Any]] | dict[str, Any]
    citations: list[Citation]


class AnalysisDetail(AnalysisSummary):
    strategic_brief: dict[str, Any] | StrategicBrief | None
    logic_consistency_passed: bool | None
    self_correction_count: int
    agent_logs: list[AgentLogResponse]
    report_id: str | None = None


class AnalysisResponse(BaseModel):
    analysis: AnalysisDetail | AnalysisSummary
