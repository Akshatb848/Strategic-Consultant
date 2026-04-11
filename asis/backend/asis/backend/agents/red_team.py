from __future__ import annotations

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations
from asis.backend.agents.types import PipelineState


class RedTeamAgent(BaseAgent):
    agent_id = "red_team"
    agent_name = "Red Team"
    framework = "Pre-mortem + adversarial challenge"

    def local_result(self, state: PipelineState) -> dict:
        context = state.get("extracted_context") or {}
        quant = state.get("quant_output") or {}
        scenarios = quant.get("investment_scenarios") or []
        invalidated_claims = [
            {
                "original_claim": "Transformation benefits will land at full run-rate by year two.",
                "source_agent": "quant",
                "severity": "Major",
                "invalidation_reason": "Talent ramp and regulatory sequencing usually delay value realisation by 2-3 quarters.",
            }
        ]
        if context.get("sector") and "fin" in context["sector"].lower():
            invalidated_claims.append(
                {
                    "original_claim": "Regulatory approvals are unlikely to affect launch timing materially.",
                    "source_agent": "market_intel",
                    "severity": "Fatal",
                    "invalidation_reason": "Financial-market launches remain highly exposed to conduct, privacy and partner-compliance controls.",
                }
            )
        return {
            "pre_mortem_scenarios": [
                {"scenario": "Launch stalls after compliance review", "probability": "Medium", "financial_impact": "-18% NPV", "mitigation": "Board phase gates and control testing"},
                {"scenario": "Senior-manager attrition spikes during rollout", "probability": "Medium", "financial_impact": "-11% NPV", "mitigation": "Retention packages and phased staffing"},
            ],
            "invalidated_claims": invalidated_claims,
            "surviving_claims": [scenario["scenario"] for scenario in scenarios[:2]],
            "overall_threat_level": "HIGH" if len(invalidated_claims) > 1 else "MEDIUM",
            "red_team_verdict": "The strategy remains investable, but only if the board accepts slower value capture and tighter governance than the optimistic case suggests.",
            "confidence_score": calculate_confidence(query=state["query"], context=context, evidence_bonus=4),
            "citations": build_citations(context),
        }
