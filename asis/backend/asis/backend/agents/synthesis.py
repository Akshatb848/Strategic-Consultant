from __future__ import annotations

from asis.backend.agents.base import BaseAgent
from asis.backend.agents.references import build_citations
from asis.backend.agents.types import PipelineState


class SynthesisAgent(BaseAgent):
    agent_id = "synthesis"
    agent_name = "Synthesis"
    framework = "Balanced Scorecard + McKinsey 7-S"

    def local_result(self, state: PipelineState) -> dict:
        context = state.get("extracted_context") or {}
        confidence = state.get("overall_confidence") or state.get("cove_confidence") or 68.0
        market = state.get("market_intel_output") or {}
        quant = state.get("quant_output") or {}
        risk = state.get("risk_output") or {}
        red_team = state.get("red_team_output") or {}
        ethicist = state.get("ethicist_output") or {}
        verification = state.get("cove_output") or {}
        invalidated_claims = red_team.get("invalidated_claims") or []
        fatal_count = sum(1 for item in invalidated_claims if item.get("severity") == "Fatal")
        verification_status = verification.get("recommendation")
        if fatal_count >= 2 or confidence < 58:
            recommendation = "REJECT"
        elif verification_status == "FAIL_ROUTE_BACK" or fatal_count >= 1 or confidence < 68:
            recommendation = "ESCALATE"
        elif verification_status == "CONDITIONAL_PASS" or confidence < 82:
            recommendation = "HOLD"
        else:
            recommendation = "PROCEED"
        citations = build_citations(context, limit=5)
        scenarios = quant.get("investment_scenarios") or []
        preferred_scenario = scenarios[1] if len(scenarios) > 1 else (scenarios[0] if scenarios else {})
        balanced_scorecard = {
            "financial": {
                "kpi": "3-year NPV",
                "baseline": "$0M",
                "target": preferred_scenario.get("npv_3yr", "Board validation required"),
                "timeline": "36 months",
            },
            "customer": {
                "kpi": "Client trust score",
                "baseline": "72",
                "target": "82",
                "timeline": "18 months",
            },
            "internal_process": {
                "kpi": "Controlled launch readiness",
                "baseline": "0%",
                "target": "95%",
                "timeline": "12 months",
            },
            "learning_growth": {
                "kpi": "Critical talent retention",
                "baseline": "86%",
                "target": "92%",
                "timeline": "12 months",
            },
        }
        balanced_scorecard_legacy = [
            {"dimension": "Financial Perspective", **balanced_scorecard["financial"]},
            {"dimension": "Customer Perspective", **balanced_scorecard["customer"]},
            {"dimension": "Internal Process", **balanced_scorecard["internal_process"]},
            {"dimension": "Learning & Growth", **balanced_scorecard["learning_growth"]},
        ]
        roadmap = [
            {
                "phase": "Phase 1",
                "timeline": "0-6 months",
                "focus": "Validation & governance readiness",
                "focus_area": "Validation & governance readiness",
                "investment": scenarios[0].get("capex") if scenarios else "TBD",
                "success_metric": "Board gates passed with risk controls embedded",
                "key_actions": [
                    {"action": "Validate operating model and target segment", "owner": "COO", "deadline": "Month 2"},
                    {"action": "Complete governance, compliance, and partner sign-off", "owner": "Chief Risk Officer", "deadline": "Month 3"},
                    {"action": "Approve phased investment envelope", "owner": "CFO", "deadline": "Month 4"},
                ],
            },
            {
                "phase": "Phase 2",
                "timeline": "6-18 months",
                "focus": "Entry & controlled scale-up",
                "focus_area": "Entry & controlled scale-up",
                "investment": preferred_scenario.get("capex", "TBD"),
                "success_metric": "Revenue, adoption, and trust KPIs inflect positively",
                "key_actions": [
                    {"action": "Launch partner-led offer in priority segments", "owner": "Chief Revenue Officer", "deadline": "Month 9"},
                    {"action": "Instrument trust, resilience, and margin KPIs", "owner": "Strategy Office", "deadline": "Month 10"},
                    {"action": "Retain critical execution talent", "owner": "CHRO", "deadline": "Month 12"},
                ],
            },
            {
                "phase": "Phase 3",
                "timeline": "18-36 months",
                "focus": "Optimisation & defensible moat",
                "focus_area": "Optimisation & defensible moat",
                "investment": scenarios[2].get("capex") if len(scenarios) > 2 else preferred_scenario.get("capex", "TBD"),
                "success_metric": "Scaled economics and strategic differentiation become durable",
                "key_actions": [
                    {"action": "Expand into adjacent segments where the model proves resilient", "owner": "CEO", "deadline": "Month 24"},
                    {"action": "Deepen ecosystem leverage and operating efficiency", "owner": "Chief Strategy Officer", "deadline": "Month 30"},
                ],
            },
        ]
        strategic_imperatives = [
            "Phase capital deployment instead of funding a full-scale launch upfront.",
            "Make governance and trust metrics first-class board measures, not compliance afterthoughts.",
            "Use partnerships to compress time-to-trust while preserving strategic flexibility.",
        ]
        executive_summary = (
            f"{context.get('company_name') or 'The organisation'} should {recommendation.lower()} on the current strategic question, "
            "with the final verdict shaped by the balance between market attractiveness, phased economics, and the control burden required to execute responsibly."
        )
        return {
            "executive_summary": executive_summary,
            "board_narrative": "The board should back only the pace of execution that the control environment, partner model, and leadership bench can genuinely sustain.",
            "recommendation": recommendation,
            "overall_confidence": confidence,
            "strategic_imperatives": strategic_imperatives,
            "frameworks_applied": [
                "Minto Pyramid",
                "PESTLE",
                "Porter's Five Forces",
                "COSO ERM",
                "Monte Carlo",
                "Balanced Scorecard",
                "SWOT",
                "Ansoff Matrix",
                "BCG Matrix",
                "Blue Ocean Strategy",
                "Chain-of-Verification",
            ],
            "context": context,
            "market_analysis": market,
            "financial_analysis": quant,
            "risk_analysis": risk,
            "red_team": red_team,
            "verification": {
                **verification,
                "logic_consistency": verification.get("logic_consistent"),
                "confidence_adjustment": verification.get("final_confidence_adjustment"),
                "final_label": recommendation,
            },
            "roadmap": roadmap,
            "balanced_scorecard": balanced_scorecard,
            "balanced_scorecard_legacy": balanced_scorecard_legacy,
            "competitive_benchmarks": market.get("competitor_benchmarks") or [],
            "ethics": ethicist,
            "citations": citations,
            "confidence_score": confidence,
        }
