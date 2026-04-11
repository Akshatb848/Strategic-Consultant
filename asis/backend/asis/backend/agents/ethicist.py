from __future__ import annotations

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations
from asis.backend.agents.types import PipelineState


class EthicistAgent(BaseAgent):
    agent_id = "ethicist"
    agent_name = "Ethicist"
    framework = "ESG + brand guardrails"

    def local_result(self, state: PipelineState) -> dict:
        context = state.get("extracted_context") or {}
        return {
            "stakeholder_impacts": [
                {"stakeholder": "Customers", "impact": "Higher trust if controls and transparency are explicit."},
                {"stakeholder": "Employees", "impact": "Transformation fatigue risk requires visible change leadership."},
                {"stakeholder": "Regulators", "impact": "Expect evidence of governance, accountability and explainability."},
            ],
            "brand_guardrails": [
                "Do not position speed ahead of trust.",
                "Publish clear decision-rights for escalations and incident handling.",
                "Measure customer fairness and operational resilience as board KPIs.",
            ],
            "confidence_score": calculate_confidence(query=state["query"], context=context, evidence_bonus=3),
            "citations": build_citations(context),
        }
