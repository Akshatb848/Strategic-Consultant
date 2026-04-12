from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from asis.backend.schemas.analysis import StrategicBrief
from asis.backend.schemas.common import Citation


def _normalize_unit_interval(value: float | int | None) -> float:
    if value is None:
        return 0.0
    numeric = float(value)
    if numeric > 1:
        numeric /= 100
    return round(max(0.0, min(1.0, numeric)), 3)


class AgentName(str, Enum):
    ORCHESTRATOR = "orchestrator"
    MARKET_INTELLIGENCE = "market_intel"
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


class QualityCheckResult(BaseModel):
    id: str
    description: str
    level: Literal["BLOCK", "WARN"]
    passed: bool
    notes: str | None = None


class QualityReport(BaseModel):
    overall_grade: Literal["A", "B", "C", "FAIL"]
    checks: list[QualityCheckResult] = Field(default_factory=list)
    quality_flags: list[str] = Field(default_factory=list)
    mece_score: float = Field(default=0.0, ge=0, le=1)
    citation_density_score: float = Field(default=0.0, ge=0, le=1)
    internal_consistency_score: float = Field(default=0.0, ge=0, le=1)
    retry_count: int = 0

    @field_validator("mece_score", "citation_density_score", "internal_consistency_score", mode="before")
    @classmethod
    def normalize_scores(cls, value: float | int | None) -> float:
        return _normalize_unit_interval(value)


class SoWhatCallout(BaseModel):
    framework: str
    implication: str
    recommended_action: str
    risk_of_inaction: str
    exhibit_number: int


class ExhibitMetadata(BaseModel):
    exhibit_number: int
    exhibit_title: str
    framework: str
    agent_author: str
    source_note: str
    chart_type: str


class FrameworkOutput(BaseModel):
    framework_name: FrameworkName
    agent_author: AgentName
    structured_data: dict[str, Any]
    narrative: str
    citations: list[Citation] = Field(default_factory=list)
    confidence_score: float = Field(default=0.0, ge=0, le=1)
    exhibit_number: int = 0
    exhibit_title: str = ""
    implication: str = ""
    recommended_action: str = ""
    risk_of_inaction: str = ""

    @field_validator("confidence_score", mode="before")
    @classmethod
    def normalize_confidence(cls, value: float | int | None) -> float:
        return _normalize_unit_interval(value)


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

    @field_validator("feasibility_score", "risk_score", mode="before")
    @classmethod
    def normalize_scores(cls, value: float | int | None) -> float:
        return _normalize_unit_interval(value)


class StrategicOptionsOutput(BaseModel):
    ansoff_quadrant: str
    strategic_options: list[StrategicOption] = Field(default_factory=list)
    blue_ocean_factors: dict[str, list[str]]
    mckinsey_7s_fit_score: float = Field(ge=0, le=1)
    recommended_option: str
    option_rationale: str
    framework_outputs: dict[str, FrameworkOutput] = Field(default_factory=dict)

    @field_validator("mckinsey_7s_fit_score", mode="before")
    @classmethod
    def normalize_fit_score(cls, value: float | int | None) -> float:
        return _normalize_unit_interval(value)


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


class ExecutiveSummary(BaseModel):
    headline: str
    key_argument_1: str
    key_argument_2: str
    key_argument_3: str
    critical_risk: str
    next_step: str


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
    decision_evidence: list[str] = Field(default_factory=list)
    framework_outputs: dict[str, FrameworkOutput]
    executive_summary: ExecutiveSummary
    section_action_titles: dict[str, str] = Field(default_factory=dict)
    so_what_callouts: dict[str, SoWhatCallout] = Field(default_factory=dict)
    agent_collaboration_trace: list[AgentCollaborationEvent] = Field(default_factory=list)
    exhibit_registry: list[ExhibitMetadata] = Field(default_factory=list)
    implementation_roadmap: list[RoadmapItem] = Field(default_factory=list)
    quality_report: QualityReport
    mece_score: float = Field(default=0.0, ge=0, le=1)
    internal_consistency_score: float = Field(default=0.0, ge=0, le=1)
    report_metadata: ReportMetadata
    balanced_scorecard: BalancedScorecardOutput
    overall_confidence: float = Field(default=0.0, ge=0, le=1)
    board_narrative: str
    recommendation: str
    frameworks_applied: list[str]
    context: dict[str, Any]
    market_analysis: dict[str, Any]
    financial_analysis: dict[str, Any]
    risk_analysis: dict[str, Any]
    red_team: dict[str, Any]
    verification: dict[str, Any] | str
    roadmap: list[RoadmapItem] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)

    @field_validator("decision_statement")
    @classmethod
    def validate_decision_statement(cls, value: str) -> str:
        normalized = value.strip()
        allowed_prefixes = ("PROCEED", "CONDITIONAL PROCEED", "DO NOT PROCEED")
        if not normalized.startswith(allowed_prefixes):
            raise ValueError("decision_statement must begin with PROCEED, CONDITIONAL PROCEED, or DO NOT PROCEED")
        return normalized

    @field_validator("decision_confidence", "overall_confidence", "mece_score", "internal_consistency_score", mode="before")
    @classmethod
    def normalize_scores(cls, value: float | int | None) -> float:
        return _normalize_unit_interval(value)

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

    @field_validator("decision_confidence", mode="before")
    @classmethod
    def normalize_confidence(cls, value: float | int | None) -> float:
        return _normalize_unit_interval(value)


class FrameworkOutputsResponse(BaseModel):
    framework_outputs: dict[str, FrameworkOutput]


class CollaborationTraceResponse(BaseModel):
    agent_collaboration_trace: list[AgentCollaborationEvent] = Field(default_factory=list)


class PdfStatusResponse(BaseModel):
    status: str
    progress: int = Field(ge=0, le=100)
    error: str | None = None
