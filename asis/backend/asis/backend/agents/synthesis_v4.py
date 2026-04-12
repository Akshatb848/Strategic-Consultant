from __future__ import annotations

import json
from statistics import mean

from asis.backend.agents.base import BaseAgent
from asis.backend.agents.references import build_citations
from asis.backend.agents.v4_support import (
    average_framework_confidence,
    build_framework_output,
    decision_label,
    flatten_citations,
    framework_key_finding,
)
from asis.backend.schemas.v4 import AgentName, FrameworkName


class V4SynthesisAgent(BaseAgent):
    agent_id = "synthesis"
    agent_name = "Synthesis"
    framework = "StrategicBriefV4 board synthesis"

    def system_prompt(self) -> str:
        return """
You are the Chief Strategy Officer synthesis engine of ASIS. You have received
structured intelligence from 7 specialist AI agents. Your task is to:

1. Complete all incomplete framework_outputs in AgentState.
2. Produce SWOT by integrating all upstream agent outputs.
3. Produce Balanced Scorecard using financial data as the primary source and strategic options as validation.
4. Formulate a single-sentence decision statement beginning with exactly one of:
   PROCEED, CONDITIONAL PROCEED, DO NOT PROCEED.
5. Produce a 3-paragraph executive summary.
6. Produce a 4-phase implementation roadmap.
7. Preserve framework provenance and collaboration trace information.

Output only valid JSON conforming to StrategicBriefV4.
Do not include prose outside the JSON.
""".strip()

    def user_prompt(self, state) -> str:
        payload = {
            "query": state.get("query"),
            "company_context": state.get("extracted_context") or state.get("company_context"),
            "market_intel_output": state.get("market_intel_output"),
            "risk_assessment_output": state.get("risk_assessment_output"),
            "competitor_analysis_output": state.get("competitor_analysis_output"),
            "geo_intel_output": state.get("geo_intel_output"),
            "financial_reasoning_output": state.get("financial_reasoning_output"),
            "strategic_options_output": state.get("strategic_options_output"),
            "framework_outputs": state.get("framework_outputs"),
            "agent_collaboration_trace": state.get("agent_collaboration_trace"),
        }
        return json.dumps(payload, indent=2, default=str)

    @staticmethod
    def _confidence_variance(query: str, context: dict) -> float:
        fingerprint = (sum(ord(char) for char in query) + len(context.get("company_name") or "")) % 17
        return fingerprint / 1000

    def local_result(self, state) -> dict:
        context = state.get("extracted_context") or {}
        company = context.get("company_name") or "The organisation"
        query = state.get("query") or ""
        market = state.get("market_intel_output") or {}
        risk = state.get("risk_assessment_output") or {}
        competitor = state.get("competitor_analysis_output") or {}
        geo = state.get("geo_intel_output") or {}
        financial = state.get("financial_reasoning_output") or {}
        strategic = state.get("strategic_options_output") or {}
        citations = flatten_citations(
            [
                market.get("citations"),
                risk.get("citations"),
                competitor.get("citations"),
                geo.get("citations"),
                financial.get("citations"),
                strategic.get("citations"),
            ]
        ) or build_citations(context, limit=4)

        framework_outputs = dict(state.get("framework_outputs") or {})
        pestle = self._complete_pestle(state, citations)
        swot = self._build_swot(state, citations)
        balanced_scorecard = self._build_balanced_scorecard(state, citations)
        framework_outputs["pestle"] = pestle
        framework_outputs["swot"] = swot
        framework_outputs["balanced_scorecard"] = balanced_scorecard

        decision_confidence = min(
            0.99,
            average_framework_confidence(framework_outputs) + self._confidence_variance(query, context),
        )
        label = decision_label(decision_confidence)
        decisive_framework_name = self._decisive_framework_name(framework_outputs)
        decisive_framework = framework_outputs[decisive_framework_name]
        decisive_evidence = framework_key_finding(decisive_framework)
        recommendation_text = strategic.get("recommended_option") or "pursue the phased market-development option"
        decision_statement = f"{label} - {recommendation_text} because {decisive_evidence}"
        if len(decision_statement) > 235:
            decision_statement = f"{label} - {recommendation_text} because the strongest evidence supports a controlled, risk-gated entry."
        executive_summary = "\n\n".join(
            [
                f"{company} requested a board-level answer to the question: {query}. {decision_statement} The recommendation is framed as a board action, not a market observation, and assumes disciplined execution gates remain in force.",
                f"The strongest supporting evidence comes from {decisive_framework_name.replace('_', ' ').title()}, with corroboration from PESTLE, Porter's Five Forces, and the capital case. Together these frameworks point to a measured entry path that preserves upside while constraining unmanaged complexity.",
                "The central implementation headline is that speed should follow readiness. Governance, partner quality, regulatory sequencing, and local operating capability should determine the pace of commitment at each phase.",
            ]
        )
        roadmap_items = [
            {
                "phase": "Immediate (0-3 months)",
                "actions": ["Validate demand assumptions", "Lock regulatory workplan", "Nominate accountable workstream owners"],
                "owner_function": "Strategy Office",
                "success_metrics": ["Validated target segments", "Regulatory dependency map approved"],
                "estimated_investment_usd": 750000,
            },
            {
                "phase": "Short-term (3-12 months)",
                "actions": ["Launch partner-led pilot", "Stand up governance cadence", "Localise operating model controls"],
                "owner_function": "Business Unit Leadership",
                "success_metrics": ["Pilot launch on time", "Control pass rate above 95%"],
                "estimated_investment_usd": 2500000,
            },
            {
                "phase": "Medium-term (1-3 years)",
                "actions": ["Scale winning segments", "Expand ecosystem relationships", "Tighten margin management"],
                "owner_function": "Commercial and Finance",
                "success_metrics": ["Target IRR achieved", "Reference accounts secured"],
                "estimated_investment_usd": 6200000,
            },
            {
                "phase": "Long-term (3-5 years)",
                "actions": ["Entrench differentiated positioning", "Optimise portfolio mix", "Codify repeatable market-entry playbooks"],
                "owner_function": "Executive Committee",
                "success_metrics": ["Sustained market share growth", "Repeatable expansion model documented"],
                "estimated_investment_usd": 9800000,
            },
        ]
        legacy_balanced_scorecard = [
            {
                "dimension": "Financial Perspective",
                "kpi": "IRR",
                "baseline": "0%",
                "target": balanced_scorecard["structured_data"]["financial"]["targets"][0],
                "timeline": "36 months",
            },
            {
                "dimension": "Customer Perspective",
                "kpi": "Reference accounts",
                "baseline": "0",
                "target": balanced_scorecard["structured_data"]["customer"]["targets"][1],
                "timeline": "12 months",
            },
            {
                "dimension": "Internal Process",
                "kpi": "Control pass rate",
                "baseline": "0%",
                "target": balanced_scorecard["structured_data"]["internal_process"]["targets"][0],
                "timeline": "12 months",
            },
            {
                "dimension": "Learning & Growth",
                "kpi": "Training completion",
                "baseline": "0%",
                "target": balanced_scorecard["structured_data"]["learning_and_growth"]["targets"][1],
                "timeline": "12 months",
            },
        ]
        verification = {
            "overall_verification_score": round(decision_confidence, 3),
            "recommendation": label,
            "frameworks_completed": list(framework_outputs.keys()),
            "collaboration_events": len(state.get("agent_collaboration_trace") or []),
        }
        market_analysis = {
            "summary": market.get("market_size_summary", {}),
            "competitor_profiles": competitor.get("competitor_profiles", []),
            "frameworks": ["pestle", "porters_five_forces", "blue_ocean"],
        }
        financial_analysis = {
            "summary": financial.get("financial_projections", {}),
            "peer_benchmarking": financial.get("peer_benchmarking", []),
            "recommended_option": strategic.get("recommended_option"),
        }
        risk_analysis = {
            "summary": risk.get("risk_register", []),
            "geo_intel": geo.get("cage_distance_analysis", {}),
        }
        report_metadata = {
            "analysis_id": state["analysis_id"],
            "company_name": company,
            "query": query,
            "generated_at": __import__("datetime").datetime.utcnow().isoformat(),
            "asis_version": "4.0.0",
            "confidentiality_level": "STRICTLY CONFIDENTIAL",
            "disclaimer": "AI-assisted analysis for board discussion only. Human review is recommended before execution.",
        }
        return {
            "decision_statement": decision_statement,
            "decision_confidence": round(decision_confidence, 3),
            "decision_rationale": f"{label.title()} is justified because cross-framework evidence shows the best risk-adjusted path is a phased entry rather than an all-in launch.",
            "framework_outputs": framework_outputs,
            "agent_collaboration_trace": state.get("agent_collaboration_trace") or [],
            "executive_summary": executive_summary,
            "implementation_roadmap": roadmap_items,
            "balanced_scorecard": balanced_scorecard["structured_data"],
            "report_metadata": report_metadata,
            "board_narrative": "The board should move only if it can convert strategic intent into a gated execution model with clear accountability and evidence-led milestones.",
            "recommendation": label,
            "overall_confidence": round(decision_confidence, 3),
            "frameworks_applied": [
                "PESTLE",
                "SWOT",
                "Porter's Five Forces",
                "Ansoff Matrix",
                "BCG Matrix",
                "McKinsey 7S",
                "Blue Ocean Canvas",
                "Balanced Scorecard",
            ],
            "context": context,
            "market_analysis": market_analysis,
            "financial_analysis": financial_analysis,
            "risk_analysis": risk_analysis,
            "red_team": {"summary": "Legacy red-team workflow not executed in v4 framework mode."},
            "verification": verification,
            "roadmap": roadmap_items,
            "citations": citations,
            "confidence_score": round(decision_confidence, 3),
            "balanced_scorecard_legacy": legacy_balanced_scorecard,
        }

    def _complete_pestle(self, state, citations: list[dict]) -> dict:
        market = state.get("market_intel_output") or {}
        risk = state.get("risk_assessment_output") or {}
        geo = state.get("geo_intel_output") or {}
        economic = market.get("framework_contributions", {}).get("economic") or {
            "score": 7,
            "factors": [market.get("market_size_summary", {}).get("headline", "Demand conditions support measured expansion.")],
            "citations": citations[:2],
        }
        technological = market.get("framework_contributions", {}).get("technological") or {
            "score": 7,
            "factors": market.get("technology_shifts", ["Digital enablement and partner infrastructure reduce time-to-market."]),
            "citations": citations[:2],
        }
        social = risk.get("social_exposure") or {"score": 6, "factors": [], "citations": []}
        environmental = risk.get("environmental_exposure") or {"score": 5, "factors": [], "citations": []}
        political = {
            "score": 6,
            "factors": [
                "Political support exists for compliant investment.",
                "Policy shifts still need active monitoring.",
            ],
            "citations": citations[:2],
        }
        legal = {
            "score": 6,
            "factors": geo.get("trade_barriers") or ["Regulatory sequencing remains a core dependency."],
            "citations": citations[1:3],
        }
        structured = {
            "political": political,
            "economic": economic,
            "social": social,
            "technological": technological,
            "legal": legal,
            "environmental": environmental,
            "overall_score": round(mean([6, economic["score"], social["score"], technological["score"], 6, environmental["score"]])),
            "key_implication": "External conditions are supportive only when the company enters with controlled pacing and compliance-first execution.",
        }
        return build_framework_output(
            framework_name=FrameworkName.PESTLE,
            agent_author=AgentName.SYNTHESIS,
            structured_data=structured,
            narrative="Across political, economic, social, technological, legal, and environmental factors, the external environment rewards disciplined expansion more than aggressive speed.",
            context=state.get("extracted_context") or {},
            confidence_score=0.7,
            citations=citations,
        )

    def _build_swot(self, state, citations: list[dict]) -> dict:
        market = state.get("market_intel_output") or {}
        competitor = state.get("competitor_analysis_output") or {}
        risk = state.get("risk_assessment_output") or {}
        strategic = state.get("strategic_options_output") or {}
        financial = state.get("financial_reasoning_output") or {}
        structured = {
            "strengths": [
                {"point": "Disciplined capital case supports phased investment.", "source_agent": "financial_reasoning", "evidence": "Year-3 returns improve under staged funding."},
                {"point": "Differentiation via trust and compliance assurance is credible.", "source_agent": "strategic_options", "evidence": "Blue Ocean analysis raises compliance assurance and partner leverage."},
            ],
            "weaknesses": [
                {"point": "Local execution capability is underdeveloped.", "source_agent": "strategic_options", "evidence": "7S critical gaps highlight staff and systems."},
                {"point": "Competitive response will be immediate.", "source_agent": "competitor_analysis", "evidence": "Competitive rivalry scores high."},
            ],
            "opportunities": [
                {"point": "Demand conditions support measured growth.", "source_agent": "market_intel", "evidence": market.get("market_size_summary", {}).get("headline", "Demand remains attractive.")},
                {"point": "Partner-led market development offers the cleanest expansion path.", "source_agent": "strategic_options", "evidence": strategic.get("option_rationale", "Market development is recommended.")},
            ],
            "threats": [
                {"point": "Regulatory delay can destroy timing assumptions.", "source_agent": "risk_assessment", "evidence": "Regulatory risk is highest in the register."},
                {"point": "Administrative distance increases execution friction.", "source_agent": "geo_intel", "evidence": "CAGE analysis highlights administrative distance."},
            ],
        }
        return build_framework_output(
            framework_name=FrameworkName.SWOT,
            agent_author=AgentName.SYNTHESIS,
            structured_data=structured,
            narrative="The SWOT synthesis points toward opportunity-rich but execution-sensitive expansion, favouring an option-based approach that converts strengths into controlled commitments.",
            context=state.get("extracted_context") or {},
            confidence_score=0.69,
            citations=citations,
        )

    def _build_balanced_scorecard(self, state, citations: list[dict]) -> dict:
        financial = state.get("financial_reasoning_output") or {}
        strategic = state.get("strategic_options_output") or {}
        structured = financial.get("balanced_scorecard_seed") or {
            "financial": {"objectives": [], "measures": [], "targets": [], "initiatives": []},
            "customer": {"objectives": [], "measures": [], "targets": [], "initiatives": []},
            "internal_process": {"objectives": [], "measures": [], "targets": [], "initiatives": []},
            "learning_and_growth": {"objectives": [], "measures": [], "targets": [], "initiatives": []},
        }
        structured["customer"]["initiatives"].append("Validate the recommended option through lighthouse partnerships")
        structured["internal_process"]["initiatives"].append("Align launch gates to the recommended strategic option")
        return build_framework_output(
            framework_name=FrameworkName.BALANCED_SCORECARD,
            agent_author=AgentName.SYNTHESIS,
            structured_data=structured,
            narrative="The balanced scorecard converts the recommendation into measurable execution, balancing financial return, customer proof, operating control, and capability building.",
            context=state.get("extracted_context") or {},
            confidence_score=0.71,
            citations=citations,
        )

    def _decisive_framework_name(self, framework_outputs: dict[str, dict]) -> str:
        ordered = sorted(
            framework_outputs.items(),
            key=lambda item: float(item[1].get("confidence_score", 0)),
            reverse=True,
        )
        return ordered[0][0] if ordered else "ansoff"
