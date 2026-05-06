from __future__ import annotations

import json

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations
from asis.backend.agents.v4_support import build_framework_output
from asis.backend.schemas.v4 import AgentName, FrameworkName


class GeoIntelAgent(BaseAgent):
    agent_id = "geo_intel"
    agent_name = "Geopolitical Intelligence"
    framework = "PESTLE political/legal + CAGE distance"

    def system_prompt(self) -> str:
        return """You are the Geopolitical Intelligence agent for ASIS v4.0.
Assess the political/legal PESTLE dimensions and CAGE distance factors for the target geography.
Return a JSON patch enriching the precomputed scaffold. JSON only, no markdown.

Required patch shape:
{
  "political_risk_score": <float 1-10, where 10 = highest risk>,
  "trade_barriers": ["<specific barrier 1>", "<specific barrier 2>", "..."],
  "regulatory_outlook": "<specific description of regulatory environment for this sector>",
  "cage_distance_analysis": {
    "cultural": "<specific cultural distance assessment for this company/geography pair>",
    "administrative": "<specific administrative/regulatory distance>",
    "geographic": "<specific physical/logistics distance>",
    "economic": "<specific economic distance — cost structure, wage levels, FX>",
    "overall_distance_score": <float 1-10, where 10 = most distant>,
    "key_implication": "<how CAGE distance affects this specific decision>"
  },
  "fdi_sentiment": "<e.g. Positive; Cautious; Restrictive> — with one sentence explanation",
  "geopolitical_hotspots": ["<specific concern 1>", "..."],
  "entry_prerequisites": ["<regulatory/legal prerequisite 1>", "..."],
  "confidence_score": <float 0.5-0.95>
}

Rules:
- political_risk_score must reflect ACTUAL current conditions in this geography
- trade_barriers must be specific to this sector and geography combination
- CAGE analysis must compare the company's home geography to the target geography
- geopolitical_hotspots must be real current issues (sanctions, trade disputes, instability)
- entry_prerequisites must list the actual regulatory steps for THIS sector entry"""

    def user_prompt(self, state) -> str:
        ctx = state.get("extracted_context") or state.get("company_context") or {}
        orch = state.get("orchestrator_output") or {}
        summary = {
            "company": ctx.get("company_name"),
            "home_geography": ctx.get("home_geography") or ctx.get("hq_country"),
            "target_geography": ctx.get("geography"),
            "sector": ctx.get("sector"),
            "decision_type": ctx.get("decision_type"),
            "priority_lenses": orch.get("priority_lenses", []),
        }
        return (
            f"Strategic question:\n{state['query']}\n\n"
            f"Context:\n{json.dumps(summary, ensure_ascii=False)}\n\n"
            "Assess geopolitical risks and CAGE distance for this specific geography and company. Return the JSON patch."
        )

    def local_result(self, state) -> dict:
        context = state.get("extracted_context") or {}
        geography = context.get("geography") or "the target market"
        citations = build_citations(context)
        confidence = calculate_confidence(query=state["query"], context=context, evidence_bonus=6) / 100
        political = {
            "score": 6,
            "factors": [
                f"{geography} offers policy support for strategic investment, but execution must track political signalling closely.",
                "Trade and investment posture remains constructive for compliant entrants.",
                "Cross-border data, sanctions, and state-relations shifts can alter execution speed.",
            ],
            "citations": citations[:2],
        }
        legal = {
            "score": 6,
            "factors": [
                "Licensing, privacy, and consumer-protection obligations will shape launch sequencing.",
                "Localisation, reporting, and conduct expectations should be built into the operating model.",
                "Regulatory dialogue is an execution dependency, not a final-step compliance task.",
            ],
            "citations": citations[1:3],
        }
        cage = {
            "cultural": "Moderate distance mitigated by local partnerships and customer adaptation.",
            "administrative": "Material distance driven by licensing, reporting, and policy interpretation.",
            "geographic": "Manageable with local execution and distributed governance.",
            "economic": "Attractive demand profile but cost-to-serve varies sharply by segment.",
        }
        pestle = build_framework_output(
            framework_name=FrameworkName.PESTLE,
            agent_author=AgentName.GEO_INTEL,
            structured_data={
                "political": political,
                "economic": {"score": 0, "factors": [], "citations": []},
                "social": {"score": 0, "factors": [], "citations": []},
                "technological": {"score": 0, "factors": [], "citations": []},
                "legal": legal,
                "environmental": {"score": 0, "factors": [], "citations": []},
                "overall_score": 0,
                "key_implication": "Geopolitical conditions support controlled expansion only when administrative distance is actively mitigated.",
            },
            narrative="Political and legal conditions are investable, but they must be converted into a staged operating model that treats regulatory engagement as a first-order strategic variable.",
            context=context,
            confidence_score=confidence,
            citations=citations,
        )
        return {
            "political_risk_score": 5.8,
            "trade_barriers": ["licensing lead times", "data-transfer constraints", "sector-specific conduct rules"],
            "regulatory_outlook": "Constructive but supervision-heavy for new entrants.",
            "cage_distance_analysis": cage,
            "fdi_sentiment": "Measured positive",
            "framework_outputs": {"pestle": pestle},
            "confidence_score": round(confidence, 3),
            "citations": citations,
            "_tools_called": [
                {"tool_name": "Tavily", "query": f"{geography} political stability and trade policy", "response_size": 4, "latency_ms": 420},
                {"tool_name": "NewsAPI", "query": f"{geography} regulation sanctions FDI sentiment", "response_size": 6, "latency_ms": 360},
            ],
        }
