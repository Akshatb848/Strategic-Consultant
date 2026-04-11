from __future__ import annotations

from asis.backend.schemas.common import Citation


class SingleAgentBaseline:
    def build_brief(self, query: str, context: dict) -> dict:
        company = context.get("company_name") or "the organisation"
        sector = context.get("sector") or "the relevant sector"
        geography = context.get("geography") or "the target market"
        citations = [
            Citation(
                title="World Bank Global Economic Prospects",
                source="World Bank",
                url="https://www.worldbank.org/en/publication/global-economic-prospects",
                published_at="2025-12-01",
                excerpt="Macro demand assumptions should be grounded in observable growth and inflation signals.",
            ).model_dump()
        ]
        return {
            "executive_summary": f"A single-agent baseline recommends cautious progression for {company} in {sector} across {geography}.",
            "board_narrative": f"{company} should proceed only after validating core assumptions behind: {query}",
            "recommendation": "HOLD",
            "overall_confidence": 63.0,
            "frameworks_applied": ["Single-agent baseline"],
            "context": context,
            "market_analysis": {"summary": "Baseline uses a simplified market view with fewer explicit cross-checks."},
            "financial_analysis": {"summary": "Baseline provides directional economics only."},
            "risk_analysis": {"summary": "Baseline highlights risk but without adversarial routing."},
            "red_team": {"summary": "No dedicated red-team pass in the baseline."},
            "verification": {"summary": "No dedicated CoVe routing in the baseline."},
            "roadmap": [],
            "balanced_scorecard": [],
            "citations": citations,
        }
