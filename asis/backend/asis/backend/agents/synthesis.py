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
        recommendation = "PROCEED" if confidence >= 80 else "HOLD" if confidence >= 65 else "ESCALATE"
        market = state.get("market_intel_output") or {}
        quant = state.get("quant_output") or {}
        risk = state.get("risk_output") or {}
        red_team = state.get("red_team_output") or {}
        ethicist = state.get("ethicist_output") or {}
        verification = state.get("cove_output") or {}
        citations = build_citations(context, limit=5)
        balanced_scorecard = [
            {"dimension": "Financial Perspective", "kpi": "3-year NPV", "baseline": "$0M", "target": quant["investment_scenarios"][1]["npv_3yr"], "timeline": "36 months"},
            {"dimension": "Customer Perspective", "kpi": "Client trust score", "baseline": "72", "target": "82", "timeline": "18 months"},
            {"dimension": "Internal Process", "kpi": "Controlled launch readiness", "baseline": "0%", "target": "95%", "timeline": "12 months"},
            {"dimension": "Learning & Growth", "kpi": "Critical talent retention", "baseline": "86%", "target": "92%", "timeline": "12 months"},
        ]
        roadmap = [
            {"phase": "Phase 1", "timeline": "0-12 months", "focus_area": "Foundation", "investment": quant["investment_scenarios"][0]["capex"], "success_metric": "Risk controls embedded", "key_actions": [{"action": "Validate operating model", "owner": "COO", "deadline": "Q2"}, {"action": "Board approval gates", "owner": "CFO", "deadline": "Q2"}]},
            {"phase": "Phase 2", "timeline": "12-30 months", "focus_area": "Scaled execution", "investment": quant["investment_scenarios"][1]["capex"], "success_metric": "Revenue and adoption inflect", "key_actions": [{"action": "Scale go-to-market", "owner": "Chief Revenue Officer", "deadline": "Q6"}, {"action": "Expand partner network", "owner": "Strategy Office", "deadline": "Q7"}]},
            {"phase": "Phase 3", "timeline": "30-60 months", "focus_area": "Market leadership", "investment": quant["investment_scenarios"][2]["capex"], "success_metric": "Sustainable moat", "key_actions": [{"action": "Optimise portfolio mix", "owner": "CEO", "deadline": "Q12"}]},
        ]
        return {
            "executive_summary": f"{context.get('company_name') or 'The organisation'} should {recommendation.lower()} with a phased investment thesis that balances growth with governance and talent resilience.",
            "board_narrative": "Proceed only at the pace your control environment, talent bench and regulatory posture can genuinely sustain.",
            "recommendation": recommendation,
            "overall_confidence": confidence,
            "frameworks_applied": [
                "Minto Pyramid",
                "PESTLE",
                "Porter's Five Forces",
                "COSO ERM",
                "Monte Carlo",
                "Chain-of-Verification",
            ],
            "context": context,
            "market_analysis": market,
            "financial_analysis": quant,
            "risk_analysis": risk,
            "red_team": red_team,
            "verification": verification,
            "roadmap": roadmap,
            "balanced_scorecard": balanced_scorecard,
            "ethics": ethicist,
            "citations": citations,
            "confidence_score": confidence,
        }
