from __future__ import annotations

from typing import Annotated, Any
from typing_extensions import TypedDict


def merge_dicts(left: dict[str, Any] | None, right: dict[str, Any] | None) -> dict[str, Any]:
    merged = dict(left or {})
    merged.update(right or {})
    return merged


def merge_citation_dicts(
    left: dict[str, list[dict[str, Any]]] | None,
    right: dict[str, list[dict[str, Any]]] | None,
) -> dict[str, list[dict[str, Any]]]:
    merged: dict[str, list[dict[str, Any]]] = {key: list(value) for key, value in (left or {}).items()}
    for framework, citations in (right or {}).items():
        existing = merged.setdefault(framework, [])
        seen = {(str(item.get("title")), str(item.get("url"))) for item in existing}
        for citation in citations or []:
            key = (str(citation.get("title")), str(citation.get("url")))
            if key in seen:
                continue
            seen.add(key)
            existing.append(citation)
    return merged


def merge_list_items(left: list[dict[str, Any]] | None, right: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    return [*(left or []), *(right or [])]


class V4PipelineState(TypedDict, total=False):
    analysis_id: str
    user_id: str
    query: str
    company_context: dict[str, Any]
    extracted_context: dict[str, Any]
    orchestrator_output: dict[str, Any]
    market_intel_output: dict[str, Any]
    market_intel_confidence: float
    risk_assessment_output: dict[str, Any]
    risk_assessment_confidence: float
    competitor_analysis_output: dict[str, Any]
    competitor_analysis_confidence: float
    geo_intel_output: dict[str, Any]
    geo_intel_confidence: float
    financial_reasoning_output: dict[str, Any]
    financial_reasoning_confidence: float
    strategic_options_output: dict[str, Any]
    strategic_options_confidence: float
    synthesis_output: dict[str, Any]
    framework_outputs: Annotated[dict[str, dict[str, Any]], merge_dicts]
    framework_citations: Annotated[dict[str, list[dict[str, Any]]], merge_citation_dicts]
    agent_collaboration_trace: Annotated[list[dict[str, Any]], merge_list_items]
    decision_statement: str
    decision_confidence: float
    decision_rationale: str
    decision_evidence: list[str]
    mece_score: float
    internal_consistency_score: float
    quality_report: dict[str, Any]
    quality_retry_count: int
    quality_failures: list[str]
    section_action_titles: Annotated[dict[str, str], merge_dicts]
    so_what_callouts: Annotated[dict[str, dict[str, Any]], merge_dicts]
    exhibit_registry: Annotated[list[dict[str, Any]], merge_list_items]
    overall_confidence: float
    started_at: float
