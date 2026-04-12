from __future__ import annotations

from statistics import mean
from typing import Iterable

from asis.backend.agents.references import build_citations
from asis.backend.schemas.v4 import AgentName, FrameworkName


def build_framework_output(
    *,
    framework_name: FrameworkName,
    agent_author: AgentName,
    structured_data: dict,
    narrative: str,
    context: dict,
    confidence_score: float,
    citations: list[dict] | None = None,
) -> dict:
    return {
        "framework_name": framework_name.value,
        "agent_author": agent_author.value,
        "structured_data": structured_data,
        "narrative": narrative,
        "citations": citations or build_citations(context, limit=4),
        "confidence_score": round(confidence_score, 3),
    }


def average_framework_confidence(framework_outputs: dict[str, dict]) -> float:
    scores = [
        float(item.get("confidence_score", 0))
        for item in framework_outputs.values()
        if item.get("confidence_score") is not None
    ]
    return round(mean(scores), 3) if scores else 0.61


def decision_label(decision_confidence: float) -> str:
    if decision_confidence >= 0.72:
        return "PROCEED"
    if decision_confidence >= 0.55:
        return "CONDITIONAL PROCEED"
    return "DO NOT PROCEED"


def flatten_citations(groups: Iterable[list[dict] | None]) -> list[dict]:
    deduped: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for group in groups:
        for citation in group or []:
            key = (str(citation.get("title")), str(citation.get("url")))
            if key in seen:
                continue
            seen.add(key)
            deduped.append(citation)
    return deduped


def framework_key_finding(framework_output: dict) -> str:
    structured = framework_output.get("structured_data") or {}
    for key in ("key_implication", "strategic_implication", "recommendation_rationale", "blue_ocean_shift"):
        value = structured.get(key)
        if value:
            return str(value)
    return str(framework_output.get("narrative") or "Framework evidence contributed to the strategic recommendation.")
