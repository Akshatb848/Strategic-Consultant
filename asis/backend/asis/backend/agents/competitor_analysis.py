from __future__ import annotations

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations
from asis.backend.agents.v4_support import build_framework_output
from asis.backend.schemas.v4 import AgentName, FrameworkName


class CompetitorAnalysisAgent(BaseAgent):
    agent_id = "competitor_analysis"
    agent_name = "Competitor Analysis"
    framework = "Porter's Five Forces + competitor profiling"

    def local_result(self, state) -> dict:
        context = state.get("extracted_context") or {}
        sector = context.get("sector") or "the sector"
        geography = context.get("geography") or "the target market"
        citations = build_citations(context)
        confidence = calculate_confidence(query=state["query"], context=context, evidence_bonus=8) / 100
        competitors = [
            {"name": "Incumbent Leader", "market_share": "32%", "key_strengths": ["distribution reach", "brand trust"], "key_weaknesses": ["slower innovation cadence"], "strategic_posture": "Defend core segments"},
            {"name": "Digital Challenger", "market_share": "18%", "key_strengths": ["digital experience", "lower cost base"], "key_weaknesses": ["weaker enterprise controls"], "strategic_posture": "Aggressive share capture"},
            {"name": "Global Specialist", "market_share": "12%", "key_strengths": ["sector expertise", "premium positioning"], "key_weaknesses": ["higher price point"], "strategic_posture": "Selective high-value expansion"},
        ]
        structured = {
            "competitive_rivalry": {"score": 7, "rationale": f"{sector} rivalry in {geography} is active and capability-led.", "key_players": [item["name"] for item in competitors]},
            "threat_of_new_entrants": {"score": 4, "rationale": "Trust, distribution, and compliance create meaningful entry barriers.", "barriers": ["regulation", "capital intensity", "partner ecosystem"]},
            "threat_of_substitutes": {"score": 5, "rationale": "Adjacent digital and service substitutes can capture segments of demand.", "substitutes": ["internal build", "adjacent fintech tools", "consulting alternatives"]},
            "bargaining_power_buyers": {"score": 6, "rationale": "Sophisticated buyers can bundle scope and negotiate on risk transfer.", "factors": ["procurement leverage", "switching optionality", "multi-vendor sourcing"]},
            "bargaining_power_suppliers": {"score": 4, "rationale": "Supplier concentration exists but is manageable with a phased architecture.", "factors": ["data providers", "cloud partners", "specialist talent"]},
            "overall_attractiveness": 5,
            "strategic_implication": "A differentiated entry thesis is more credible than a generic scale play.",
        }
        framework = build_framework_output(
            framework_name=FrameworkName.PORTERS_FIVE_FORCES,
            agent_author=AgentName.COMPETITOR_ANALYSIS,
            structured_data=structured,
            narrative="Competitive intensity is meaningful but not prohibitive; the decisive issue is whether the company can enter with differentiated control, capability, and partner advantages.",
            context=context,
            confidence_score=confidence,
            citations=citations,
        )
        return {
            "competitor_profiles": competitors,
            "top_competitors": [item["name"] for item in competitors],
            "framework_outputs": {"porters_five_forces": framework},
            "confidence_score": round(confidence, 3),
            "citations": citations,
        }
