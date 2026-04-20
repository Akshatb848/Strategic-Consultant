from __future__ import annotations

from time import time
from typing import Literal, TypedDict

from pydantic import BaseModel, Field

from asis.backend.schemas.common import Citation


class AgentOutput(BaseModel):
    agent_id: str
    agent_name: str
    status: Literal["completed", "failed", "self_corrected"] = "completed"
    confidence_score: float
    duration_ms: int
    model_used: str | None = None
    tools_called: list[dict] = Field(default_factory=list)
    langfuse_trace_id: str | None = None
    attempt_number: int = 1
    self_corrected: bool = False
    correction_reason: str | None = None
    token_usage: dict | None = None
    citations: list[dict] = Field(default_factory=list)
    used_fallback: bool = False
    data: dict


class PipelineState(TypedDict, total=False):
    analysis_id: str
    user_id: str
    query: str
    company_context: dict
    extracted_context: dict
    orchestrator_output: dict
    strategist_output: dict
    strategist_confidence: float
    quant_output: dict
    quant_confidence: float
    market_intel_output: dict
    market_intel_confidence: float
    risk_output: dict
    risk_confidence: float
    red_team_output: dict
    red_team_confidence: float
    ethicist_output: dict
    ethicist_confidence: float
    cove_output: dict
    cove_confidence: float
    synthesis_output: dict
    overall_confidence: float
    self_correction_count: int
    logic_consistency_passed: bool
    reroute_agent: str | None
    started_at: float


def now_ms() -> int:
    return int(time() * 1000)
