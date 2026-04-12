from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator

from asis.backend.schemas.analysis import StrategicBrief
from asis.backend.schemas.common import Citation


class AgentName(str, Enum):
    ORCHESTRATOR = "orchestrator"
    MARKET_INTEL = "market_intel"
    RISK_ASSESSMENT = "risk_assessment"
    COMPETITOR_ANALYSIS = "competitor_analysis"
    GEO_INTEL = "geo_intel"
    FINANCIAL_REASONING = "financial_reasoning"
    STRATEGIC_OPTIONS = "strategic_options"
    SYNTHESIS = "synthesis"


class FrameworkName(str, Enum):
    PESTLE = "pestle"
    SWOT = "swot"
    PORTERS_FIVE_FORCES = "porters_five_forces"
    ANSOFF = "ansoff"
    BCG_MATRIX = "bcg_matrix"
    MCKINSEY_7S = "mckinsey_7s"
    BLUE_OCEAN = "blue_ocean"
    BALANCED_SCORECARD = "balanced_scorecard"


class AgentToolCall(BaseModel):
    tool_name: str
    query: str
    response_size: int
    latency_ms: int


class AgentCollaborationEvent(BaseModel):
    source_agent: AgentName
    target_agent: AgentName
    data_field: str
    timestamp_ms: int
    contribution_summary: str


class FrameworkOutput(BaseModel):
    framework_name: FrameworkName
    agent_author: AgentName
    structured_data: dict[str, Any]
    narrative: str
    citations: list[Citation] = Field(default_factory=list)
    confidence_score: float = Field(ge=0, le=1)


class GeoIntelOutput(BaseModel):
    political_risk_score: float = Field(ge=0, le=10)
    trade_barriers: list[str] = Field(default_factory=list)
    regulatory_outlook: str
    cage_distance_analysis: dict[str, str]
    fdi_sentiment: str
    framework_outputs: dict[str, FrameworkOutput] = Field(default_factory=dict)


class StrategicOption(BaseModel):
    option: str
    quadrant: str
    feasibility_score: float = Field(ge=0, le=1)
    risk_score: float = Field(ge=0, le=1)
    rationale: str


class StrategicOptionsOutput(BaseModel):
    ansoff_quadrant: str
    strategic_options: list[StrategicOption] = Field(default_factory=list)
    blue_ocean_factors: dict[str, list[str]]
    mckinsey_7s_fit_score: float = Field(ge=0, le=1)
    recommended_option: str
    option_rationale: str
    framework_outputs: dict[str, FrameworkOutput] = Field(default_factory=dict)


class BalancedScorecardPerspective(BaseModel):
    objectives: list[str] = Field(default_factory=list)
    measures: list[str] = Field(default_factory=list)
    targets: list[str] = Field(default_factory=list)
    initiatives: list[str] = Field(default_factory=list)


class BalancedScorecardOutput(BaseModel):
    financial: BalancedScorecardPerspective
    customer: BalancedScorecardPerspective
    internal_process: BalancedScorecardPerspective
    learning_and_growth: BalancedScorecardPerspective


class RoadmapItem(BaseModel):
    phase: str
    actions: list[str] = Field(default_factory=list)
    owner_function: str
    success_metrics: list[str] = Field(default_factory=list)
    estimated_investment_usd: float | None = None


class ReportMetadata(BaseModel):
    analysis_id: str
    company_name: str
    query: str
    generated_at: datetime
    asis_version: str = "4.0.0"
    confidentiality_level: str = "STRICTLY CONFIDENTIAL"
    disclaimer: str


class StrategicBriefV4(StrategicBrief):
    decision_statement: str
    decision_confidence: float = Field(ge=0, le=1)
    decision_rationale: str
    framework_outputs: dict[str, FrameworkOutput]
    agent_collaboration_trace: list[AgentCollaborationEvent] = Field(default_factory=list)
    executive_summary: str
    implementation_roadmap: list[RoadmapItem] = Field(default_factory=list)
    balanced_scorecard: BalancedScorecardOutput
    report_metadata: ReportMetadata
    overall_confidence: float = Field(ge=0, le=1)

    @field_validator("decision_statement")
    @classmethod
    def validate_decision_statement(cls, value: str) -> str:
        allowed_prefixes = ("PROCEED", "CONDITIONAL PROCEED", "DO NOT PROCEED")
        normalized = value.strip()
        if not normalized.startswith(allowed_prefixes):
            raise ValueError("decision_statement must begin with PROCEED, CONDITIONAL PROCEED, or DO NOT PROCEED")
        return normalized

    @field_validator("framework_outputs")
    @classmethod
    def validate_framework_outputs(cls, value: dict[str, FrameworkOutput]) -> dict[str, FrameworkOutput]:
        expected = {framework.value for framework in FrameworkName}
        missing = expected.difference(value.keys())
        if missing:
            raise ValueError(f"framework_outputs missing required frameworks: {', '.join(sorted(missing))}")
        return value


class DecisionResponse(BaseModel):
    decision_statement: str
    decision_confidence: float = Field(ge=0, le=1)
    decision_rationale: str
    supporting_frameworks: list[str] = Field(default_factory=list)


class FrameworkOutputsResponse(BaseModel):
    framework_outputs: dict[str, FrameworkOutput]


class CollaborationTraceResponse(BaseModel):
    agent_collaboration_trace: list[AgentCollaborationEvent] = Field(default_factory=list)


class PdfStatusResponse(BaseModel):
    status: str
    progress: int = Field(ge=0, le=100)
    error: str | None = None
