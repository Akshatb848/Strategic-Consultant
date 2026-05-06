from __future__ import annotations

import json

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations
from asis.backend.agents.v4_support import build_framework_output
from asis.backend.schemas.v4 import AgentName, FrameworkName


class RiskAssessmentAgent(BaseAgent):
    agent_id = "risk_assessment"
    agent_name = "Risk Assessment"
    framework = "Enterprise risk register + PESTLE social/environmental"

    def system_prompt(self) -> str:
        return """You are the Risk Assessment agent for ASIS v4.0.
Build a comprehensive enterprise risk register and assess social/environmental (PESTLE S+E) exposure.
Return a JSON patch enriching the precomputed scaffold. JSON only, no markdown.

Required patch shape:
{
  "risk_register": [
    {
      "risk_id": "R1",
      "category": "Regulatory|Financial|Execution|Reputation|Strategic|ESG",
      "description": "<specific risk description for this company/decision>",
      "likelihood": <1-5>,
      "impact": <1-5>,
      "inherent_score": <likelihood * impact>,
      "mitigation": "<specific mitigation action>",
      "residual_score": <post-mitigation score>
    }
  ],
  "social_exposure": {
    "score": <1-10>,
    "factors": ["<specific social factor>", "..."],
    "citations": []
  },
  "environmental_exposure": {
    "score": <1-10>,
    "factors": ["<specific environmental factor>", "..."],
    "citations": []
  },
  "confidence_score": <float 0.5-0.95>
}

Rules:
- Include AT LEAST 5 risks covering Regulatory, Financial, Execution, Reputation, and ESG categories
- All risks must be specific to THIS company's decision context — not generic
- likelihood and impact are integers 1-5; inherent_score = likelihood × impact
- residual_score must be lower than inherent_score (mitigation reduces risk)
- Social and environmental factors must relate to the specific sector and geography"""

    def user_prompt(self, state) -> str:
        ctx = state.get("extracted_context") or state.get("company_context") or {}
        orch = state.get("orchestrator_output") or {}
        summary = {
            "company": ctx.get("company_name"),
            "sector": ctx.get("sector"),
            "geography": ctx.get("geography"),
            "decision_type": ctx.get("decision_type"),
            "annual_revenue": ctx.get("annual_revenue"),
            "priority_lenses": orch.get("priority_lenses", []),
        }
        return (
            f"Strategic question:\n{state['query']}\n\n"
            f"Context:\n{json.dumps(summary, ensure_ascii=False)}\n\n"
            "Identify all material risks for this specific decision. Return the JSON patch."
        )

    def local_result(self, state) -> dict:
        context = state.get("extracted_context") or {}
        company = context.get("company_name") or "the organisation"
        geography = context.get("geography") or "the target market"
        citations = build_citations(context)
        confidence = calculate_confidence(query=state["query"], context=context, evidence_bonus=7) / 100
        social = {
            "score": 6,
            "factors": [
                f"Customer trust expectations in {geography} are rising.",
                "Talent availability and retention remain a scaling constraint.",
                "Board scrutiny on resilience and responsible growth is intensifying.",
            ],
            "citations": citations[:2],
        }
        environmental = {
            "score": 5,
            "factors": [
                "ESG disclosures increasingly influence enterprise partnerships.",
                "Operational resilience expectations now include supply-chain sustainability.",
                "Energy and infrastructure efficiency shape medium-term margin durability.",
            ],
            "citations": citations[1:3],
        }
        risk_register = [
            {
                "risk_id": "R1",
                "category": "Regulatory",
                "description": "Approval, licensing, or supervisory delay extends time to market.",
                "likelihood": 4,
                "impact": 5,
                "inherent_score": 20,
                "mitigation": "Run pre-clearance workshops and stage entry milestones.",
                "residual_score": 12,
            },
            {
                "risk_id": "R2",
                "category": "Execution",
                "description": "Capability ramp and partner integration slow execution quality.",
                "likelihood": 3,
                "impact": 4,
                "inherent_score": 12,
                "mitigation": "Phase launch scope and assign functional owners early.",
                "residual_score": 8,
            },
            {
                "risk_id": "R3",
                "category": "Reputation",
                "description": "Customer or stakeholder trust deteriorates if controls lag growth.",
                "likelihood": 3,
                "impact": 4,
                "inherent_score": 12,
                "mitigation": "Tie rollout gates to customer-impact controls and governance.",
                "residual_score": 7,
            },
        ]
        pestle = build_framework_output(
            framework_name=FrameworkName.PESTLE,
            agent_author=AgentName.RISK_ASSESSMENT,
            structured_data={
                "political": {"score": 0, "factors": [], "citations": []},
                "economic": {"score": 0, "factors": [], "citations": []},
                "social": social,
                "technological": {"score": 0, "factors": [], "citations": []},
                "legal": {"score": 0, "factors": [], "citations": []},
                "environmental": environmental,
                "overall_score": 0,
                "key_implication": f"{company} needs a risk-gated entry model rather than a full-scale launch.",
            },
            narrative="Social licence, stakeholder expectations, and environmental resilience matter because execution credibility will be tested alongside financial returns.",
            context=context,
            confidence_score=confidence,
            citations=citations,
        )
        return {
            "risk_register": risk_register,
            "social_exposure": social,
            "environmental_exposure": environmental,
            "framework_outputs": {"pestle": pestle},
            "confidence_score": round(confidence, 3),
            "citations": citations,
        }
