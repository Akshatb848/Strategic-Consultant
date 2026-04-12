from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from asis.backend.schemas.common import Citation, OrmModel


class CompanyContext(BaseModel):
    company_name: str | None = None
    sector: str | None = None
    geography: str | None = None
    decision_type: str | None = None
    headquarters: str | None = None
    annual_revenue: str | None = None
    employees: str | None = None
    strategic_constraints: list[str] = Field(default_factory=list)


class AnalysisCreateRequest(BaseModel):
    query: str = Field(min_length=12, max_length=5000)
    company_context: CompanyContext = Field(default_factory=CompanyContext)
    run_baseline: bool = False


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
    duration_seconds: float | None
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
