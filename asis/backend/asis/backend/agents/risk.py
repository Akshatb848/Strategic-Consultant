from __future__ import annotations

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations
from asis.backend.agents.types import PipelineState


LIKELIHOOD_MAP = {"Low": 2, "Medium": 4, "High": 6}
IMPACT_MAP = {"Low": 2, "Medium": 4, "High": 5, "Critical": 6}
VELOCITY_MAP = {"Slow": 2, "Moderate": 4, "Fast": 6}


def _severity(likelihood: str, impact: str, velocity: str) -> int:
    raw = (LIKELIHOOD_MAP[likelihood] * IMPACT_MAP[impact] * VELOCITY_MAP[velocity]) / 36 * 100
    return max(25, min(100, round(raw)))


class RiskAgent(BaseAgent):
    agent_id = "risk"
    agent_name = "Risk"
    framework = "COSO ERM + NIST CSF"

    def local_result(self, state: PipelineState) -> dict:
        context = state.get("extracted_context") or {}
        items = [
            ("R01", "Regulatory approval or compliance drag", "Regulatory", "High", "Critical", "Moderate", "Chief Risk Officer"),
            ("R02", "Talent attrition during transformation", "Talent", "Medium", "High", "Fast", "CHRO"),
            ("R03", "Execution overruns on product and process redesign", "Operational", "Medium", "High", "Moderate", "COO"),
            ("R04", "Partner and third-party concentration", "Strategic", "Low", "High", "Slow", "Chief Strategy Officer"),
        ]
        register = []
        for identifier, risk, category, likelihood, impact, velocity, owner in items:
            severity = _severity(likelihood, impact, velocity)
            register.append(
                {
                    "id": identifier,
                    "risk": risk,
                    "category": category,
                    "likelihood": likelihood,
                    "impact": impact,
                    "velocity": velocity,
                    "owner": owner,
                    "current_control": "Named executive owner, phase-gate review, and control testing prior to scale-up.",
                    "mitigation": "Phase-gate investment, pre-negotiate controls, and assign named control owners.",
                    "residual_score": max(20, severity - 18),
                    "severity_score": severity,
                    "heat_map_x": LIKELIHOOD_MAP[likelihood],
                    "heat_map_y": IMPACT_MAP[impact],
                }
            )
        register.sort(key=lambda item: item["severity_score"], reverse=True)
        critical_risks = [item["risk"] for item in register if item["severity_score"] >= 60][:3]
        return {
            "risk_register": register,
            "top_strategic_risk": register[0]["risk"],
            "critical_risks": critical_risks,
            "mitigation_strategies": [
                "Stage capital deployment against explicit control and commercial gates.",
                "Assign single-threaded owners for regulatory, talent, and execution exposures.",
                "Pre-negotiate partner controls before customer-facing scale-up.",
            ],
            "residual_risk_level": "MODERATE-HIGH" if register[0]["residual_score"] >= 50 else "MODERATE",
            "risk_appetite_alignment": "Within appetite only if the board enforces phased execution and explicit stop/go triggers.",
            "framework_used": "COSO ERM + NIST CSF 2.0",
            "heat_map_data": [
                {
                    "id": item["id"],
                    "x": item["heat_map_x"],
                    "y": item["heat_map_y"],
                    "severity": item["severity_score"],
                    "label": item["risk"],
                }
                for item in register
            ],
            "board_escalation_required": True,
            "escalation_rationale": "The leading risks are manageable, but they span regulatory, talent, and execution domains that require board-sponsored gating.",
            "confidence_score": calculate_confidence(query=state["query"], context=context, evidence_bonus=6),
            "citations": build_citations(context),
        }
