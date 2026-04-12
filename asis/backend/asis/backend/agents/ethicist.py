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
        stakeholder_impacts = [
            {"stakeholder": "Customers", "impact": "Higher trust if controls and transparency are explicit."},
            {"stakeholder": "Employees", "impact": "Transformation fatigue risk requires visible change leadership."},
            {"stakeholder": "Regulators", "impact": "Expect evidence of governance, accountability and explainability."},
        ]
        return {
            "stakeholder_impacts": stakeholder_impacts,
            "brand_guardrails": [
                "Do not position speed ahead of trust.",
                "Publish clear decision-rights for escalations and incident handling.",
                "Measure customer fairness and operational resilience as board KPIs.",
            ],
            "brand_risk_assessment": "Brand upside is meaningful if governance is visible; reputational downside rises sharply if growth messaging outpaces control maturity.",
            "esg_implications": [
                "Governance quality is the primary ESG differentiator in this decision.",
                "Stakeholder trust improves when resilience, transparency, and accountability are explicit in the rollout plan.",
            ],
            "cultural_fit_score": 7,
            "regulatory_ethics_flags": [
                "Ensure accountability and escalation paths are clear before launch.",
                "Avoid claims about trust or fairness that are not backed by measurable controls.",
            ],
            "stakeholder_impact": [
                {"impact_type": "customer_trust", "description": "Transparent controls increase buyer confidence.", "severity": "Medium"},
                {"impact_type": "employee_fatigue", "description": "Transformation pressure can dilute adoption without visible leadership.", "severity": "Medium"},
                {"impact_type": "regulatory_scrutiny", "description": "Governance weaknesses can quickly become public trust issues.", "severity": "High"},
            ],
            "recommendation": "Proceed only with explicit ethics guardrails and board-level ownership of trust metrics.",
            "conditions": [
                "Define escalation rights before launch.",
                "Track fairness, resilience, and trust as board metrics.",
                "Avoid positioning that implies certainty beyond the evidence base.",
            ],
            "confidence_score": calculate_confidence(query=state["query"], context=context, evidence_bonus=3),
            "citations": build_citations(context),
        }
