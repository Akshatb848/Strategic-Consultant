from __future__ import annotations

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations
from asis.backend.agents.v4_support import build_framework_output
from asis.backend.graph.context import extract_query_facts
from asis.backend.schemas.v4 import AgentName, FrameworkName


class FinancialReasoningAgent(BaseAgent):
    agent_id = "financial_reasoning"
    agent_name = "Financial Reasoning"
    framework = "BCG Matrix + capital case + balanced scorecard seed"

    def local_result(self, state) -> dict:
        context = state.get("extracted_context") or {}
        company = context.get("company_name") or "the organisation"
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
            {"name": "Core Business", "market_growth_rate": 8, "relative_market_share": 2.4, "category": "cash_cow", "strategic_implication": "Fund controlled expansion from the core cash engine."},
            {"name": "New Market Entry", "market_growth_rate": 16, "relative_market_share": 0.7, "category": "question_mark", "strategic_implication": "Treat expansion as an option that earns capital in stages."},
            {"name": "Digital Partnerships", "market_growth_rate": 14, "relative_market_share": 1.3, "category": "star", "strategic_implication": "Use partnerships to accelerate capability and distribution."},
            ]
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
