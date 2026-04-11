from __future__ import annotations

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations
from asis.backend.agents.types import PipelineState


class StrategistAgent(BaseAgent):
    agent_id = "strategist"
    agent_name = "Strategist"
    framework = "Minto Pyramid + MECE decomposition"

    def local_result(self, state: PipelineState) -> dict:
        context = state.get("extracted_context") or {}
        company = context.get("company_name") or "the organisation"
        sector = context.get("sector") or "the target sector"
        geography = context.get("geography") or "the target geography"
        decision = context.get("decision_type") or "strategic move"
        decomposition = [
            f"Market attractiveness for {sector} in {geography}.",
            f"Right-to-win and execution fit for {company}.",
            f"Downside risk and governance requirements before the {decision} decision.",
        ]
        hypotheses = [
            f"{company} can outperform if execution is phased and risk-controlled.",
            f"Regulatory and talent constraints will decide speed-to-value more than raw market demand.",
            "Financial upside is real only if adoption and margin assumptions survive adversarial challenge.",
        ]
        return {
            "problem_decomposition": decomposition,
            "key_hypotheses": hypotheses,
            "workstreams": [
                {"name": "Market & competition", "owner": "Market Intel"},
                {"name": "Financial return case", "owner": "Quant"},
                {"name": "Enterprise risk register", "owner": "Risk"},
            ],
            "confidence_score": calculate_confidence(query=state["query"], context=context, evidence_bonus=5),
            "citations": build_citations(context),
        }
