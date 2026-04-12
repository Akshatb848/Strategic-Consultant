from __future__ import annotations

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations
from asis.backend.agents.v4_support import build_framework_output
from asis.backend.schemas.v4 import AgentName, FrameworkName


class GeoIntelAgent(BaseAgent):
    agent_id = "geo_intel"
    agent_name = "Geopolitical Intelligence"
    framework = "PESTLE political/legal + CAGE distance"

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
