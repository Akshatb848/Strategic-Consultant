"""
Single-Agent LLM Baseline for DSR Evaluation.

The baseline makes ONE LLM call (same Groq provider, same primary model as
ASIS) with the full strategic query and company context in a single prompt.
No multi-agent routing, no parallel branches, no quality gate.

This isolates the effect of ASIS's multi-agent orchestration architecture
from raw model capability, since both systems use identical underlying LLMs.

The output is normalised to the same top-level schema that the RubricScorer
expects, so the five-dimension rubric can score both briefs identically.
"""
from __future__ import annotations

import json
import re
import time
from typing import Any

from asis.backend.agents.llm_proxy import llm_proxy
from asis.backend.config.settings import get_settings


_BASELINE_SYSTEM_PROMPT = """\
You are a senior strategy consultant. Given a business problem statement and
company context, produce a comprehensive strategic analysis and recommendation.

Return ONLY a single valid JSON object with the following fields (all required):
{
  "decision_statement": "PROCEED — <action> — <key condition> (≤35 words)",
  "recommendation": "PROCEED | CONDITIONAL PROCEED | DO NOT PROCEED",
  "executive_summary": {
    "headline": "<decision_statement verbatim>",
    "key_argument_1": "<string>",
    "key_argument_2": "<string>",
    "key_argument_3": "<string>",
    "critical_risk": "<string>",
    "next_step": "<specific immediate action, ≥5 words>"
  },
  "board_narrative": "<150-250 word narrative for a C-suite audience>",
  "overall_confidence": <float 50–90>,
  "market_analysis": {
    "summary": "<string>",
    "market_growth_rate": <float>,
    "key_drivers": ["<string>"]
  },
  "financial_analysis": {
    "summary": "<string>",
    "scenario_analysis": {
      "scenarios": [
        {"name": "Base", "revenue_usd_mn": <float>, "irr_pct": <float>},
        {"name": "Upside", "revenue_usd_mn": <float>, "irr_pct": <float>},
        {"name": "Downside", "revenue_usd_mn": <float>, "irr_pct": <float>}
      ]
    },
    "bottom_up_revenue_model": {
      "sector_build": [],
      "key_assumptions": ["<string>", "<string>", "<string>"]
    }
  },
  "risk_analysis": {
    "risk_register": [
      {
        "category": "Regulatory|Financial|Operational|Reputational|Strategic",
        "description": "<string>",
        "severity": <float 0–10>,
        "likelihood": <float 0–1>,
        "mitigation": "<string>"
      }
    ]
  },
  "implementation_roadmap": [
    {
      "phase": "Immediate (0–3 months)",
      "actions": ["<string>"],
      "kpis": ["<string>"],
      "budget_usd_mn": <float>
    },
    {
      "phase": "Short-term (3–12 months)",
      "actions": ["<string>"],
      "kpis": ["<string>"],
      "budget_usd_mn": <float>
    },
    {
      "phase": "Medium-term (1–3 years)",
      "actions": ["<string>"],
      "kpis": ["<string>"],
      "budget_usd_mn": <float>
    },
    {
      "phase": "Long-term (3–5 years)",
      "actions": ["<string>"],
      "kpis": ["<string>"],
      "budget_usd_mn": <float>
    }
  ],
  "balanced_scorecard": [
    {"perspective": "Financial", "objective": "<string>", "kpi": "<string>", "target": "<string>"},
    {"perspective": "Customer", "objective": "<string>", "kpi": "<string>", "target": "<string>"},
    {"perspective": "Internal Process", "objective": "<string>", "kpi": "<string>", "target": "<string>"},
    {"perspective": "Learning & Growth", "objective": "<string>", "kpi": "<string>", "target": "<string>"}
  ],
  "citations": [
    {
      "title": "<publication title>",
      "source": "<organisation or journal>",
      "url": "https://...",
      "published_at": "YYYY-MM-DD",
      "excerpt": "<one-sentence relevance>"
    }
  ],
  "context": {
    "company_name": "<string>",
    "sector": "<string>",
    "geography": "<string>",
    "decision_type": "<string>"
  },
  "framework_outputs": {},
  "agent_collaboration_trace": [],
  "mece_score": 0.0,
  "internal_consistency_score": 0.0,
  "verification": {}
}

Populate every field with specific, evidence-grounded content.
Do NOT return placeholder or example values.
"""


def _user_prompt(query: str, context: dict) -> str:
    context_lines = "\n".join(f"  {k}: {v}" for k, v in context.items())
    return (
        f"Strategic Question:\n{query}\n\n"
        f"Company Context:\n{context_lines}\n\n"
        "Return only the JSON object described in the system prompt. "
        "No markdown, no extra text."
    )


def _extract_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start != -1 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


