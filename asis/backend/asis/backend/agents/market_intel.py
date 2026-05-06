from __future__ import annotations

import json

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations, infer_sector_key
from asis.backend.agents.types import PipelineState


class MarketIntelAgent(BaseAgent):
    agent_id = "market_intel"
    agent_name = "Market Intelligence"
    framework = "PESTLE + Porter's Five Forces"

    def system_prompt(self) -> str:
        return """You are the Market Intelligence agent for ASIS v4.0.
Apply PESTLE analysis and Porter's Five Forces to assess market attractiveness for the strategic question.
You are enriching a precomputed scaffold — return only a JSON patch with the fields you want to override.
JSON only, no markdown, no extra text.

Required patch shape:
{
  "market_size_summary": {
    "headline": "<specific demand statement for this company/geography>",
    "growth_rate": "<e.g. 12-15% CAGR based on evidence>",
    "regulatory_landscape": "<specific regulatory environment description>"
  },
  "market_growth_themes": ["<specific theme 1>", "<specific theme 2>", "<specific theme 3>"],
  "pestle_analysis": {
    "political": {"score": <1-10>, "factors": ["<specific factor>", "..."], "citations": []},
    "economic": {"score": <1-10>, "factors": ["<specific factor>", "..."], "citations": []},
    "social": {"score": <1-10>, "factors": ["<specific factor>", "..."], "citations": []},
    "technological": {"score": <1-10>, "factors": ["<specific factor>", "..."], "citations": []},
    "legal": {"score": <1-10>, "factors": ["<specific factor>", "..."], "citations": []},
    "environmental": {"score": <1-10>, "factors": ["<specific factor>"], "citations": []},
    "overall_score": <float>,
    "key_implication": "<one sentence strategic implication>"
  },
  "porters_five_forces": {
    "competitive_rivalry": {"score": <1-10>, "rationale": "<specific>", "key_players": ["<named competitor>"]},
    "threat_of_new_entrants": {"score": <1-10>, "rationale": "<specific>", "barriers": ["<barrier>"]},
    "threat_of_substitutes": {"score": <1-10>, "rationale": "<specific>", "substitutes": ["<substitute>"]},
    "bargaining_power_buyers": {"score": <1-10>, "rationale": "<specific>", "factors": ["<factor>"]},
    "bargaining_power_suppliers": {"score": <1-10>, "rationale": "<specific>", "factors": ["<factor>"]},
    "overall_attractiveness": <float 1-10>,
    "strategic_implication": "<one sentence conclusion>"
  },
  "key_findings": ["<finding 1>", "<finding 2>", "<finding 3>"],
  "strategic_implication": "<one sentence overall implication>",
  "confidence_score": <float 0.5-0.95>
}

Rules:
- Use specific company names, market data points, and geographies from the context
- PESTLE factors must be specific to THIS company's situation, not generic
- Named competitors must be real players in this sector/geography
- Do NOT return placeholder values"""

    def user_prompt(self, state: PipelineState) -> str:
        ctx = state.get("extracted_context") or state.get("company_context") or {}
        orch = state.get("orchestrator_output") or {}
        summary = {
            "company": ctx.get("company_name"),
            "sector": ctx.get("sector"),
            "geography": ctx.get("geography"),
            "decision_type": ctx.get("decision_type"),
            "priority_lenses": orch.get("priority_lenses", []),
            "query_type": orch.get("query_type"),
        }
        return (
            f"Strategic question:\n{state['query']}\n\n"
            f"Context:\n{json.dumps(summary, ensure_ascii=False)}\n\n"
            "Apply PESTLE and Porter's Five Forces to this specific market and company. Return the JSON patch."
        )

    def local_result(self, state: PipelineState) -> dict:
        context = state.get("extracted_context") or {}
        confidence = calculate_confidence(query=state["query"], context=context, evidence_bonus=8) / 100
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
        porter_forces = {
            "competitive_rivalry": {
                "score": 7.1,
                "rationale": "Incumbents and digital challengers are both active, creating a contested market with frequent response moves.",
                "key_players": competitors,
            },
            "threat_of_new_entrants": {
                "score": 5.2,
                "rationale": "Entry is possible, but brand trust, regulation, and distribution economics slow undifferentiated entrants.",
                "barriers": ["Regulatory approvals", "Distribution trust", "Partner accreditation"],
            },
            "threat_of_substitutes": {
                "score": 4.4,
                "rationale": "Adjacent substitutes exist, but enterprise switching still carries execution friction and governance cost.",
                "substitutes": ["Incumbent bundles", "Low-cost digital specialists"],
            },
            "bargaining_power_buyers": {
                "score": 6.3,
                "rationale": "Buyers can pressure pricing and timelines, especially in strategic procurements.",
                "factors": ["Procurement leverage", "Multi-vendor comparisons", "Demand for proof before scale"],
            },
            "bargaining_power_suppliers": {
                "score": 4.8,
                "rationale": "Some specialist vendors and channels remain concentrated, but alternatives exist with planning.",
                "factors": ["Technology dependencies", "Partner concentration", "Specialist talent pools"],
            },
            "overall_attractiveness": 6.1,
            "strategic_implication": "The market is attractive enough for entry only if the proposition is differentiated and the launch is phased.",
        }
        benchmark = [
            {"dimension": "Governance Maturity", "our_score": 64, "industry_avg": 59, "leader_score": 76, "leader_name": competitors[0]},
            {"dimension": "Speed to Launch", "our_score": 58, "industry_avg": 54, "leader_score": 73, "leader_name": competitors[1]},
            {"dimension": "Partner Ecosystem", "our_score": 61, "industry_avg": 56, "leader_score": 78, "leader_name": competitors[2]},
        ]
        citations = build_citations(context)
        pestle = {
            "political": {
                "score": 6,
                "factors": [
                    "Policy direction broadly supports innovation but can shift in regulated sectors.",
                    "Cross-border operating structures need active stakeholder management.",
                ],
                "citations": citations[:2],
            },
            "economic": {
                "score": 7,
                "factors": [
                    "Demand growth remains attractive for a staged expansion thesis.",
                    "Capital deployment should remain paced against validated segment conversion.",
                    "Partner leverage improves capital efficiency in the first year.",
                ],
                "citations": citations[:2],
            },
            "social": {
                "score": 6,
                "factors": [
                    "Customers reward trust, responsiveness, and visible reliability.",
                    "Talent expectations around mission and progression affect execution quality.",
                ],
                "citations": citations[:2],
            },
            "technological": {
                "score": 7,
                "factors": [
                    "Modern partner and API infrastructure improves entry feasibility.",
                    "Technology expectations now include resilience and auditability.",
                    "Differentiation can come from execution quality, not just product breadth.",
                ],
                "citations": citations[:2],
            },
            "legal": {
                "score": 6,
                "factors": [
                    "Data, conduct, and consumer protection obligations remain material.",
                    "Contracting and compliance readiness can shape launch sequence.",
                ],
                "citations": citations[:2],
            },
            "environmental": {
                "score": 5,
                "factors": [
                    "Environmental pressure is indirect but increasingly visible in procurement and governance expectations.",
                ],
                "citations": citations[:1],
            },
            "overall_score": 6.2,
            "key_implication": "A differentiated, partner-led launch is viable, but only with strong regulatory and execution discipline.",
        }
        return {
            "market_size_summary": {
                "headline": f"{context.get('geography') or 'Target'} demand remains attractive if the entry thesis is differentiated.",
                "growth_rate": "11-14% CAGR",
                "regulatory_landscape": "Moderately intensive with increasing supervision on data, conduct and resilience.",
            },
            "market_growth_themes": [
                "Enterprise customers continue to prioritise resilience and digital capability.",
                "Partner-led distribution reduces time-to-trust in new segments.",
                "Premium buyers reward governance and reliability over undifferentiated low pricing.",
            ],
            "technology_shifts": [
                "API-first partner architectures reduce launch friction.",
                "Automation and analytics improve service scalability.",
                "Control and observability tooling is now part of the product expectation set.",
            ],
            "framework_contributions": {
                "economic": pestle["economic"],
                "technological": pestle["technological"],
            },
            "pestle_analysis": pestle,
            "porters_five_forces": porter_forces,
            "regulatory_landscape": [
                "Board oversight expectations are rising around resilience, conduct, and data controls.",
                "Partner onboarding and compliance approvals can determine launch timing.",
                "Evidence-heavy governance will improve stakeholder confidence during scale-up.",
            ],
            "market_signals": [
                "Enterprise buyers continue to consolidate spend around trusted operators.",
                "Partner ecosystems are now a major accelerant for new-market entry.",
                "Winning propositions combine reliability, service depth, and measured innovation.",
            ],
            "key_findings": [
                "The market can absorb a differentiated entrant with credible governance.",
                "Speed without trust will underperform a phased partner-led strategy.",
                "Competitor reactions are manageable if the launch thesis avoids commodity positioning.",
            ],
            "emerging_risks": [
                "Regulatory sequencing slows value capture if compliance readiness lags.",
                "Incumbent retaliation may compress early pricing and acquisition economics.",
            ],
            "opportunities": [
                "White space exists for a trusted premium proposition.",
                "Partner-led go-to-market can cut time-to-trust and reduce capex intensity.",
            ],
            "strategic_implication": porter_forces["strategic_implication"],
            "competitor_benchmarks": benchmark,
            "named_competitors": competitors,
            "confidence_score": round(confidence, 3),
            "citations": citations,
        }
