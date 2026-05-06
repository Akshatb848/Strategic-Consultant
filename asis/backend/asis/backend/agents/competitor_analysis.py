from __future__ import annotations

import json

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations
from asis.backend.agents.v4_support import build_framework_output
from asis.backend.graph.context import extract_query_facts
from asis.backend.schemas.v4 import AgentName, FrameworkName


class CompetitorAnalysisAgent(BaseAgent):
    agent_id = "competitor_analysis"
    agent_name = "Competitor Analysis"
    framework = "Porter's Five Forces + competitor profiling"

    def system_prompt(self) -> str:
        return """You are the Competitor Analysis agent for ASIS v4.0.
Profile the key competitors and assess competitive dynamics for the target market.
Return a JSON patch enriching the precomputed scaffold. JSON only, no markdown.

Required patch shape:
{
  "competitor_profiles": [
    {
      "name": "<real company name>",
      "market_share": "<e.g. 28%>",
      "key_strengths": ["<specific strength>", "..."],
      "key_weaknesses": ["<specific weakness>"],
      "strategic_posture": "<e.g. Defend core; Aggressive expansion; Premium niche>"
    }
  ],
  "top_competitors": ["<name1>", "<name2>", "<name3>"],
  "competitive_positioning_insight": "<one paragraph on competitive dynamics and differentiation whitespace>",
  "confidence_score": <float 0.5-0.95>
}

Rules:
- Name REAL competitors active in this sector and geography — do not use placeholders
- At least 3 competitor profiles required
- key_strengths and key_weaknesses must be specific and distinct per competitor
- strategic_posture must be a concrete description of their current competitive behaviour
- competitive_positioning_insight must identify WHERE the company can differentiate"""

    def user_prompt(self, state) -> str:
        ctx = state.get("extracted_context") or state.get("company_context") or {}
        orch = state.get("orchestrator_output") or {}
        summary = {
            "company": ctx.get("company_name"),
            "sector": ctx.get("sector"),
            "geography": ctx.get("geography"),
            "decision_type": ctx.get("decision_type"),
            "priority_lenses": orch.get("priority_lenses", []),
        }
        return (
            f"Strategic question:\n{state['query']}\n\n"
            f"Context:\n{json.dumps(summary, ensure_ascii=False)}\n\n"
            "Identify and profile the real competitors in this market. Return the JSON patch."
        )

    def merge_generated_output(self, scaffold: dict, generated: dict) -> dict:
        merged = super().merge_generated_output(scaffold, generated)
        scaffold_names = [item.get("name") for item in scaffold.get("competitor_profiles", []) if item.get("name")]
        if scaffold_names and scaffold_names != ["Incumbent Leader", "Digital Challenger", "Global Specialist"]:
            merged["competitor_profiles"] = scaffold["competitor_profiles"]
            merged["top_competitors"] = scaffold_names
            structured = merged.get("framework_outputs", {}).get("porters_five_forces", {}).get("structured_data", {})
            if isinstance(structured.get("competitive_rivalry"), dict):
                structured["competitive_rivalry"]["key_players"] = scaffold_names
        return merged

    def local_result(self, state) -> dict:
        context = state.get("extracted_context") or {}
        sector = context.get("sector") or "the sector"
        geography = context.get("geography") or "the target market"
        citations = build_citations(context)
        confidence = calculate_confidence(query=state["query"], context=context, evidence_bonus=8) / 100
        facts = extract_query_facts(state["query"])
        named_competitors = context.get("named_competitors") or facts.get("named_competitors") or []
        competitors = self._competitor_profiles(named_competitors)
        structured = {
            "competitive_rivalry": {
                "score": 8 if named_competitors else 7,
                "rationale": f"{sector} rivalry in {geography} is active and capability-led; the named comparison set requires explicit differentiation, not archetype benchmarking.",
                "key_players": [item["name"] for item in competitors],
            },
            "threat_of_new_entrants": {"score": 4, "rationale": "Trust, distribution, and compliance create meaningful entry barriers.", "barriers": ["regulation", "capital intensity", "partner ecosystem"]},
            "threat_of_substitutes": {"score": 6 if "proprietary_ai_platform" in facts.get("strategic_themes", []) else 5, "rationale": "Internal build, hyperscaler platforms, and rival consulting AI assets can substitute for a weakly differentiated services offer.", "substitutes": ["internal build", "hyperscaler AI platforms", "rival consulting AI tools"]},
            "bargaining_power_buyers": {"score": 6, "rationale": "Sophisticated buyers can bundle scope and negotiate on risk transfer.", "factors": ["procurement leverage", "switching optionality", "multi-vendor sourcing"]},
            "bargaining_power_suppliers": {"score": 4, "rationale": "Supplier concentration exists but is manageable with a phased architecture.", "factors": ["data providers", "cloud partners", "specialist talent"]},
            "overall_attractiveness": 5,
            "strategic_implication": "A differentiated thesis is credible only if it proves why named rivals cannot match the same data, workflow, and delivery assets quickly.",
        }
        framework = build_framework_output(
            framework_name=FrameworkName.PORTERS_FIVE_FORCES,
            agent_author=AgentName.COMPETITOR_ANALYSIS,
            structured_data=structured,
            narrative="Competitive intensity is meaningful but not prohibitive; the decisive issue is whether the company can separate from the named rival set with proprietary data, workflow IP, and delivery economics that buyers can verify.",
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

    def _competitor_profiles(self, named_competitors: list[str]) -> list[dict]:
        if named_competitors:
            return [self._named_profile(name, index) for index, name in enumerate(named_competitors[:4])]
        return [
            {"name": "Incumbent Leader", "market_share": "32%", "key_strengths": ["distribution reach", "brand trust"], "key_weaknesses": ["slower innovation cadence"], "strategic_posture": "Defend core segments"},
            {"name": "Digital Challenger", "market_share": "18%", "key_strengths": ["digital experience", "lower cost base"], "key_weaknesses": ["weaker enterprise controls"], "strategic_posture": "Aggressive share capture"},
            {"name": "Global Specialist", "market_share": "12%", "key_strengths": ["sector expertise", "premium positioning"], "key_weaknesses": ["higher price point"], "strategic_posture": "Selective high-value expansion"},
        ]

    def _named_profile(self, name: str, index: int) -> dict:
        lower = name.lower()
        if "mckinsey" in lower:
            return {
                "name": "McKinsey & Company",
                "market_share": "Named benchmark",
                "key_strengths": ["CEO-level access", "McKinsey Digital and QuantumBlack depth", "scaled knowledge assets"],
                "key_weaknesses": ["premium economics", "client concerns on reusable IP ownership"],
                "strategic_posture": "Defend enterprise AI transformation leadership",
            }
        if "boston" in lower or lower == "bcg":
            return {
                "name": "Boston Consulting Group",
                "market_share": "Named benchmark",
                "key_strengths": ["BCG X digital build capability", "venture and product-building muscle", "analytics talent depth"],
                "key_weaknesses": ["coordination complexity across advisory and build teams"],
                "strategic_posture": "Attack AI-enabled transformation and digital venture work",
            }
        if "accenture" in lower:
            return {
                "name": "Accenture",
                "market_share": "Named benchmark",
                "key_strengths": ["technology delivery scale", "managed services depth", "cloud ecosystem access"],
                "key_weaknesses": ["less distinctive board-strategy positioning in premium cases"],
                "strategic_posture": "Scale AI delivery and platform operations",
            }
        return {
            "name": name,
            "market_share": "Named benchmark" if index < 3 else "Secondary benchmark",
            "key_strengths": ["client access", "specialist capability", "brand credibility"],
            "key_weaknesses": ["uncertain differentiation versus proprietary platform strategy"],
            "strategic_posture": "Defend strategic accounts and high-value transformation work",
        }
