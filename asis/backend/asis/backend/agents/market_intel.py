from __future__ import annotations

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations, infer_sector_key
from asis.backend.agents.types import PipelineState


class MarketIntelAgent(BaseAgent):
    agent_id = "market_intel"
    agent_name = "Market Intelligence"
    framework = "PESTLE + Porter's Five Forces"

    def local_result(self, state: PipelineState) -> dict:
        context = state.get("extracted_context") or {}
        sector_key = infer_sector_key(context)
        competitors = {
            "financial": ["HDFC Bank", "ICICI Bank", "Axis Bank"],
            "consulting": ["PwC India", "EY India", "KPMG India"],
            "technology": ["Infosys", "TCS", "Wipro"],
        }.get(sector_key or "", ["Regional incumbents", "Global challengers", "Digital natives"])
        forces = [
            {"dimension": "Supplier Power", "organisation": 48, "industry_avg": 56, "leader": 44, "rationale": "Critical vendors remain concentrated."},
            {"dimension": "Buyer Power", "organisation": 63, "industry_avg": 59, "leader": 55, "rationale": "Enterprise buyers can negotiate on timeline and bundle scope."},
            {"dimension": "Competitive Rivalry", "organisation": 71, "industry_avg": 68, "leader": 62, "rationale": "Incumbents and specialists both defend share aggressively."},
            {"dimension": "Substitution", "organisation": 44, "industry_avg": 47, "leader": 39, "rationale": "Substitutes exist but switching is not frictionless."},
            {"dimension": "New Entry", "organisation": 52, "industry_avg": 57, "leader": 46, "rationale": "Regulatory and distribution barriers limit casual entry."},
        ]
        benchmark = [
            {"dimension": "Governance Maturity", "our_score": 64, "industry_avg": 59, "leader_score": 76, "leader_name": competitors[0]},
            {"dimension": "Speed to Launch", "our_score": 58, "industry_avg": 54, "leader_score": 73, "leader_name": competitors[1]},
            {"dimension": "Partner Ecosystem", "our_score": 61, "industry_avg": 56, "leader_score": 78, "leader_name": competitors[2]},
        ]
        return {
            "market_size_summary": {
                "headline": f"{context.get('geography') or 'Target'} demand remains attractive if the entry thesis is differentiated.",
                "growth_rate": "11-14% CAGR",
                "regulatory_landscape": "Moderately intensive with increasing supervision on data, conduct and resilience.",
            },
            "porter_five_forces": forces,
            "competitor_benchmarks": benchmark,
            "named_competitors": competitors,
            "confidence_score": calculate_confidence(query=state["query"], context=context, evidence_bonus=8),
            "citations": build_citations(context),
        }