class SingleAgentBaseline:
    """
    Calls the LLM exactly once with the full strategic context in a single
    prompt, mimicking a consultant without specialist sub-agents.
    """

    def run(self, query: str, context: dict) -> dict[str, Any]:
        """
        Returns a brief dict scored by the same rubric as the ASIS output.
        Falls back to a structured template if the LLM call fails so the
        evaluation can continue for the remaining scenarios.
        """
        settings = get_settings()
        t0 = time.perf_counter()

        result = llm_proxy.generate_json(
            system_prompt=_BASELINE_SYSTEM_PROMPT,
            user_prompt=_user_prompt(query, context),
            model=settings.groq_model_primary,
            agent_id="baseline",
        )

        latency_ms = int((time.perf_counter() - t0) * 1000)

        if result:
            result.setdefault("context", context)
            result.setdefault("framework_outputs", {})
            result.setdefault("agent_collaboration_trace", [])
            result.setdefault("mece_score", 0.0)
            result.setdefault("internal_consistency_score", 0.0)
            result.setdefault("verification", {})
            result["_latency_ms"] = latency_ms
            result["_system"] = "baseline"
            return result

        return self._fallback_brief(query, context, latency_ms)

    def _fallback_brief(self, query: str, context: dict, latency_ms: int) -> dict:
        company = context.get("company_name") or "the organisation"
        sector = context.get("sector") or "the sector"
        geography = context.get("geography") or "the target market"
        return {
            "decision_statement": (
                f"CONDITIONAL PROCEED — {company} should advance cautiously in "
                f"{geography} pending validation of core commercial assumptions."
            ),
            "recommendation": "CONDITIONAL PROCEED",
            "executive_summary": {
                "headline": f"Conditional entry for {company} in {geography}",
                "key_argument_1": "Market opportunity exists but requires validation.",
                "key_argument_2": "Regulatory and operational risks are material.",
                "key_argument_3": "Phased approach reduces capital exposure.",
                "critical_risk": "Execution capability and regulatory approval are not yet confirmed.",
                "next_step": "Commission a 90-day market validation workstream.",
            },
            "board_narrative": (
                f"{company} faces a qualified opportunity in {sector} across "
                f"{geography}. A phased entry strategy is recommended, contingent "
                "on regulatory clearance and commercial validation. The board should "
                "authorise a 90-day feasibility phase before committing full capital."
            ),
            "overall_confidence": 62.0,
            "market_analysis": {
                "summary": "Market conditions are broadly favourable but require validation.",
                "market_growth_rate": 8.0,
                "key_drivers": ["Demand growth", "Regulatory evolution", "Competitive dynamics"],
            },
            "financial_analysis": {
                "summary": "Directional economics are positive; bottom-up model required.",
                "scenario_analysis": {
                    "scenarios": [
                        {"name": "Base", "revenue_usd_mn": 500, "irr_pct": 14},
                        {"name": "Upside", "revenue_usd_mn": 700, "irr_pct": 22},
                        {"name": "Downside", "revenue_usd_mn": 300, "irr_pct": 8},
                    ]
                },
                "bottom_up_revenue_model": {
                    "sector_build": [],
                    "key_assumptions": [
                        "Market growth 8% CAGR",
                        "Share capture 5% in year 3",
                        "EBITDA margin 18%",
                    ],
                },
            },
            "risk_analysis": {
                "risk_register": [
                    {
                        "category": "Regulatory",
                        "description": "Regulatory approval timelines are uncertain.",
                        "severity": 7.0,
                        "likelihood": 0.5,
                        "mitigation": "Engage regulatory counsel and file early.",
                    },
                    {
                        "category": "Financial",
                        "description": "Capital requirements may exceed projections.",
                        "severity": 6.5,
                        "likelihood": 0.4,
                        "mitigation": "Stage capital deployment against milestones.",
                    },
                    {
                        "category": "Operational",
                        "description": "Execution capability gaps may slow deployment.",
                        "severity": 6.0,
                        "likelihood": 0.45,
                        "mitigation": "Identify and recruit specialist talent early.",
                    },
                ]
            },
            "implementation_roadmap": [
                {
                    "phase": "Immediate (0–3 months)",
                    "actions": ["Commission market validation study", "Engage regulatory counsel"],
                    "kpis": ["Validation report delivered", "Regulatory timeline confirmed"],
                    "budget_usd_mn": 2.0,
                },
                {
                    "phase": "Short-term (3–12 months)",
                    "actions": ["Submit regulatory filings", "Build core team"],
                    "kpis": ["Regulatory filing submitted", "Key hires in place"],
                    "budget_usd_mn": 15.0,
                },
                {
                    "phase": "Medium-term (1–3 years)",
                    "actions": ["Commercial launch", "Scale operations"],
                    "kpis": ["Revenue target achieved", "Market share milestone"],
                    "budget_usd_mn": 80.0,
                },
                {
                    "phase": "Long-term (3–5 years)",
                    "actions": ["Portfolio expansion", "Profitability optimisation"],
                    "kpis": ["EBITDA margin target", "Market leadership position"],
                    "budget_usd_mn": 150.0,
                },
            ],
            "balanced_scorecard": [
                {
                    "perspective": "Financial",
                    "objective": "Achieve target returns",
                    "kpi": "IRR %",
                    "target": "≥14%",
                },
                {
                    "perspective": "Customer",
                    "objective": "Establish market presence",
                    "kpi": "Market share %",
                    "target": "5% in 3 years",
                },
                {
                    "perspective": "Internal Process",
                    "objective": "Regulatory compliance",
                    "kpi": "Compliance milestones",
                    "target": "On schedule",
                },
                {
                    "perspective": "Learning & Growth",
                    "objective": "Build local talent",
                    "kpi": "Local hire ratio",
                    "target": "≥60%",
                },
            ],
            "citations": [
                {
                    "title": "World Bank Global Economic Prospects",
                    "source": "World Bank",
                    "url": "https://www.worldbank.org/en/publication/global-economic-prospects",
                    "published_at": "2025-01-01",
                    "excerpt": "Macro demand outlook underpins the growth assumptions.",
                }
            ],
            "context": context,
            "framework_outputs": {},
            "agent_collaboration_trace": [],
            "mece_score": 0.0,
            "internal_consistency_score": 0.0,
            "verification": {},
            "_latency_ms": latency_ms,
            "_system": "baseline_fallback",
        }

    # Legacy stub kept for backward compatibility with pipeline.py
    def build_brief(self, query: str, context: dict) -> dict:
        return self.run(query, context)
