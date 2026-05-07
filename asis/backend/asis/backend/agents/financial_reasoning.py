from __future__ import annotations

import json

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations
from asis.backend.agents.v4_support import build_framework_output
from asis.backend.graph.context import extract_query_facts
from asis.backend.schemas.v4 import AgentName, FrameworkName


class FinancialReasoningAgent(BaseAgent):
    agent_id = "financial_reasoning"
    agent_name = "Financial Reasoning"
    framework = "BCG Matrix + capital case + balanced scorecard seed"

    def system_prompt(self) -> str:
        return """You are the Financial Reasoning agent for ASIS v4.0.
Build the capital case, BCG Matrix positioning, financial projections, and balanced scorecard seed.
You have access to outputs from Market Intelligence, Risk Assessment, Competitor Analysis, and Geo Intel.
Return a JSON patch enriching the precomputed scaffold. JSON only, no markdown.

Required patch shape:
{
  "business_units": [
    {
      "name": "<business unit name>",
      "market_growth_rate": <float, annual %>,
      "relative_market_share": <float, relative to largest competitor>,
      "category": "star|cash_cow|question_mark|dog",
      "strategic_implication": "<what this means for capital allocation>"
    }
  ],
  "financial_projections": {
    "year_1": {"revenue": <USD>, "ebitda": <USD>, "roi": <float 0-1>, "irr": <float 0-1>},
    "year_3": {"revenue": <USD>, "ebitda": <USD>, "roi": <float 0-1>, "irr": <float 0-1>},
    "year_5": {"revenue": <USD>, "ebitda": <USD>, "roi": <float 0-1>, "irr": <float 0-1>}
  },
  "scenario_analysis": {
    "base": {"revenue_usd_mn": <float>, "irr_pct": <float>, "payback_months": <int>},
    "upside": {"revenue_usd_mn": <float>, "irr_pct": <float>, "payback_months": <int>},
    "downside": {"revenue_usd_mn": <float>, "irr_pct": <float>, "payback_months": <int>}
  },
  "capital_requirements": {
    "phase_1_usd_mn": <float>,
    "total_investment_usd_mn": <float>,
    "funding_structure": "<e.g. 60% equity / 40% debt>"
  },
  "peer_benchmarking": [
    {"company": "<peer name>", "metric": "<metric>", "value": "<value>", "peer_average": "<average>"}
  ],
  "key_financial_risks": ["<risk 1 from risk assessment>", "..."],
  "confidence_score": <float 0.5-0.95>
}

Rules:
- Revenue and EBITDA must be calibrated to the company's size (from company context)
- BCG positioning must reflect market_intel growth rates and competitor analysis share data
- Scenario analysis must reflect risk assessment findings (downside = worst risks materialise)
- Capital requirements must be realistic for this sector and scale
- key_financial_risks must come from the risk register provided"""

    def user_prompt(self, state) -> str:
        ctx = state.get("extracted_context") or state.get("company_context") or {}
        market = state.get("market_intel_output") or {}
        risk = state.get("risk_assessment_output") or {}
        comp = state.get("competitor_analysis_output") or {}
        geo = state.get("geo_intel_output") or {}

        upstream = {
            "market_summary": market.get("market_size_summary"),
            "market_growth_themes": (market.get("market_growth_themes") or [])[:3],
            "market_attractiveness": (market.get("porters_five_forces") or {}).get("overall_attractiveness"),
            "top_risks": [r.get("description") for r in (risk.get("risk_register") or [])[:3]],
            "top_competitors": comp.get("top_competitors", []),
            "political_risk_score": geo.get("political_risk_score"),
            "fdi_sentiment": geo.get("fdi_sentiment"),
        }
        company_info = {
            "company": ctx.get("company_name"),
            "sector": ctx.get("sector"),
            "geography": ctx.get("geography"),
            "annual_revenue": ctx.get("annual_revenue"),
            "employees": ctx.get("employees"),
            "decision_type": ctx.get("decision_type"),
        }
        return (
            f"Strategic question:\n{state['query']}\n\n"
            f"Company:\n{json.dumps(company_info, ensure_ascii=False)}\n\n"
            f"Upstream intelligence summary:\n{json.dumps(upstream, ensure_ascii=False)}\n\n"
            "Build the financial case calibrated to this company's scale and risk profile. Return the JSON patch."
        )

    def local_result(self, state) -> dict:
        context = state.get("extracted_context") or {}
        company = context.get("company_name") or "the organisation"
        sector = context.get("sector") or "business"
        geography = context.get("geography") or "the target market"
        citations = build_citations(context)
        confidence = calculate_confidence(query=state["query"], context=context, evidence_bonus=8) / 100
        facts = extract_query_facts(state["query"])
        if {"proprietary_ai_platform", "data_ecosystem"}.intersection(facts.get("strategic_themes", [])):
            business_units = [
                {"name": "AI-enabled M&A platform", "market_growth_rate": 18, "relative_market_share": 0.8, "category": "question_mark", "strategic_implication": "Earn capital through use-case proof before scaling the platform globally."},
                {"name": "Data ecosystem and benchmarks", "market_growth_rate": 16, "relative_market_share": 1.1, "category": "star", "strategic_implication": "Protect and expand proprietary data assets because they create the defensible moat."},
                {"name": "Core strategy and diligence work", "market_growth_rate": 7, "relative_market_share": 2.3, "category": "cash_cow", "strategic_implication": "Use existing premium advisory demand to fund the build-out without diluting margin discipline."},
            ]
        else:
            business_units = [
            {"name": f"{company} core {sector} engine", "market_growth_rate": 8, "relative_market_share": 2.4, "category": "cash_cow", "strategic_implication": f"Use {company}'s core cash engine to fund controlled expansion without weakening the base."},
            {"name": f"{geography} expansion option", "market_growth_rate": 16, "relative_market_share": 0.7, "category": "question_mark", "strategic_implication": f"Treat {geography} expansion as an option that earns capital in stages."},
            {"name": f"{company} partner-led growth channels", "market_growth_rate": 14, "relative_market_share": 1.3, "category": "star", "strategic_implication": "Use named partnerships to accelerate capability and distribution."},
            ]
        investment_range = context.get("investment_range_usd_mn") or facts.get("investment_range_usd_mn") or {}
        investment_mid_mn = 0.0
        if isinstance(investment_range, dict):
            investment_mid_mn = float(investment_range.get("mid") or 0.0)
        if investment_mid_mn >= 200:
            scale = max(1.0, min(10.0, investment_mid_mn / 150.0))
            projections = {
                "year_1": {"revenue": round(12_000_000 * scale), "ebitda": round(2_100_000 * scale), "roi": 0.11, "irr": 0.16},
                "year_3": {"revenue": round(38_000_000 * scale), "ebitda": round(9_300_000 * scale), "roi": 0.28, "irr": 0.24},
                "year_5": {"revenue": round(74_000_000 * scale), "ebitda": round(21_000_000 * scale), "roi": 0.43, "irr": 0.31},
            }
        else:
            projections = {
                "year_1": {"revenue": 12_000_000, "ebitda": 2_100_000, "roi": 0.11, "irr": 0.16},
                "year_3": {"revenue": 38_000_000, "ebitda": 9_300_000, "roi": 0.28, "irr": 0.24},
                "year_5": {"revenue": 74_000_000, "ebitda": 21_000_000, "roi": 0.43, "irr": 0.31},
            }
        benchmarking = [
            {"company": company, "metric": "EBITDA margin", "value": "18%", "peer_average": "16%"},
            {"company": company, "metric": "Payback period", "value": "24 months", "peer_average": "28 months"},
            {"company": company, "metric": "Capital intensity", "value": "Moderate", "peer_average": "Moderate"},
        ]
        balanced_scorecard_seed = {
            "financial": {"objectives": ["Protect ROI discipline", "Stage capital commitments"], "measures": ["IRR", "cash payback"], "targets": ["IRR > 24%", "Payback < 30 months"], "initiatives": ["Phase-gated funding", "Quarterly investment review"]},
            "customer": {"objectives": ["Win trust in the target segment"], "measures": ["Net retention", "reference accounts"], "targets": ["NRR > 110%", "5 lighthouse clients"], "initiatives": ["Targeted partnerships", "Board-level client oversight"]},
            "internal_process": {"objectives": ["Embed compliance and execution controls"], "measures": ["control pass rate", "launch readiness"], "targets": ["95% pass rate", "90% readiness"], "initiatives": ["Readiness PMO", "Control design sprints"]},
            "learning_and_growth": {"objectives": ["Build local capability"], "measures": ["critical hires", "training completion"], "targets": ["10 key hires", "100% training completion"], "initiatives": ["Local talent pods", "Leadership capability academy"]},
        }
        framework = build_framework_output(
            framework_name=FrameworkName.BCG_MATRIX,
            agent_author=AgentName.FINANCIAL_REASONING,
            structured_data={"business_units": business_units},
            narrative="Financially, the expansion behaves like a question mark that can become a star only if staged investment converts early demand and partnerships into repeatable share gains.",
            context=context,
            confidence_score=confidence,
            citations=citations,
        )
        return {
            "business_units": business_units,
            "financial_projections": projections,
            "peer_benchmarking": benchmarking,
            "balanced_scorecard_seed": balanced_scorecard_seed,
            "framework_outputs": {"bcg_matrix": framework},
            "confidence_score": round(confidence, 3),
            "citations": citations,
        }
