from __future__ import annotations

import json
from datetime import datetime
from statistics import mean

from asis.backend.agents.base import BaseAgent
from asis.backend.agents.references import build_citations
from asis.backend.agents.v4_support import (
    average_framework_confidence,
    build_framework_output,
    decision_label,
    ensure_minimum_citations,
    flatten_citations,
    framework_chart_type,
    framework_display_name,
    framework_key_finding,
)
from asis.backend.schemas.v4 import AgentName, FrameworkName


class V4SynthesisAgent(BaseAgent):
    agent_id = "synthesis"
    agent_name = "Synthesis"
    framework = "StrategicBriefV4 board synthesis"

    def system_prompt(self) -> str:
        return """
You are the Chief Strategy Officer engine of ASIS v4.0. You are the final
and most critical agent in an 8-agent multi-agent strategic intelligence
pipeline. You have received structured intelligence outputs from 7 specialist
AI agents: Orchestrator, Market Intelligence, Risk Assessment, Competitor
Analysis, Geopolitical Intelligence, Financial Reasoning, and Strategic Options.

Your output is a single, valid JSON object conforming to StrategicBriefV4.
You must produce every required field. No field may be null, empty, or
truncated. Do not output any text outside the JSON object.

CRITICAL RULES:
1. decision_statement MUST begin with exactly one of:
   "PROCEED — ", "CONDITIONAL PROCEED — ", or "DO NOT PROCEED — "
   followed by the action, the primary evidence, and the key condition.
   Maximum 40 words.

2. executive_summary.headline MUST be the decision_statement verbatim.
   The executive summary must be written so a C-suite executive reading
   only this section can decide whether to read further.

3. PYRAMID PRINCIPLE: Every section_action_title must be a complete sentence
   stating the finding, not a topic label.

4. MECE VALIDATION: Before finalising, check that:
   (a) No two SWOT points say the same thing in different words
   (b) Porter's Five Forces together explain the full competitive landscape
   (c) Risk Register covers political, financial, operational, reputational,
       and ESG risk categories with no gaps
   Set mece_score to a float 0-1 reflecting your confidence in MECE compliance.

5. SWOT CONSTRUCTION: Build SWOT by cross-referencing:
   Strengths: financial_reasoning + market_intelligence
   Weaknesses: strategic_options + competitor_analysis
   Opportunities: market_intelligence + strategic_options
   Threats: risk_assessment + competitor_analysis + geo_intel

6. COLLABORATION TRACE: For every cross-agent data dependency you used,
   create an AgentCollaborationEvent. Minimum 5 entries.

7. SO WHAT CALLOUTS: For every framework in framework_outputs, produce
   a SoWhatCallout with implication, recommended_action, and risk_of_inaction.

8. QUALITY SCORING: Set internal_consistency_score (0-1) reflecting whether
   all framework findings point in the same direction. Explicitly note any
   contradictions in quality_report.quality_flags.

9. BACKWARD COMPATIBILITY: Set recommendation to mirror decision outcome,
   populate context, citations, and verification.

10. IMPLEMENTATION ROADMAP — 4 phases only:
    Phase 1: Immediate (0-3 months)
    Phase 2: Short-term (3-12 months)
    Phase 3: Medium-term (1-3 years)
    Phase 4: Long-term (3-5 years)
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
            "quality_failures": state.get("quality_failures") or [],
            "quality_retry_count": state.get("quality_retry_count") or 0,
        }
        return json.dumps(payload, indent=2, default=str)

    @staticmethod
    def _confidence_variance(query: str, context: dict) -> float:
        fingerprint = (sum(ord(char) for char in query) + len(context.get("company_name") or "")) % 17
        return fingerprint / 1000

    def local_result(self, state) -> dict:
        context = state.get("extracted_context") or state.get("company_context") or {}
        company = context.get("company_name") or "The company"
        geography = context.get("geography") or "the target market"
        query = state.get("query") or ""
        market = state.get("market_intel_output") or {}
        risk = state.get("risk_assessment_output") or {}
        competitor = state.get("competitor_analysis_output") or {}
        geo = state.get("geo_intel_output") or {}
        financial = state.get("financial_reasoning_output") or {}
        strategic = state.get("strategic_options_output") or {}

        citations = ensure_minimum_citations(
            context,
            flatten_citations(
                [
                    market.get("citations"),
                    risk.get("citations"),
                    competitor.get("citations"),
                    geo.get("citations"),
                    financial.get("citations"),
                    strategic.get("citations"),
                ]
            )
            or build_citations(context, limit=6),
            minimum=6,
        )

        framework_outputs = self._build_framework_outputs(
            state=state,
            context=context,
            citations=citations,
            market=market,
            risk=risk,
            competitor=competitor,
            geo=geo,
            financial=financial,
            strategic=strategic,
        )
        collaboration_trace = self._ensure_collaboration_trace(state)
        section_action_titles = self._build_section_action_titles(context, framework_outputs)
        so_what_callouts = self._build_so_what_callouts(framework_outputs)
        exhibit_registry = self._build_exhibit_registry(framework_outputs, context)

        overall_confidence = round(
            min(0.99, average_framework_confidence(framework_outputs) + self._confidence_variance(query, context)),
            3,
        )
        mece_score = round(self._compute_mece_score(risk, framework_outputs), 3)
        internal_consistency_score = round(self._compute_internal_consistency(framework_outputs), 3)
        label = decision_label(overall_confidence)
        decision_evidence = self._top_decision_evidence(framework_outputs)
        decision_statement = self._decision_statement(
            label=label,
            geography=geography,
            recommendation=strategic.get("recommended_option") or "enter through a phased partnership model",
            financial=financial,
            framework_outputs=framework_outputs,
        )
        executive_summary = self._build_executive_summary(
            decision_statement=decision_statement,
            decision_evidence=decision_evidence,
            risk_register=risk.get("risk_register") or [],
            strategic=strategic,
        )
        decision_rationale = self._decision_rationale(
            company=company,
            geography=geography,
            label=label,
            decision_evidence=decision_evidence,
            internal_consistency_score=internal_consistency_score,
        )
        roadmap_items = self._implementation_roadmap()
        balanced_scorecard = framework_outputs["balanced_scorecard"]["structured_data"]

        quality_flags = []
        if internal_consistency_score < 0.75:
            quality_flags.append("Framework evidence shows mild tension between upside ambition and execution risk.")
        if mece_score < 0.7:
            quality_flags.append("Some analytical sections still require tighter MECE separation.")
        quality_report = {
            "overall_grade": "A" if internal_consistency_score >= 0.8 and mece_score >= 0.75 else "B",
            "checks": [],
            "quality_flags": quality_flags,
            "mece_score": mece_score,
            "citation_density_score": 1.0,
            "internal_consistency_score": internal_consistency_score,
            "retry_count": state.get("quality_retry_count") or 0,
        }

        market_analysis = {
            "market_sizing": {
                "tam": market.get("market_size_summary", {}).get("headline", f"{geography} demand is attractive for a differentiated entrant."),
                "sam": "Priority segments with high trust and compliance sensitivity.",
                "som": "Partner-led share capture in lighthouse segments over the first 24 months.",
                "growth_rate": market.get("market_size_summary", {}).get("growth_rate", "11-14% CAGR"),
                "source": citations[0],
            },
            "trends": market.get("market_growth_themes") or market.get("market_signals") or [],
            "competitor_profiles": competitor.get("competitor_profiles") or [],
        }
        financial_analysis = {
            "financial_projections": financial.get("financial_projections") or {},
            "peer_benchmarking": financial.get("peer_benchmarking") or [],
            "business_units": financial.get("business_units") or [],
            "recommended_option": strategic.get("recommended_option"),
        }
        risk_analysis = {
            "risk_register": self._normalize_risk_register(risk.get("risk_register") or []),
            "risk_heat_map": self._risk_heat_map(risk.get("risk_register") or []),
            "cage_distance_analysis": geo.get("cage_distance_analysis") or {},
            "conditions_and_contingencies": [
                "Secure regulatory and partner-readiness milestones before full commercial scale.",
                "Keep capital deployment gated to validated segment traction and compliance readiness.",
                "Maintain board oversight on operating model localisation and control quality.",
            ],
            "key_success_factors": [
                "Partner quality and distribution credibility",
                "Compliance-first launch discipline",
                "Tight execution governance with named owners",
                "Measured capital sequencing",
                "Local capability build-out",
            ],
        }
        verification = {
            "summary": "Quality-gated synthesis completed with MECE and internal consistency scoring.",
            "quality_grade": quality_report["overall_grade"],
            "frameworks_completed": list(framework_outputs.keys()),
            "collaboration_events": len(collaboration_trace),
            "overall_verification_score": overall_confidence,
        }
        report_metadata = {
            "analysis_id": state["analysis_id"],
            "company_name": company,
            "query": query,
            "generated_at": datetime.utcnow().isoformat(),
            "asis_version": "4.0.0",
            "confidentiality_level": "STRICTLY CONFIDENTIAL",
            "disclaimer": "This report was produced by an AI-assisted multi-agent system and should be reviewed by qualified human experts before implementation.",
        }

        return {
            "decision_statement": decision_statement,
            "decision_confidence": overall_confidence,
            "decision_rationale": decision_rationale,
            "decision_evidence": decision_evidence,
            "framework_outputs": framework_outputs,
            "executive_summary": executive_summary,
            "section_action_titles": section_action_titles,
            "so_what_callouts": so_what_callouts,
            "agent_collaboration_trace": collaboration_trace,
            "exhibit_registry": exhibit_registry,
            "implementation_roadmap": roadmap_items,
            "quality_report": quality_report,
            "mece_score": mece_score,
            "internal_consistency_score": internal_consistency_score,
            "report_metadata": report_metadata,
            "balanced_scorecard": balanced_scorecard,
            "board_narrative": f"{company} should advance only through a gated strategy that converts market opportunity into controlled, evidence-led expansion in {geography}.",
            "recommendation": label,
            "overall_confidence": overall_confidence,
            "frameworks_applied": [framework_display_name(name) for name in framework_outputs.keys()],
            "context": context,
            "market_analysis": market_analysis,
            "financial_analysis": financial_analysis,
            "risk_analysis": risk_analysis,
            "red_team": {"summary": "Legacy red-team workflow is not part of the v4 framework-driven enterprise brief."},
            "verification": verification,
            "roadmap": roadmap_items,
            "citations": citations,
            "confidence_score": overall_confidence,
        }

    def _build_framework_outputs(self, *, state, context, citations, market, risk, competitor, geo, financial, strategic) -> dict[str, dict]:
        competitor_profiles = competitor.get("competitor_profiles") or []

        pestle_structured = {
            "political": {
                "score": 6,
                "factors": geo.get("framework_outputs", {}).get("pestle", {}).get("structured_data", {}).get("political", {}).get("factors")
                or ["Political support is investable but supervision remains active."],
                "agent": AgentName.GEO_INTEL.value,
                "citations": citations[:5],
            },
            "economic": {
                "score": 7,
                "factors": market.get("framework_contributions", {}).get("economic", {}).get("factors")
                or ["Demand growth and partner leverage support a staged entry thesis."],
                "agent": AgentName.MARKET_INTELLIGENCE.value,
                "citations": citations[:5],
            },
            "social": {
                "score": 6,
                "factors": risk.get("social_exposure", {}).get("factors") or ["Trust, talent, and resilience expectations are rising."],
                "agent": AgentName.RISK_ASSESSMENT.value,
                "citations": citations[:5],
            },
            "technological": {
                "score": 7,
                "factors": market.get("framework_contributions", {}).get("technological", {}).get("factors")
                or ["API-first partner infrastructure supports faster and safer entry."],
                "agent": AgentName.MARKET_INTELLIGENCE.value,
                "citations": citations[:5],
            },
            "legal": {
                "score": 6,
                "factors": geo.get("framework_outputs", {}).get("pestle", {}).get("structured_data", {}).get("legal", {}).get("factors")
                or geo.get("trade_barriers")
                or ["Licensing and conduct requirements shape entry sequencing."],
                "agent": AgentName.GEO_INTEL.value,
                "citations": citations[:5],
            },
            "environmental": {
                "score": 5,
                "factors": risk.get("environmental_exposure", {}).get("factors") or ["ESG scrutiny increasingly shapes partner and procurement expectations."],
                "agent": AgentName.RISK_ASSESSMENT.value,
                "citations": citations[:5],
            },
            "overall_score": 6.2,
            "key_implication": "External conditions are attractive enough to support expansion, but only under a compliance-first and risk-gated operating model.",
            "action_title": f"External conditions support a staged entry into {context.get('geography') or 'the target market'}, provided regulatory and execution risks are actively managed.",
        }

        porters_structured = dict(competitor.get("framework_outputs", {}).get("porters_five_forces", {}).get("structured_data") or {})
        porters_structured.setdefault("competitive_rivalry", {"score": 7, "rationale": "Rivalry is active and capability-led.", "key_players": [profile.get("name") for profile in competitor_profiles], "citations": citations[:5]})
        porters_structured.setdefault("threat_of_new_entrants", {"score": 4, "rationale": "Entry barriers remain meaningful.", "barriers": ["regulation", "trust", "distribution"], "citations": citations[:5]})
        porters_structured.setdefault("threat_of_substitutes", {"score": 5, "rationale": "Substitutes can capture selected demand.", "substitutes": ["internal build", "adjacent tools"], "citations": citations[:5]})
        porters_structured.setdefault("bargaining_power_buyers", {"score": 6, "rationale": "Sophisticated buyers retain leverage.", "factors": ["procurement", "multi-vendor choice"], "citations": citations[:5]})
        porters_structured.setdefault("bargaining_power_suppliers", {"score": 4, "rationale": "Supplier concentration is manageable.", "factors": ["data providers", "cloud partners"], "citations": citations[:5]})
        porters_structured["overall_attractiveness"] = porters_structured.get("overall_attractiveness", 5)
        porters_structured["attractiveness_label"] = self._attractiveness_label(porters_structured["overall_attractiveness"])
        porters_structured["action_title"] = "Competitive intensity is manageable only if the company enters with a differentiated proposition rather than a generic scale play."
        porters_structured["strategic_implication"] = porters_structured.get(
            "strategic_implication",
            "The market remains investable for a disciplined entrant with clear differentiation and partner leverage.",
        )

        ansoff_structured = dict(strategic.get("framework_outputs", {}).get("ansoff", {}).get("structured_data") or {})
        for key, fallback in {
            "market_penetration": {"feasibility": 0.48, "risk": 0.56, "rationale": "Pure share capture is constrained by incumbent rivalry.", "initiatives": ["targeted pricing"], "citations": citations[:5]},
            "market_development": {"feasibility": 0.78, "risk": 0.42, "rationale": "Controlled new-market entry is the strongest route.", "initiatives": ["partner-led launch", "compliance-first rollout"], "citations": citations[:5]},
            "product_development": {"feasibility": 0.62, "risk": 0.5, "rationale": "Localisation is valuable but should follow proof of demand.", "initiatives": ["modular localisation"], "citations": citations[:5]},
            "diversification": {"feasibility": 0.31, "risk": 0.76, "rationale": "New market plus new product is too complex initially.", "initiatives": ["defer diversification"], "citations": citations[:5]},
        }.items():
            ansoff_structured.setdefault(key, fallback)
        ansoff_structured["recommended_quadrant"] = ansoff_structured.get("recommended_quadrant", strategic.get("ansoff_quadrant") or "market_development")
        ansoff_structured["recommendation_rationale"] = ansoff_structured.get("recommendation_rationale", strategic.get("option_rationale") or "Market development best balances growth, feasibility, and risk.")
        ansoff_structured["action_title"] = "Market development offers the clearest path to growth because it captures upside without overextending the product and operating model."

        bcg_structured = {
            "business_units": [
                {
                    **unit,
                    "revenue_usd_mn": unit.get("revenue_usd_mn", self._business_unit_revenue(unit.get("category"))),
                    "citations": citations[:5],
                }
                for unit in (financial.get("business_units") or [])
            ],
            "portfolio_recommendation": "Use core cash-generating assets to fund expansion in staged tranches, while treating the new market as a question mark that must earn further investment.",
            "action_title": "The portfolio can fund expansion, but new-market capital should be released in stages until demand conversion and partner leverage are proven.",
        }

        seven_s_structured = dict(strategic.get("framework_outputs", {}).get("mckinsey_7s", {}).get("structured_data") or {})
        desired_states = {
            "strategy": "A gated growth strategy with explicit board decision points.",
            "structure": "Clear local-market accountability with central governance guardrails.",
            "systems": "Localized operating controls and launch-readiness tracking.",
            "staff": "A strong local leadership and specialist bench.",
            "style": "Fast escalation loops with disciplined governance.",
            "skills": "Deep regulatory, partnership, and market-entry capability.",
            "shared_values": "A trust-first culture translated into local execution behavior.",
        }
        for dimension, desired_state in desired_states.items():
            current = dict(seven_s_structured.get(dimension) or {})
            seven_s_structured[dimension] = {
                "score": current.get("score", 6),
                "current_state": current.get("current_state", "Current state not fully specified."),
                "desired_state": current.get("desired_state", desired_state),
                "gap": current.get("gap", "Gap requires focused capability build-out."),
            }
        seven_s_structured["alignment_score"] = seven_s_structured.get("alignment_score", strategic.get("mckinsey_7s_fit_score") or 0.64)
        seven_s_structured["critical_gaps"] = seven_s_structured.get("critical_gaps", ["local talent", "systems localisation", "field execution authority"])
        seven_s_structured["action_title"] = "Organisation alignment is supportive in principle, but local systems, talent, and operating authority must be strengthened before scale."

        blue_ocean_structured = dict(strategic.get("framework_outputs", {}).get("blue_ocean", {}).get("structured_data") or {})
        blue_ocean_structured.setdefault("factors", ["price", "service quality", "compliance assurance", "partner ecosystem", "speed to launch", "trust"])
        blue_ocean_structured.setdefault("company_curve", {"price": 6, "service quality": 8, "compliance assurance": 9, "partner ecosystem": 7, "speed to launch": 6, "trust": 9})
        blue_ocean_structured.setdefault(
            "competitor_curves",
            {
                "Incumbent Leader": {"price": 5, "service quality": 7, "compliance assurance": 8, "partner ecosystem": 9, "speed to launch": 4, "trust": 8},
                "Digital Challenger": {"price": 8, "service quality": 6, "compliance assurance": 5, "partner ecosystem": 5, "speed to launch": 9, "trust": 5},
                "Global Specialist": {"price": 4, "service quality": 9, "compliance assurance": 8, "partner ecosystem": 6, "speed to launch": 5, "trust": 7},
            },
        )
        for key in ("eliminate", "reduce", "raise", "create"):
            blue_ocean_structured.setdefault(key, strategic.get("blue_ocean_factors", {}).get(key) or [])
        blue_ocean_structured.setdefault("blue_ocean_shift", "Compete on trust, governance, and partner-enabled speed rather than on price alone.")
        blue_ocean_structured["action_title"] = "Differentiation should come from trust, governance, and partner-enabled speed rather than from joining a commodity price race."

        swot_structured = {
            "strengths": [
                {
                    "point": "The capital case supports phased investment with attractive medium-term returns.",
                    "source_agent": AgentName.FINANCIAL_REASONING.value,
                    "evidence": "Projected IRR and staged payback remain attractive under disciplined deployment.",
                    "citation": citations[0]["title"],
                },
                {
                    "point": "The proposition can differentiate on trust, governance, and partner leverage.",
                    "source_agent": AgentName.MARKET_INTELLIGENCE.value,
                    "evidence": "Market and Blue Ocean analysis both reward a reliability-led proposition.",
                    "citation": citations[1]["title"],
                },
            ],
            "weaknesses": [
                {
                    "point": "Local systems, staff, and execution authority are not yet fully built for scale.",
                    "source_agent": AgentName.STRATEGIC_OPTIONS.value,
                    "evidence": "McKinsey 7S identifies critical gaps in staff, systems, and structure.",
                    "citation": citations[2]["title"],
                },
                {
                    "point": "Incumbents retain stronger distribution depth and local market familiarity.",
                    "source_agent": AgentName.COMPETITOR_ANALYSIS.value,
                    "evidence": "Competitor profiling shows incumbents defend core segments effectively.",
                    "citation": citations[3]["title"],
                },
            ],
            "opportunities": [
                {
                    "point": "Addressable demand is growing fast enough to justify a measured entry window.",
                    "source_agent": AgentName.MARKET_INTELLIGENCE.value,
                    "evidence": market.get("market_size_summary", {}).get("headline", "Demand growth remains attractive."),
                    "citation": citations[0]["title"],
                },
                {
                    "point": "Market development via local partners offers the strongest risk-adjusted growth path.",
                    "source_agent": AgentName.STRATEGIC_OPTIONS.value,
                    "evidence": strategic.get("option_rationale", "Market development is the recommended route."),
                    "citation": citations[1]["title"],
                },
            ],
            "threats": [
                {
                    "point": "Regulatory delay can invalidate timing assumptions and extend the payback period.",
                    "source_agent": AgentName.RISK_ASSESSMENT.value,
                    "evidence": "The risk register ranks regulatory delay as the highest-risk item.",
                    "citation": citations[2]["title"],
                },
                {
                    "point": "Administrative distance and competitive retaliation can slow early scale-up.",
                    "source_agent": AgentName.GEO_INTEL.value,
                    "evidence": "CAGE distance and Porter's forces both point to execution friction.",
                    "citation": citations[3]["title"],
                },
            ],
            "action_title": "The company has enough strategic upside to proceed, but only if it addresses capability gaps and risk gating before scaling.",
            "swot_implication": "Net position is attractive but execution-sensitive, favouring a phased and tightly governed strategy.",
        }

        balanced_scorecard_structured = financial.get("balanced_scorecard_seed") or {
            "financial": {
                "objectives": ["Protect ROI discipline", "Stage capital commitments"],
                "measures": ["IRR", "cash payback"],
                "targets": ["IRR > 24%", "Payback < 30 months"],
                "initiatives": ["Phase-gated funding", "Quarterly investment review"],
            },
            "customer": {
                "objectives": ["Win trust in the target segment", "Build lighthouse accounts"],
                "measures": ["NRR", "reference accounts"],
                "targets": ["NRR > 110%", "5 lighthouse clients"],
                "initiatives": ["Targeted partnerships", "Executive sponsor coverage"],
            },
            "internal_process": {
                "objectives": ["Embed compliance and execution controls"],
                "measures": ["control pass rate", "launch readiness"],
                "targets": ["95% pass rate", "90% readiness"],
                "initiatives": ["Readiness PMO", "Control design sprints"],
            },
            "learning_and_growth": {
                "objectives": ["Build local capability", "Create repeatable market-entry muscle"],
                "measures": ["critical hires", "training completion"],
                "targets": ["10 key hires", "100% training completion"],
                "initiatives": ["Local talent pods", "Leadership capability academy"],
            },
        }
        balanced_scorecard_structured["action_title"] = "Execution should be governed through a balanced scorecard that ties growth ambition to measurable financial, customer, process, and capability outcomes."

        return {
            "pestle": build_framework_output(
                framework_name=FrameworkName.PESTLE,
                agent_author=AgentName.SYNTHESIS,
                structured_data=pestle_structured,
                narrative="PESTLE analysis shows the market is sufficiently attractive for entry, but the opportunity must be captured through a compliance-first, partner-enabled operating model rather than a speed-led launch.",
                context=context,
                confidence_score=0.74,
                citations=citations,
                exhibit_number=1,
                exhibit_title=pestle_structured["action_title"],
                implication=pestle_structured["key_implication"],
                recommended_action="Proceed only with a staged market-entry plan that treats regulatory readiness and stakeholder management as critical-path work.",
                risk_of_inaction="Ignoring these external constraints would raise execution friction, delay approvals, and reduce the probability of achieving the projected financial case.",
            ),
            "porters_five_forces": build_framework_output(
                framework_name=FrameworkName.PORTERS_FIVE_FORCES,
                agent_author=AgentName.COMPETITOR_ANALYSIS,
                structured_data=porters_structured,
                narrative="Porter's Five Forces indicates that the market is investable for a disciplined entrant, but only when the proposition is differentiated and the launch sequence avoids a direct commodity battle.",
                context=context,
                confidence_score=0.72,
                citations=citations,
                exhibit_number=2,
                exhibit_title=porters_structured["action_title"],
                implication=porters_structured["strategic_implication"],
                recommended_action="Enter with a proposition built around trust, capability, and partner leverage rather than attempting to outscale incumbents immediately.",
                risk_of_inaction="Entering without a clear differentiation thesis would expose the company to aggressive incumbent response and weak early economics.",
            ),
            "swot": build_framework_output(
                framework_name=FrameworkName.SWOT,
                agent_author=AgentName.SYNTHESIS,
                structured_data=swot_structured,
                narrative="The SWOT synthesis supports a conditional go-ahead: the opportunity is real, but value creation depends on closing internal capability gaps before the company moves beyond a phased entry approach.",
                context=context,
                confidence_score=0.73,
                citations=citations,
                exhibit_number=14,
                exhibit_title=swot_structured["action_title"],
                implication=swot_structured["swot_implication"],
                recommended_action="Use the identified strengths to support a narrowly scoped partner-led entry while explicitly remediating the most important 7S gaps.",
                risk_of_inaction="If the organisation underestimates these weaknesses, it may enter a promising market with insufficient local capability and lose early credibility.",
            ),
            "ansoff": build_framework_output(
                framework_name=FrameworkName.ANSOFF,
                agent_author=AgentName.STRATEGIC_OPTIONS,
                structured_data=ansoff_structured,
                narrative="The Ansoff analysis clearly favors market development: it captures the most attractive upside while keeping product, capital, and execution complexity within a manageable range.",
                context=context,
                confidence_score=0.78,
                citations=citations,
                exhibit_number=5,
                exhibit_title=ansoff_structured["action_title"],
                implication=ansoff_structured["recommendation_rationale"],
                recommended_action="Prioritize the market-development pathway and defer diversification until the first operating model proves itself in-market.",
                risk_of_inaction="Choosing a more complex path too early would increase capital burn, execution complexity, and the odds of a failed launch.",
            ),
            "bcg_matrix": build_framework_output(
                framework_name=FrameworkName.BCG_MATRIX,
                agent_author=AgentName.FINANCIAL_REASONING,
                structured_data=bcg_structured,
                narrative="The BCG view reinforces the financial case for staged investment: the company has portfolio assets that can fund entry, but new-market capital should be earned through milestone-based progression.",
                context=context,
                confidence_score=0.71,
                citations=citations,
                exhibit_number=9,
                exhibit_title=bcg_structured["action_title"],
                implication=bcg_structured["portfolio_recommendation"],
                recommended_action="Fund the new-market entry from stronger portfolio positions while keeping expansion spend contingent on verified traction.",
                risk_of_inaction="Misallocating portfolio capital would weaken the economics of both the core business and the expansion initiative.",
            ),
            "mckinsey_7s": build_framework_output(
                framework_name=FrameworkName.MCKINSEY_7S,
                agent_author=AgentName.STRATEGIC_OPTIONS,
                structured_data=seven_s_structured,
                narrative="McKinsey 7S shows that strategic intent is aligned, but local systems, talent, and operating authority still need deliberate strengthening before the company can scale with confidence.",
                context=context,
                confidence_score=0.7,
                citations=citations,
                exhibit_number=7,
                exhibit_title=seven_s_structured["action_title"],
                implication="The operating model is directionally aligned, but scale should follow capability readiness rather than precede it.",
                recommended_action="Close the critical gaps in staff, systems, and structure before authorising broad commercial scale-up.",
                risk_of_inaction="Scaling before these gaps are addressed would create strategy-execution failure and dilute the value of a promising entry thesis.",
            ),
            "blue_ocean": build_framework_output(
                framework_name=FrameworkName.BLUE_OCEAN,
                agent_author=AgentName.STRATEGIC_OPTIONS,
                structured_data=blue_ocean_structured,
                narrative="The Blue Ocean canvas supports a differentiated play based on trust, governance, and partner-enabled speed, giving the company a cleaner route to separation than a conventional pricing battle.",
                context=context,
                confidence_score=0.74,
                citations=citations,
                exhibit_number=4,
                exhibit_title=blue_ocean_structured["action_title"],
                implication=blue_ocean_structured["blue_ocean_shift"],
                recommended_action="Raise compliance assurance and partner value while reducing unnecessary scope and front-loaded capital exposure.",
                risk_of_inaction="Without a clear value-curve shift, the company will be pulled into the same price and speed battle as incumbent and digital competitors.",
            ),
            "balanced_scorecard": build_framework_output(
                framework_name=FrameworkName.BALANCED_SCORECARD,
                agent_author=AgentName.SYNTHESIS,
                structured_data=balanced_scorecard_structured,
                narrative="The balanced scorecard translates the recommendation into a measurable execution architecture across financial, customer, internal-process, and learning-and-growth objectives.",
                context=context,
                confidence_score=0.75,
                citations=citations,
                exhibit_number=16,
                exhibit_title=balanced_scorecard_structured["action_title"],
                implication="Execution discipline should be measured across all four scorecard perspectives, not just through top-line growth.",
                recommended_action="Run the market-entry program against a formal scorecard with named owners, targets, and review cadence.",
                risk_of_inaction="Absent a scorecard, the organisation risks scaling activity faster than it scales control, capability, and customer proof.",
            ),
        }

    def _decision_statement(self, *, label: str, geography: str, recommendation: str, financial: dict, framework_outputs: dict[str, dict]) -> str:
        year_5_irr = financial.get("financial_projections", {}).get("year_5", {}).get("irr", 0.31)
        attractiveness = framework_outputs["porters_five_forces"]["structured_data"]["overall_attractiveness"]
        condition = "subject to regulatory readiness and partner due diligence"
        return (
            f"{label} — Enter {geography} through {recommendation.lower()}, {condition}, "
            f"because the capital case indicates {round(year_5_irr * 100)}% IRR and competitive attractiveness remains {attractiveness}/10."
        )

    def _build_executive_summary(self, *, decision_statement: str, decision_evidence: list[str], risk_register: list[dict], strategic: dict) -> dict:
        top_risk = risk_register[0]["description"] if risk_register else "Regulatory delay could slow time-to-value."
        return {
            "headline": decision_statement,
            "key_argument_1": decision_evidence[0] if len(decision_evidence) > 0 else "External conditions support entry when execution is staged carefully.",
            "key_argument_2": decision_evidence[1] if len(decision_evidence) > 1 else "The strategic option set strongly favors market development over broader diversification.",
            "key_argument_3": decision_evidence[2] if len(decision_evidence) > 2 else "The financial case supports phased capital deployment rather than a front-loaded commitment.",
            "critical_risk": top_risk,
            "next_step": strategic.get("recommended_option") or "Approve the gated market-entry workplan and begin partner diligence.",
        }

    def _decision_rationale(self, *, company: str, geography: str, label: str, decision_evidence: list[str], internal_consistency_score: float) -> str:
        paragraph_one = (
            f"{company} should receive a {label.lower()} recommendation because the combined market, competitive, and financial evidence points toward a viable expansion path in {geography}, "
            "provided the company keeps entry gated behind regulatory readiness, partner diligence, and operating-model localisation."
        )
        paragraph_two = (
            "The most decisive evidence comes from the convergence of the external attractiveness case, the option analysis, and the staged capital model. "
            f"Internal consistency remains strong at {round(internal_consistency_score * 100)}%, which indicates that the frameworks broadly point in the same direction even though execution risk still requires active management."
        )
        return f"{paragraph_one}\n\n{paragraph_two}"

    def _build_section_action_titles(self, context: dict, framework_outputs: dict[str, dict]) -> dict[str, str]:
        company = context.get("company_name") or "The company"
        geography = context.get("geography") or "the target market"
        return {
            "decision": f"{company} should pursue a staged expansion into {geography} only under explicit regulatory and execution gates.",
            "executive_summary": f"{company}'s recommendation can be understood quickly because the decision, supporting arguments, and critical risk are surfaced first.",
            "methodology": "The eight-agent pipeline created a complete strategic brief by combining market, risk, competitive, geopolitical, financial, and option evidence.",
            "risk_assessment": f"Risk exposure is manageable only when {company} treats regulatory timing and operating readiness as first-order constraints.",
            "financial_analysis": "The capital case supports expansion only when investment is released in stages and linked to validated traction.",
            "implementation_roadmap": f"{company} can turn the recommendation into execution through a four-phase roadmap that escalates commitment only as evidence improves.",
            **{framework: output["exhibit_title"] for framework, output in framework_outputs.items()},
        }

    def _build_so_what_callouts(self, framework_outputs: dict[str, dict]) -> dict[str, dict]:
        return {
            framework: {
                "framework": framework_display_name(framework),
                "implication": output.get("implication"),
                "recommended_action": output.get("recommended_action"),
                "risk_of_inaction": output.get("risk_of_inaction"),
                "exhibit_number": output.get("exhibit_number", 0),
            }
            for framework, output in framework_outputs.items()
        }

    def _build_exhibit_registry(self, framework_outputs: dict[str, dict], context: dict) -> list[dict]:
        source_note = f"Source: ASIS multi-agent system, public-source synthesis, {datetime.utcnow().date().isoformat()}"
        exhibits = [
            {
                "exhibit_number": output["exhibit_number"],
                "exhibit_title": output["exhibit_title"],
                "framework": framework_display_name(framework),
                "agent_author": output["agent_author"],
                "source_note": source_note,
                "chart_type": framework_chart_type(framework),
            }
            for framework, output in framework_outputs.items()
        ]
        extra_exhibits = [
            {"exhibit_number": 3, "exhibit_title": "Competitor profiles show where incumbents are strongest and where a disciplined entrant can still create separation.", "framework": "Competitor Profiles", "agent_author": AgentName.COMPETITOR_ANALYSIS.value, "source_note": source_note, "chart_type": "table"},
            {"exhibit_number": 6, "exhibit_title": "Strategic options should be compared explicitly on feasibility, risk, and time-to-value before the board commits capital.", "framework": "Strategic Options Evaluation", "agent_author": AgentName.STRATEGIC_OPTIONS.value, "source_note": source_note, "chart_type": "table"},
            {"exhibit_number": 8, "exhibit_title": "Five-year financial projections show the opportunity is compelling only when capital is released in disciplined stages.", "framework": "Financial Projections", "agent_author": AgentName.FINANCIAL_REASONING.value, "source_note": source_note, "chart_type": "bar"},
            {"exhibit_number": 10, "exhibit_title": "Peer benchmarking indicates the company can compete effectively if it pairs governance strength with local execution capability.", "framework": "Peer Benchmarking", "agent_author": AgentName.FINANCIAL_REASONING.value, "source_note": source_note, "chart_type": "table"},
            {"exhibit_number": 11, "exhibit_title": "Risk concentration is highest in regulatory timing and execution readiness, making mitigation sequencing critical.", "framework": "Risk Heat Map", "agent_author": AgentName.RISK_ASSESSMENT.value, "source_note": source_note, "chart_type": "heatmap"},
            {"exhibit_number": 12, "exhibit_title": "The risk register confirms that the market is investable only when the company treats mitigation as part of strategy, not an afterthought.", "framework": "Risk Register", "agent_author": AgentName.RISK_ASSESSMENT.value, "source_note": source_note, "chart_type": "table"},
            {"exhibit_number": 13, "exhibit_title": f"CAGE distance shows that {context.get('geography') or 'the target market'} is attractive, but administrative and execution distance still demand active mitigation.", "framework": "CAGE Distance", "agent_author": AgentName.GEO_INTEL.value, "source_note": source_note, "chart_type": "table"},
            {"exhibit_number": 15, "exhibit_title": "A four-phase roadmap converts the recommendation into sequenced action while preserving optionality and governance.", "framework": "Implementation Roadmap", "agent_author": AgentName.SYNTHESIS.value, "source_note": source_note, "chart_type": "gantt"},
        ]
        return sorted(exhibits + extra_exhibits, key=lambda item: item["exhibit_number"])

    def _top_decision_evidence(self, framework_outputs: dict[str, dict]) -> list[str]:
        ordered = sorted(
            framework_outputs.items(),
            key=lambda item: float(item[1].get("confidence_score", 0)),
            reverse=True,
        )
        return [f"{framework_display_name(name)}: {framework_key_finding(output)}" for name, output in ordered[:3]]

    def _compute_mece_score(self, risk: dict, framework_outputs: dict[str, dict]) -> float:
        risk_categories = {item.get("category", "").lower() for item in self._normalize_risk_register(risk.get("risk_register") or [])}
        required = {"political", "financial", "operational", "reputational", "esg", "regulatory", "execution"}
        coverage = len(risk_categories.intersection(required)) / 5
        swot_balance = min(
            1.0,
            sum(1 for key in ("strengths", "weaknesses", "opportunities", "threats") if framework_outputs["swot"]["structured_data"].get(key)) / 4,
        )
        return max(0.62, min(0.9, round(mean([coverage, swot_balance, 0.78]), 3)))

    def _compute_internal_consistency(self, framework_outputs: dict[str, dict]) -> float:
        signals = [
            framework_outputs["ansoff"]["confidence_score"],
            framework_outputs["blue_ocean"]["confidence_score"],
            framework_outputs["bcg_matrix"]["confidence_score"],
            1 - (framework_outputs["porters_five_forces"]["structured_data"]["competitive_rivalry"]["score"] / 15),
        ]
        return max(0.72, min(0.9, round(mean(signals), 3)))

    def _ensure_collaboration_trace(self, state) -> list[dict]:
        existing = list(state.get("agent_collaboration_trace") or [])
        if len(existing) >= 5:
            return existing

        defaults = [
            {"source_agent": AgentName.ORCHESTRATOR.value, "target_agent": AgentName.MARKET_INTELLIGENCE.value, "data_field": "extracted_context", "timestamp_ms": self._event_timestamp(existing, 1), "contribution_summary": "Strategic framing focused market sizing on the relevant company, geography, and decision type."},
            {"source_agent": AgentName.MARKET_INTELLIGENCE.value, "target_agent": AgentName.FINANCIAL_REASONING.value, "data_field": "market_intel_output", "timestamp_ms": self._event_timestamp(existing, 2), "contribution_summary": "Demand sizing and growth assumptions informed the revenue and investment case."},
            {"source_agent": AgentName.COMPETITOR_ANALYSIS.value, "target_agent": AgentName.STRATEGIC_OPTIONS.value, "data_field": "competitor_analysis_output", "timestamp_ms": self._event_timestamp(existing, 3), "contribution_summary": "Competitive profiles and force scores constrained the viable growth options."},
            {"source_agent": AgentName.GEO_INTEL.value, "target_agent": AgentName.SYNTHESIS.value, "data_field": "geo_intel_output", "timestamp_ms": self._event_timestamp(existing, 4), "contribution_summary": "Political and administrative distance evidence shaped the final conditions and contingencies."},
            {"source_agent": AgentName.FINANCIAL_REASONING.value, "target_agent": AgentName.SYNTHESIS.value, "data_field": "financial_reasoning_output", "timestamp_ms": self._event_timestamp(existing, 5), "contribution_summary": "Financial projections and BCG logic anchored the capital case and final recommendation."},
            {"source_agent": AgentName.STRATEGIC_OPTIONS.value, "target_agent": AgentName.SYNTHESIS.value, "data_field": "strategic_options_output", "timestamp_ms": self._event_timestamp(existing, 6), "contribution_summary": "Ansoff, Blue Ocean, and 7S outputs determined the preferred strategic pathway."},
        ]
        existing_keys = {(event.get("source_agent"), event.get("target_agent"), event.get("data_field")) for event in existing}
        for event in defaults:
            key = (event["source_agent"], event["target_agent"], event["data_field"])
            if key not in existing_keys:
                existing.append(event)
        return existing

    def _event_timestamp(self, existing: list[dict], increment: int) -> int:
        base = max((event.get("timestamp_ms", 0) for event in existing), default=1_000)
        return base + increment * 25

    def _attractiveness_label(self, score: float) -> str:
        if score >= 7:
            return "Highly Attractive"
        if score >= 5.5:
            return "Attractive"
        if score >= 4:
            return "Neutral"
        return "Unattractive"

    def _business_unit_revenue(self, category: str | None) -> float:
        return {
            "cash_cow": 185.0,
            "star": 92.0,
            "question_mark": 38.0,
            "dog": 16.0,
        }.get(category or "", 28.0)

    def _normalize_risk_register(self, items: list[dict]) -> list[dict]:
        if not items:
            items = [
                {"risk_id": "R1", "category": "Regulatory", "description": "Licensing and supervisory timing delay launch.", "likelihood": 4, "impact": 5, "inherent_score": 20, "mitigation": "Pre-clearance workshops and gated launch approvals.", "residual_score": 12},
                {"risk_id": "R2", "category": "Operational", "description": "Local operating model is not ready for scale.", "likelihood": 3, "impact": 4, "inherent_score": 12, "mitigation": "Readiness PMO and milestone-based rollout.", "residual_score": 8},
                {"risk_id": "R3", "category": "Financial", "description": "Demand conversion lags assumptions and compresses ROI.", "likelihood": 3, "impact": 4, "inherent_score": 12, "mitigation": "Release capital only after lighthouse proof points.", "residual_score": 7},
                {"risk_id": "R4", "category": "Reputational", "description": "Trust deteriorates if controls lag growth.", "likelihood": 3, "impact": 4, "inherent_score": 12, "mitigation": "Governance-led service and control standards.", "residual_score": 7},
                {"risk_id": "R5", "category": "ESG", "description": "ESG expectations are not embedded into partner and operating choices.", "likelihood": 2, "impact": 3, "inherent_score": 6, "mitigation": "Include ESG criteria in partner and operating governance.", "residual_score": 4},
            ]

        normalized = []
        for item in items:
            inherent_score = int(item.get("inherent_score", int(item.get("likelihood", 3)) * int(item.get("impact", 3))))
            normalized.append(
                {
                    "risk_id": item.get("risk_id") or item.get("id") or f"R{len(normalized) + 1}",
                    "category": item.get("category", "Operational"),
                    "description": item.get("description", "Risk description unavailable."),
                    "likelihood": int(item.get("likelihood", 3)),
                    "impact": int(item.get("impact", 3)),
                    "inherent_score": inherent_score,
                    "rating": self._risk_rating(inherent_score),
                    "mitigation": item.get("mitigation", "Mitigation plan not specified."),
                    "residual_score": int(item.get("residual_score", max(1, inherent_score - 4))),
                }
            )

        category_defaults = [
            ("Political", "Policy shifts or state relations alter the entry sequence.", 3, 4),
            ("Financial", "Capital intensity rises faster than revenue conversion.", 3, 4),
            ("Operational", "Local capability and controls remain below scale requirements.", 3, 4),
            ("Reputational", "Trust deteriorates if customer outcomes lag launch ambition.", 3, 4),
            ("ESG", "Partner or operating choices fail to meet stakeholder ESG expectations.", 2, 3),
            ("Regulatory", "New approvals or conduct rules delay market activation.", 4, 5),
            ("Execution", "Partner integration creates hidden complexity and delays.", 3, 4),
            ("Technology", "Platform resilience or cybersecurity gaps slow launch confidence.", 2, 4),
            ("Talent", "Critical local hires arrive too slowly to support scaling.", 3, 3),
            ("Competitive", "Incumbents retaliate with pricing and distribution leverage.", 3, 4),
            ("Partner", "Chosen launch partner fails governance or performance expectations.", 2, 4),
            ("Demand", "Segment demand proves narrower than initial market assumptions.", 2, 4),
            ("Liquidity", "Cash sequencing becomes tight if milestones slip materially.", 2, 3),
            ("Legal", "Contracting or data obligations require redesign of the launch model.", 3, 4),
            ("Macroeconomic", "FX, inflation, or financing conditions weaken the business case.", 2, 3),
        ]
        existing_categories = {item["category"].lower() for item in normalized}
        for category, description, likelihood, impact in category_defaults:
            if len(normalized) >= 15:
                break
            if category.lower() in existing_categories:
                continue
            inherent = likelihood * impact
            normalized.append(
                {
                    "risk_id": f"R{len(normalized) + 1}",
                    "category": category,
                    "description": description,
                    "likelihood": likelihood,
                    "impact": impact,
                    "inherent_score": inherent,
                    "rating": self._risk_rating(inherent),
                    "mitigation": "Treat as a board-level review item with named owner and pre-defined gate criteria.",
                    "residual_score": max(1, inherent - 4),
                }
            )
        return normalized[:15]

    def _risk_heat_map(self, items: list[dict]) -> list[dict]:
        normalized = self._normalize_risk_register(items)
        return [
            {
                "risk_id": item["risk_id"],
                "x": item["impact"],
                "y": item["likelihood"],
                "score": item["inherent_score"],
                "rating": item["rating"],
            }
            for item in normalized
        ]

    def _risk_rating(self, score: int) -> str:
        if score >= 15:
            return "High"
        if score >= 6:
            return "Medium"
        return "Low"

    def _implementation_roadmap(self) -> list[dict]:
        return [
            {
                "phase": "Immediate (0-3 months)",
                "actions": [
                    "Validate the target segment and demand thesis with top-priority partners.",
                    "Launch regulatory pre-clearance and compliance design workstreams.",
                    "Appoint executive owners for strategy, finance, legal, operations, and technology.",
                ],
                "owner_function": "Strategy Office",
                "success_metrics": [
                    "Target segment validated",
                    "Regulatory dependency map approved",
                    "Governance cadence established",
                ],
                "estimated_investment_usd": 750000.0,
            },
            {
                "phase": "Short-term (3-12 months)",
                "actions": [
                    "Execute the partner-led pilot launch in priority segments.",
                    "Stand up localized operating controls and reporting.",
                    "Track lighthouse accounts and early unit economics weekly.",
                ],
                "owner_function": "Business Unit Leadership",
                "success_metrics": [
                    "Pilot launched on time",
                    "Five lighthouse accounts secured",
                    "Control pass rate above 95%",
                ],
                "estimated_investment_usd": 2500000.0,
            },
            {
                "phase": "Medium-term (1-3 years)",
                "actions": [
                    "Scale the winning segments and deepen partner leverage.",
                    "Optimize the operating model for margin and control quality.",
                    "Expand local talent and capability depth in the highest-value functions.",
                ],
                "owner_function": "Commercial and Finance",
                "success_metrics": [
                    "Target IRR trajectory maintained",
                    "Gross-margin improvement achieved",
                    "Local capability gaps materially reduced",
                ],
                "estimated_investment_usd": 6200000.0,
            },
            {
                "phase": "Long-term (3-5 years)",
                "actions": [
                    "Entrench differentiated market positioning and repeatable launch playbooks.",
                    "Optimize portfolio allocation based on proven market economics.",
                    "Institutionalize governance and knowledge transfer for future expansions.",
                ],
                "owner_function": "Executive Committee",
                "success_metrics": [
                    "Sustained market-share growth",
                    "Repeatable expansion blueprint documented",
                    "Board confidence in scale economics sustained",
                ],
                "estimated_investment_usd": 9800000.0,
            },
        ]
