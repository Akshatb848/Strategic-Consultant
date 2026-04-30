from __future__ import annotations

import json

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations
from asis.backend.agents.v4_support import build_framework_output
from asis.backend.schemas.v4 import AgentName, FrameworkName


class StrategicOptionsAgent(BaseAgent):
    agent_id = "strategic_options"
    agent_name = "Strategic Options"
    framework = "Ansoff Matrix + Blue Ocean + McKinsey 7S"

    def system_prompt(self) -> str:
        return """You are the Strategic Options agent for ASIS v4.0.
Score and rank strategic options using Ansoff Matrix, Blue Ocean Strategy, and McKinsey 7S.
You have access to all 5 upstream agent outputs. Return a JSON patch enriching the scaffold.
JSON only, no markdown.

Required patch shape:
{
  "ansoff_quadrant": "market_penetration|market_development|product_development|diversification",
  "strategic_options": [
    {
      "option": "<specific option name>",
      "quadrant": "<ansoff quadrant>",
      "feasibility_score": <float 0-1>,
      "risk_score": <float 0-1>,
      "rationale": "<why this option scores as it does given upstream evidence>"
    }
  ],
  "recommended_option": "<name of the top-ranked option>",
  "option_rationale": "<one paragraph justifying the recommended option using upstream evidence>",
  "blue_ocean_factors": {
    "eliminate": ["<factor to eliminate>"],
    "reduce": ["<factor to reduce>"],
    "raise": ["<factor to raise>"],
    "create": ["<new factor to create>"]
  },
  "mckinsey_7s_fit_score": <float 0-1>,
  "mckinsey_7s_gaps": ["<critical gap 1>", "<critical gap 2>"],
  "confidence_score": <float 0.5-0.95>
}

Rules:
- strategic_options list must include AT LEAST 3 options with different Ansoff quadrants
- feasibility_score must reflect financial_reasoning IRR and capital requirements
- risk_score must incorporate risk register findings
- blue_ocean factors must be specific to this company's competitive position vs named competitors
- 7S gaps must reflect the actual capabilities required for the recommended option
- option_rationale must EXPLICITLY reference data from at least 3 upstream agents"""

    def user_prompt(self, state) -> str:
        ctx = state.get("extracted_context") or state.get("company_context") or {}
        market = state.get("market_intel_output") or {}
        risk = state.get("risk_assessment_output") or {}
        comp = state.get("competitor_analysis_output") or {}
        geo = state.get("geo_intel_output") or {}
        fin = state.get("financial_reasoning_output") or {}

        upstream = {
            "recommended_ansoff": (market.get("porters_five_forces") or {}).get("strategic_implication"),
            "market_growth": (market.get("market_size_summary") or {}).get("growth_rate"),
            "top_risks": [r.get("description") for r in (risk.get("risk_register") or [])[:3]],
            "top_competitors": comp.get("top_competitors", []),
            "competitive_positioning": comp.get("competitive_positioning_insight"),
            "political_risk": geo.get("political_risk_score"),
            "cage_distance": (geo.get("cage_distance_analysis") or {}).get("key_implication"),
            "irr_base": (fin.get("scenario_analysis") or {}).get("base", {}).get("irr_pct"),
            "irr_downside": (fin.get("scenario_analysis") or {}).get("downside", {}).get("irr_pct"),
            "bcg_entry_position": next(
                (u.get("category") for u in (fin.get("business_units") or []) if "entry" in (u.get("name") or "").lower()),
                None,
            ),
        }
        company_info = {
            "company": ctx.get("company_name"),
            "sector": ctx.get("sector"),
            "geography": ctx.get("geography"),
            "decision_type": ctx.get("decision_type"),
        }
        return (
            f"Strategic question:\n{state['query']}\n\n"
            f"Company:\n{json.dumps(company_info, ensure_ascii=False)}\n\n"
            f"Upstream intelligence:\n{json.dumps(upstream, ensure_ascii=False)}\n\n"
            "Score and rank the strategic options using Ansoff, Blue Ocean, and 7S. Return the JSON patch."
        )

    def local_result(self, state) -> dict:
        context = state.get("extracted_context") or {}
        market = state.get("market_intel_output") or {}
        citations = build_citations(context)
        confidence = calculate_confidence(query=state["query"], context=context, evidence_bonus=9) / 100
        ansoff = {
            "market_penetration": {"feasibility": 0.48, "rationale": "Incumbent rivalry limits pure share-grab economics.", "initiatives": ["targeted pricing", "channel partnerships"]},
            "market_development": {"feasibility": 0.76, "rationale": "Controlled entry into a new geography is the clearest growth path.", "initiatives": ["local partner launch", "compliance-first rollout", "segment prioritisation"]},
            "product_development": {"feasibility": 0.62, "rationale": "Selective product adaptation improves fit but should follow market proof.", "initiatives": ["modular product localisation", "compliance-led feature roadmap"]},
            "diversification": {"feasibility": 0.31, "rationale": "New market plus new product stretches execution too far initially.", "initiatives": ["avoid broad diversification in phase one"]},
            "recommended_quadrant": "market_development",
            "recommendation_rationale": "The strongest option is entering the target market with a phased offer rather than widening scope across multiple unknowns.",
        }
        seven_s = {
            "strategy": {"score": 7, "current_state": "Clear growth intent exists.", "gap": "Needs phased decision gates."},
            "structure": {"score": 6, "current_state": "Central governance is strong.", "gap": "Local execution authority is underdeveloped."},
            "systems": {"score": 6, "current_state": "Core controls are present.", "gap": "Target-market operating systems need localisation."},
            "staff": {"score": 5, "current_state": "Leadership depth is credible.", "gap": "Local market talent bench is thin."},
            "style": {"score": 7, "current_state": "Decision cadence is board-supported.", "gap": "Needs faster field escalation loops."},
            "skills": {"score": 6, "current_state": "Core capabilities transfer well.", "gap": "Specialist regulatory and market-entry skills are limited."},
            "shared_values": {"score": 8, "current_state": "Risk-aware growth culture is aligned.", "gap": "Needs stronger localisation around customer trust."},
            "alignment_score": 0.64,
            "critical_gaps": ["local talent", "operating systems localisation", "field execution authority"],
        }
        blue_ocean = {
            "factors": ["price", "service quality", "compliance assurance", "partner ecosystem", "speed to launch"],
            "company_curve": {"price": 6, "service quality": 8, "compliance assurance": 9, "partner ecosystem": 7, "speed to launch": 6},
            "competitor_curves": {
                "Incumbent Leader": {"price": 5, "service quality": 7, "compliance assurance": 8, "partner ecosystem": 9, "speed to launch": 4},
                "Digital Challenger": {"price": 8, "service quality": 6, "compliance assurance": 5, "partner ecosystem": 5, "speed to launch": 9},
                "Global Specialist": {"price": 4, "service quality": 9, "compliance assurance": 8, "partner ecosystem": 6, "speed to launch": 5},
            },
            "eliminate": ["undifferentiated broad-market entry"],
            "reduce": ["front-loaded capital exposure", "non-core segment breadth"],
            "raise": ["compliance assurance", "partner-led trust signals"],
            "create": ["phased partnership launch model", "decision-gated operating blueprint"],
            "blue_ocean_shift": "Compete on trust, governance, and partner-enabled speed rather than on price alone.",
        }
        options = [
            {"option": "Phased partner-led market entry", "quadrant": "market_development", "feasibility_score": 0.76, "risk_score": 0.41, "rationale": "Best blend of growth, control, and capital efficiency."},
            {"option": "Product localisation before entry", "quadrant": "product_development", "feasibility_score": 0.62, "risk_score": 0.48, "rationale": "Useful but secondary to proving market access."},
            {"option": "Broad diversification play", "quadrant": "diversification", "feasibility_score": 0.31, "risk_score": 0.72, "rationale": "High complexity for limited early evidence."},
        ]
        framework_outputs = {
            "ansoff": build_framework_output(
                framework_name=FrameworkName.ANSOFF,
                agent_author=AgentName.STRATEGIC_OPTIONS,
                structured_data=ansoff,
                narrative="Ansoff analysis favours market development because it expands growth while keeping product and operating-model complexity within board-manageable bounds.",
                context=context,
                confidence_score=confidence,
                citations=citations,
            ),
            "mckinsey_7s": build_framework_output(
                framework_name=FrameworkName.MCKINSEY_7S,
                agent_author=AgentName.STRATEGIC_OPTIONS,
                structured_data=seven_s,
                narrative="7S alignment is directionally positive, but local staff, systems, and authority need strengthening before the company can scale confidently.",
                context=context,
                confidence_score=confidence,
                citations=citations,
            ),
            "blue_ocean": build_framework_output(
                framework_name=FrameworkName.BLUE_OCEAN,
                agent_author=AgentName.STRATEGIC_OPTIONS,
                structured_data=blue_ocean,
                narrative="The blue-ocean move is to win on trust and execution certainty rather than participate in a generic price and speed race.",
                context=context,
                confidence_score=confidence,
                citations=citations,
            ),
        }
        return {
            "ansoff_quadrant": ansoff["recommended_quadrant"],
            "strategic_options": options,
            "blue_ocean_factors": {
                "eliminate": blue_ocean["eliminate"],
                "reduce": blue_ocean["reduce"],
                "raise": blue_ocean["raise"],
                "create": blue_ocean["create"],
            },
            "mckinsey_7s_fit_score": seven_s["alignment_score"],
            "recommended_option": options[0]["option"],
            "option_rationale": ansoff["recommendation_rationale"],
            "market_shape": market.get("market_size_summary", {}),
            "framework_outputs": framework_outputs,
            "confidence_score": round(confidence, 3),
            "citations": citations,
        }
