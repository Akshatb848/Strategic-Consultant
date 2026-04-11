from __future__ import annotations

from asis.backend.agents.base import BaseAgent
from asis.backend.agents.references import build_citations
from asis.backend.agents.types import PipelineState


class CoVeAgent(BaseAgent):
    agent_id = "cove"
    agent_name = "CoVe"
    framework = "Chain-of-Verification"

    def local_result(self, state: PipelineState) -> dict:
        context = state.get("extracted_context") or {}
        strategist = state.get("strategist_confidence", 60.0)
        market = state.get("market_intel_confidence", 60.0)
        risk = state.get("risk_confidence", 60.0)
        red_team = state.get("red_team_confidence", 60.0)
        quant = state.get("quant_confidence", 60.0)
        ethicist = state.get("ethicist_confidence", 60.0)
        weighted = round(
            strategist * 0.10
            + market * 0.20
            + risk * 0.25
            + red_team * 0.15
            + quant * 0.20
            + ethicist * 0.10
        )
        invalidated = (state.get("red_team_output") or {}).get("invalidated_claims") or []
        fatal_count = sum(1 for item in invalidated if item["severity"] == "Fatal")
        major_count = sum(1 for item in invalidated if item["severity"] == "Major")
        adjustment = 0
        confidences = [strategist, market, risk, red_team, quant, ethicist]
        if all(score >= 75 for score in confidences):
            adjustment += 3
        if any(score < 65 for score in confidences):
            adjustment -= 5
        if fatal_count:
            adjustment -= 8
        if major_count >= 2:
            adjustment -= 3
        if context.get("company_name") and context.get("sector") and context.get("geography"):
            adjustment += 2
        word_count = len(state.get("query", "").split())
        if word_count >= 14:
            adjustment += 2
        elif word_count >= 10:
            adjustment += 1
        decision_type = context.get("decision_type")
        if decision_type == "restructure":
            adjustment += 1
        elif decision_type == "acquire":
            adjustment -= 1
        final_confidence = max(52, min(94, weighted + adjustment))
        if final_confidence == 85:
            final_confidence = 84 if fatal_count else 86
        route_back_to = None
        recommendation = "PASS"
        flagged_claims = []
        corrections = []
        has_complete_context = bool(context.get("company_name") and context.get("sector") and context.get("geography"))
        if fatal_count and state.get("self_correction_count", 0) < 2 and not has_complete_context:
            route_back_to = "market_intel"
            recommendation = "FAIL_ROUTE_BACK"
            flagged_claims.append(
                {
                    "claim": invalidated[0]["original_claim"],
                    "issue": invalidated[0]["invalidation_reason"],
                    "severity": invalidated[0]["severity"],
                    "correction_applied": False,
                }
            )
        elif fatal_count or major_count:
            recommendation = "CONDITIONAL_PASS"
            corrections.append(
                {
                    "original": "Full value capture by year two",
                    "corrected": "Value capture phased across years two and three",
                    "reason": "Red Team challenged implementation timing assumptions.",
                    "agent_affected": "quant",
                }
            )
        return {
            "verification_checks": [
                {
                    "claim": "The strategy is specific enough for board review.",
                    "source_agent": "strategist",
                    "verified": bool(context.get("company_name") and context.get("sector") and context.get("geography")),
                    "evidence": "Specificity improves when company, sector and geography are named.",
                    "industry_benchmark": "Board-ready cases usually anchor all three context fields.",
                },
                {
                    "claim": "Financial upside reflects staged execution risk.",
                    "source_agent": "quant",
                    "verified": major_count == 0,
                    "evidence": "Quant downside should reflect implementation and regulatory drag.",
                    "industry_benchmark": "Transformation programmes rarely realise full value at original speed.",
                },
            ],
            "logic_consistent": fatal_count == 0,
            "flagged_claims": flagged_claims,
            "self_corrections_applied": corrections,
            "overall_verification_score": final_confidence,
            "recommendation": recommendation,
            "route_back_to": route_back_to,
            "final_confidence_adjustment": adjustment,
            "confidence_score": final_confidence,
            "citations": build_citations(context),
        }
