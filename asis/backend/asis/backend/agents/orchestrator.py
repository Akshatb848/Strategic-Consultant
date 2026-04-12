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
        company = context.get("company_name") or "The company"
        geography = context.get("geography") or "the target market"
        return {
            "execution_plan": [
                "Orchestrator frames the question, extracts company context, and routes the v4 specialist agents.",
                "Market Intel, Risk Assessment, Competitor Analysis, and Geo Intel run in parallel with shared context.",
                "Financial Reasoning converts the combined evidence into a capital case and BCG view.",
                "Strategic Options scores the viable growth paths through Ansoff, Blue Ocean, and McKinsey 7S.",
                "Synthesis assembles the validated StrategicBriefV4, decision statement, and roadmap.",
            ],
            "priority_lenses": ["growth", "risk", "capital", "regulation", "execution"],
            "query_type": context.get("decision_type") or "strategic_decision",
            "section_action_titles": {
                "executive_summary": f"{company}'s recommendation can be understood quickly because the decision, evidence, and core risk are surfaced first.",
                "methodology": "The eight-agent pipeline combines external intelligence, competitive evidence, financial logic, and strategic option design into a single board-ready brief.",
                "implementation_roadmap": f"{company} should escalate commitment only as regulatory, operating, and commercial evidence improves in {geography}.",
            },
            "confidence_score": round(confidence, 3),
            "citations": build_citations(context, limit=3),
        }
