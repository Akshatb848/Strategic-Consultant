from __future__ import annotations

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations
from asis.backend.agents.types import PipelineState


class OrchestratorAgent(BaseAgent):
    agent_id = "orchestrator"
    agent_name = "Orchestrator"
    framework = "Strategic routing"

    def local_result(self, state: PipelineState) -> dict:
        context = state.get("extracted_context") or {}
        confidence = calculate_confidence(query=state["query"], context=context, evidence_bonus=1) / 100
        return {
            "execution_plan": [
                "Orchestrator frames the question, extracts company context, and routes the v4 specialist agents.",
                "Market Intel, Risk Assessment, Competitor Analysis, and Geo Intel run in parallel with shared context.",
                "Financial Reasoning converts the combined evidence into a capital case and BCG view.",
                "Strategic Options scores the viable growth paths through Ansoff, Blue Ocean, and McKinsey 7S.",
                "Synthesis assembles the validated StrategicBriefV4, decision statement, and roadmap.",
            ],
            "priority_lenses": ["growth", "risk", "capital", "regulation", "execution"],
            "confidence_score": round(confidence, 3),
            "citations": build_citations(context, limit=3),
        }
