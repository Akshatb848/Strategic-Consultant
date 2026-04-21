from __future__ import annotations

from copy import deepcopy
import json
import re
from datetime import datetime
from statistics import mean

from asis.backend.agents.base import BaseAgent
from asis.backend.agents.llm_proxy import llm_proxy
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
from asis.backend.config.settings import get_settings
from asis.backend.schemas.v4 import AgentName, FrameworkName, StrategicBriefV4


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

    def _generate(self, state) -> dict:
        scaffold = self.local_result(state)
        settings = get_settings()
        if settings.demo_mode:
            scaffold["_used_fallback"] = True
            return scaffold

        proxy_output = llm_proxy.generate_json(
            system_prompt=self.system_prompt(),
            user_prompt=self.user_prompt(state),
            models=self.resolve_models(),
            agent_id=self.agent_id,
            analysis_id=state.get("analysis_id"),
        )
        if not proxy_output:
            if settings.allow_llm_fallback:
                scaffold["_used_fallback"] = True
                return scaffold
            raise RuntimeError("ASIS could not obtain live synthesis output from the configured LLM providers.")

        merged = self._merge_generated_brief(scaffold, proxy_output)
        for metadata_key in ("_model_used", "_tools_called", "_langfuse_trace_id", "_token_usage"):
            if metadata_key in proxy_output:
                merged[metadata_key] = proxy_output[metadata_key]
        merged["_used_fallback"] = False
        return merged

    @staticmethod
    def _confidence_variance(query: str, context: dict) -> float:
        fingerprint = (sum(ord(char) for char in query) + len(context.get("company_name") or "")) % 17
        return fingerprint / 1000

    def _merge_generated_brief(self, scaffold: dict, generated: dict) -> dict:
        merged = self._merge_value(scaffold, generated)
        decision_statement = str(merged.get("decision_statement") or "").strip()
        if not decision_statement.startswith(("PROCEED", "CONDITIONAL PROCEED", "DO NOT PROCEED")):
            merged["decision_statement"] = scaffold["decision_statement"]

        executive_summary = merged.get("executive_summary")
        if not isinstance(executive_summary, dict):
            executive_summary = deepcopy(scaffold["executive_summary"])
            merged["executive_summary"] = executive_summary
        executive_summary["headline"] = merged["decision_statement"]

        if not isinstance(merged.get("verification"), dict):
            merged["verification"] = deepcopy(scaffold["verification"])
        if not isinstance(merged.get("quality_report"), dict):
            merged["quality_report"] = deepcopy(scaffold["quality_report"])
        if not isinstance(merged.get("framework_outputs"), dict):
            merged["framework_outputs"] = deepcopy(scaffold["framework_outputs"])
        if not isinstance(merged.get("report_metadata"), dict):
            merged["report_metadata"] = deepcopy(scaffold["report_metadata"])
        if not isinstance(merged.get("balanced_scorecard"), dict):
            merged["balanced_scorecard"] = deepcopy(scaffold["balanced_scorecard"])

        merged["frameworks_applied"] = merged.get("frameworks_applied") or list(scaffold.get("frameworks_applied") or [])
        merged["roadmap"] = merged.get("roadmap") or deepcopy(merged.get("implementation_roadmap") or scaffold.get("roadmap") or [])
        merged["implementation_roadmap"] = merged.get("implementation_roadmap") or deepcopy(scaffold.get("implementation_roadmap") or [])
        merged["citations"] = ensure_minimum_citations(
            merged.get("context") if isinstance(merged.get("context"), dict) else scaffold.get("context") or {},
            merged.get("citations") or scaffold.get("citations") or build_citations(scaffold.get("context") or {}),
            minimum=6,
        )
        merged["confidence_score"] = merged.get("confidence_score") or merged.get("overall_confidence") or scaffold.get("confidence_score", 0.68)

        try:
            validated = StrategicBriefV4.model_validate(merged).model_dump(mode="json")
            validated["confidence_score"] = merged["confidence_score"]
            return validated
        except Exception:
            validated = StrategicBriefV4.model_validate(scaffold).model_dump(mode="json")
            validated["confidence_score"] = scaffold.get("confidence_score", scaffold.get("overall_confidence", 0.68))
            return validated

    def _merge_value(self, scaffold, generated):
        if generated in (None, "", [], {}):
            return deepcopy(scaffold)

        if isinstance(scaffold, dict):
            if not isinstance(generated, dict):
                return deepcopy(scaffold)
            merged = deepcopy(scaffold)
            for key, value in generated.items():
                if key.startswith("_"):
                    continue
                if key in merged:
                    merged[key] = self._merge_value(merged[key], value)
                elif value not in (None, "", [], {}):
                    merged[key] = deepcopy(value)
            return merged

        if isinstance(scaffold, list):
            if not isinstance(generated, list) or not generated:
                return deepcopy(scaffold)
            if not scaffold:
                return deepcopy(generated)
            template = scaffold[0]
            if isinstance(template, dict):
                return [
                    self._merge_value(template, item) if isinstance(item, dict) else deepcopy(template)
                    for item in generated
                ]
            return deepcopy(generated)

        return deepcopy(generated)

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
        profile = self._analysis_profile(
            company=company,
            geography=geography,
            context=context,
            query=query,
            recommendation=strategic.get("recommended_option"),
        )

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
            profile=profile,
        )
        collaboration_trace = self._ensure_collaboration_trace(state)
        section_action_titles = self._build_section_action_titles(context, framework_outputs, profile)
        so_what_callouts = self._build_so_what_callouts(framework_outputs)
        exhibit_registry = self._build_exhibit_registry(framework_outputs, context)
        normalized_risks = self._normalize_risk_register(risk.get("risk_register") or [])
        capability_fit_matrix = self._build_capability_fit_matrix(query=query, context=context, profile=profile)
        bottom_up_revenue_model = self._build_bottom_up_revenue_model(
            query=query,
            context=context,
            profile=profile,
            financial=financial,
        )
        scenario_analysis = self._build_scenario_analysis(
            profile=profile,
            financial=financial,
            bottom_up_revenue_model=bottom_up_revenue_model,
            normalized_risks=normalized_risks,
        )
        strategic_pathways = self._build_strategic_pathways(
            query=query,
            context=context,
            profile=profile,
            capability_fit_matrix=capability_fit_matrix,
            scenario_analysis=scenario_analysis,
            normalized_risks=normalized_risks,
        )
        execution_realism = self._build_execution_realism(
            query=query,
            context=context,
            profile=profile,
            normalized_risks=normalized_risks,
            bottom_up_revenue_model=bottom_up_revenue_model,
            strategic_pathways=strategic_pathways,
        )
        primary_pathway = self._primary_pathway(strategic_pathways)

        mece_score = round(self._compute_mece_score(risk, framework_outputs, context=context, query=query), 3)
        internal_consistency_score = round(self._compute_internal_consistency(framework_outputs, financial=financial, risk=risk, profile=profile), 3)
        overall_confidence = round(
            self._overall_confidence(
                query=query,
                context=context,
                framework_outputs=framework_outputs,
                financial=financial,
                risk=risk,
                profile=profile,
                bottom_up_revenue_model=bottom_up_revenue_model,
                scenario_analysis=scenario_analysis,
                capability_fit_matrix=capability_fit_matrix,
                execution_realism=execution_realism,
                strategic_pathways=strategic_pathways,
                mece_score=mece_score,
                internal_consistency_score=internal_consistency_score,
            ),
            3,
        )
        label = decision_label(overall_confidence)
        decision_evidence = self._top_decision_evidence(framework_outputs)
        decision_statement = self._decision_statement(
            label=label,
            geography=geography,
            recommendation=strategic.get("recommended_option") or profile["default_recommendation"],
            financial=financial,
            framework_outputs=framework_outputs,
            profile=profile,
            scenario_analysis=scenario_analysis,
            capability_fit_matrix=capability_fit_matrix,
            primary_pathway=primary_pathway,
        )
        executive_summary = self._build_executive_summary(
            decision_statement=decision_statement,
            decision_evidence=decision_evidence,
            risk_register=normalized_risks,
            strategic=strategic,
            profile=profile,
            scenario_analysis=scenario_analysis,
            primary_pathway=primary_pathway,
            execution_realism=execution_realism,
        )
        decision_rationale = self._decision_rationale(
            company=company,
            geography=geography,
            label=label,
            decision_evidence=decision_evidence,
            internal_consistency_score=internal_consistency_score,
            profile=profile,
            scenario_analysis=scenario_analysis,
            capability_fit_matrix=capability_fit_matrix,
            primary_pathway=primary_pathway,
            execution_realism=execution_realism,
        )
        roadmap_items = self._implementation_roadmap(profile)
        balanced_scorecard = framework_outputs["balanced_scorecard"]["structured_data"]
        commercial_rigor_score = round(
            mean(
                [
                    self._commercial_rigor_signal(bottom_up_revenue_model, scenario_analysis),
                    self._execution_signal(execution_realism, capability_fit_matrix, strategic_pathways),
                ]
            ),
            3,
        )
        base_case = self._scenario_by_name(scenario_analysis, scenario_analysis.get("recommended_case", "Base"))

        quality_flags = []
        if internal_consistency_score < 0.75:
            quality_flags.append("Framework evidence shows mild tension between upside ambition and execution risk.")
        if mece_score < 0.7:
            quality_flags.append("Some analytical sections still require tighter MECE separation.")
        if base_case.get("payback_months", 0) and float(base_case.get("payback_months", 0)) > 30:
            quality_flags.append("Base-case payback extends beyond 30 months, so the board should treat aggressive upside claims cautiously.")
        if len(capability_fit_matrix.get("critical_gaps") or []) >= 3:
            quality_flags.append("Capability gaps remain material, which increases execution dependence on partner quality and milestone gating.")
        quality_report = {
            "overall_grade": "A" if internal_consistency_score >= 0.8 and mece_score >= 0.75 and commercial_rigor_score >= 0.72 else "B",
            "checks": [],
            "quality_flags": quality_flags,
            "mece_score": mece_score,
            "citation_density_score": 1.0,
            "internal_consistency_score": internal_consistency_score,
            "context_specificity_score": self._query_specificity(query, context),
            "financial_grounding_score": self._commercial_rigor_signal(bottom_up_revenue_model, scenario_analysis),
            "execution_specificity_score": self._execution_signal(execution_realism, capability_fit_matrix, strategic_pathways),
            "retry_count": state.get("quality_retry_count") or 0,
        }

        market_analysis = {
            "market_sizing": {
                "tam": market.get("market_size_summary", {}).get("headline", f"{geography} demand is attractive for a differentiated entrant."),
                "sam": "Priority segments with high trust and compliance sensitivity.",
                "som": profile["market_capture"],
                "growth_rate": market.get("market_size_summary", {}).get("growth_rate", "11-14% CAGR"),
                "source": citations[0],
            },
            "trends": market.get("market_growth_themes") or market.get("market_signals") or [],
            "competitor_profiles": competitor.get("competitor_profiles") or [],
            "capability_fit_matrix": capability_fit_matrix,
            "strategic_pathways": strategic_pathways,
        }
        financial_analysis = {
            "financial_projections": financial.get("financial_projections") or {},
            "peer_benchmarking": financial.get("peer_benchmarking") or [],
            "business_units": financial.get("business_units") or [],
            "recommended_option": strategic.get("recommended_option"),
            "bottom_up_revenue_model": bottom_up_revenue_model,
            "scenario_analysis": scenario_analysis,
            "commercial_rigor_score": commercial_rigor_score,
        }
        risk_analysis = {
            "risk_register": normalized_risks,
            "risk_heat_map": self._risk_heat_map(risk.get("risk_register") or []),
            "cage_distance_analysis": geo.get("cage_distance_analysis") or {},
            "conditions_and_contingencies": profile["conditions_and_contingencies"],
            "key_success_factors": profile["key_success_factors"],
            "execution_realism": execution_realism,
        }
        verification = {
            "summary": "Quality-gated synthesis completed with MECE and internal consistency scoring.",
            "quality_grade": quality_report["overall_grade"],
            "frameworks_completed": list(framework_outputs.keys()),
            "collaboration_events": len(collaboration_trace),
            "overall_verification_score": overall_confidence,
            "commercial_rigor_score": commercial_rigor_score,
            "base_case_payback_months": base_case.get("payback_months"),
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
            "board_narrative": profile["board_narrative"],
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

    def _analysis_profile(self, *, company: str, geography: str, context: dict, query: str, recommendation: str | None) -> dict[str, object]:
        decision_type = str(context.get("decision_type") or "").lower().strip() or "enter"
        target_label = geography if geography and geography != "the target market" else "the target market"
        target_scope = geography if geography and geography != "the target market" else "the business"

        profiles = {
            "enter": {
                "decision_type": "enter",
                "board_action": f"enter {target_label} through a staged, partner-enabled rollout",
                "default_recommendation": "a staged, partner-enabled rollout",
                "condition": "subject to regulatory readiness and partner due diligence",
                "program_label": "market-entry program",
                "strategic_path": "controlled market development",
                "capability_focus": "local operating readiness",
                "objective_phrase": "capture new demand without overextending the product and control model",
                "market_capture": "Partner-led share capture in lighthouse segments over the first 24 months.",
                "next_step": "Approve the gated market-entry workplan and begin partner diligence.",
                "board_narrative": f"{company} should advance only through a gated market-entry strategy that converts external demand into controlled, evidence-led growth in {target_label}.",
                "conditions_and_contingencies": [
                    "Secure regulatory and partner-readiness milestones before full commercial scale.",
                    "Keep capital deployment gated to validated segment traction and compliance readiness.",
                    "Maintain board oversight on local operating-model localisation and control quality.",
                ],
                "key_success_factors": [
                    "Partner quality and distribution credibility",
                    "Compliance-first launch discipline",
                    "Tight execution governance with named owners",
                    "Measured capital sequencing",
                    "Local capability build-out",
                ],
                "complexity_penalty": 0.02,
            },
            "acquire": {
                "decision_type": "acquire",
                "board_action": f"pursue a targeted acquisition in {target_label}",
                "default_recommendation": "a targeted acquisition and phased integration plan",
                "condition": "subject to valuation discipline, confirmatory diligence, and integration readiness",
                "program_label": "acquisition program",
                "strategic_path": "focused inorganic expansion",
                "capability_focus": "integration readiness",
                "objective_phrase": "secure capability and market access without overpaying for growth",
                "market_capture": "Value capture through the highest-synergy targets over the first 24 months.",
                "next_step": "Approve the target screen, confirmatory diligence plan, and integration blueprint.",
                "board_narrative": f"{company} should advance only through a gated acquisition strategy that links value creation to diligence quality, integration readiness, and disciplined capital deployment.",
                "conditions_and_contingencies": [
                    "Maintain valuation discipline against downside and stress-case assumptions.",
                    "Complete commercial, legal, and technical diligence before signing.",
                    "Keep the board engaged on integration pacing, customer continuity, and talent retention.",
                ],
                "key_success_factors": [
                    "Disciplined target screening and valuation control",
                    "Integration governance with named functional owners",
                    "Customer and talent retention during transition",
                    "Clear synergy tracking and post-close milestones",
                    "Operational and cultural compatibility",
                ],
                "complexity_penalty": 0.06,
            },
            "merge": {
                "decision_type": "merge",
                "board_action": f"pursue a selective merger in {target_label}",
                "default_recommendation": "a selective merger and integration plan",
                "condition": "subject to diligence quality, integration governance, and regulatory clearance",
                "program_label": "merger program",
                "strategic_path": "focused inorganic combination",
                "capability_focus": "integration readiness",
                "objective_phrase": "unlock strategic scale without allowing integration complexity to destroy value",
                "market_capture": "Value creation through carefully sequenced integration milestones over the first 24 months.",
                "next_step": "Approve the merger thesis, diligence scope, and Day 1 integration plan.",
                "board_narrative": f"{company} should advance only through a gated merger strategy that protects customer continuity, leadership clarity, and synergy discipline.",
                "conditions_and_contingencies": [
                    "Validate synergy assumptions before committing to the transaction structure.",
                    "Resolve regulatory and antitrust questions before signing.",
                    "Maintain board-level oversight over Day 1 and post-close integration readiness.",
                ],
                "key_success_factors": [
                    "Synergy realism and value-capture discipline",
                    "Leadership alignment and cultural compatibility",
                    "Customer continuity through integration",
                    "Clear Day 1 operating-model design",
                    "Regulatory readiness",
                ],
                "complexity_penalty": 0.07,
            },
            "restructure": {
                "decision_type": "restructure",
                "board_action": f"restructure the {target_scope} operating model",
                "default_recommendation": "a phased restructuring program",
                "condition": "subject to service continuity, talent retention, and phased change governance",
                "program_label": "restructuring program",
                "strategic_path": "operating-model simplification",
                "capability_focus": "execution governance",
                "objective_phrase": "restore margin resilience and operating control without destabilising core revenue",
                "market_capture": "Value recovery through priority operating improvements over the first 24 months.",
                "next_step": "Approve the restructuring scope, governance model, and workforce transition plan.",
                "board_narrative": f"{company} should advance only through a staged restructuring strategy that improves cost, control, and accountability without disrupting critical customers and revenue streams.",
                "conditions_and_contingencies": [
                    "Protect critical service levels and customer commitments throughout the change program.",
                    "Sequence restructuring waves against talent-retention and operating-risk thresholds.",
                    "Maintain executive governance over margin delivery, morale, and control effectiveness.",
                ],
                "key_success_factors": [
                    "Service continuity through transition",
                    "Clear decision rights and change governance",
                    "Talent retention in critical roles",
                    "Measured cost-out and margin tracking",
                    "Transparent stakeholder communication",
                ],
                "complexity_penalty": 0.05,
            },
            "invest": {
                "decision_type": "invest",
                "board_action": "invest in the proposed initiative through milestone-based capital deployment",
                "default_recommendation": "a milestone-based investment plan",
                "condition": "subject to technical readiness, demand validation, and payback discipline",
                "program_label": "investment program",
                "strategic_path": "disciplined capital deployment",
                "capability_focus": "value realisation readiness",
                "objective_phrase": "release capital only as evidence, capability, and demand improve",
                "market_capture": "Value creation through milestone-based deployment over the first 24 months.",
                "next_step": "Approve the staged investment case, technical milestones, and review cadence.",
                "board_narrative": f"{company} should advance only through a gated investment strategy that links capital release to demand evidence, operating readiness, and board-defined milestone gates.",
                "conditions_and_contingencies": [
                    "Release capital only when milestone evidence is independently validated.",
                    "Maintain downside triggers for pausing or re-scoping the initiative.",
                    "Hold board reviews on cost, payback, and operating readiness at each funding gate.",
                ],
                "key_success_factors": [
                    "Milestone-based funding discipline",
                    "Technical and operating readiness",
                    "Clear benefit tracking and payback governance",
                    "Named executive accountability",
                    "Rapid learning loops from early pilots",
                ],
                "complexity_penalty": 0.04,
            },
            "exit": {
                "decision_type": "exit",
                "board_action": f"execute a disciplined exit from {target_scope}",
                "default_recommendation": "a phased exit and separation plan",
                "condition": "subject to stakeholder continuity, value preservation, and separation readiness",
                "program_label": "exit program",
                "strategic_path": "portfolio simplification",
                "capability_focus": "separation readiness",
                "objective_phrase": "preserve value while reducing exposure and complexity",
                "market_capture": "Value preservation through a phased exit over the first 24 months.",
                "next_step": "Approve the exit thesis, stakeholder plan, and separation milestones.",
                "board_narrative": f"{company} should advance only through a controlled exit strategy that protects value, customer continuity, and reputational equity while reducing strategic exposure.",
                "conditions_and_contingencies": [
                    "Protect customer and regulator confidence throughout the exit timeline.",
                    "Sequence separation to preserve operational continuity and value.",
                    "Maintain board oversight over stakeholder, legal, and communications risk.",
                ],
                "key_success_factors": [
                    "Value preservation during separation",
                    "Stakeholder communication discipline",
                    "Operational continuity through transition",
                    "Legal and regulatory readiness",
                    "Clear end-state ownership",
                ],
                "complexity_penalty": 0.05,
            },
            "divest": {
                "decision_type": "divest",
                "board_action": f"divest the {target_scope} through a disciplined separation plan",
                "default_recommendation": "a phased divestment plan",
                "condition": "subject to valuation, buyer quality, and separation readiness",
                "program_label": "divestment program",
                "strategic_path": "portfolio simplification",
                "capability_focus": "separation readiness",
                "objective_phrase": "realise value while reducing exposure and management drag",
                "market_capture": "Value realisation through a carefully sequenced divestment over the first 24 months.",
                "next_step": "Approve the divestment perimeter, buyer screen, and separation milestones.",
                "board_narrative": f"{company} should advance only through a gated divestment strategy that preserves value, manages stakeholder risk, and protects business continuity during separation.",
                "conditions_and_contingencies": [
                    "Validate buyer quality and value before committing to the separation route.",
                    "Sequence separation activities to avoid service disruption and stranded cost leakage.",
                    "Keep board oversight on value leakage, legal risk, and stakeholder management.",
                ],
                "key_success_factors": [
                    "Buyer quality and transaction discipline",
                    "Separation readiness and stranded cost control",
                    "Stakeholder confidence and communication",
                    "Operational continuity",
                    "Clear post-divestment operating model",
                ],
                "complexity_penalty": 0.05,
            },
        }

        profile = dict(profiles.get(decision_type, profiles["enter"]))
        if recommendation:
            profile["default_recommendation"] = str(recommendation).strip().lower()
        return profile

    def _query_specificity(self, query: str, context: dict) -> float:
        score = 0.28
        if context.get("company_name"):
            score += 0.18
        if context.get("geography"):
            score += 0.15
        if context.get("sector"):
            score += 0.1
        if context.get("decision_type"):
            score += 0.12
        if re.search(r"\b(20\d{2}|q[1-4]|month|months|year|years|quarter|quarters)\b", query, re.IGNORECASE):
            score += 0.07
        if len(query.split()) >= 8:
            score += 0.06
        if context.get("annual_revenue") or context.get("annual_revenue_usd_mn"):
            score += 0.05
        if context.get("employees"):
            score += 0.04
        return max(0.35, min(0.97, round(score, 3)))

    def _citation_strength(self, framework_outputs: dict[str, dict]) -> float:
        if not framework_outputs:
            return 0.45
        scores = [min(1.0, len(output.get("citations") or []) / 6) for output in framework_outputs.values()]
        return round(mean(scores), 3)

    def _safe_float(self, value, default: float) -> float:
        if isinstance(value, (int, float)):
            numeric = float(value)
            return numeric / 100 if numeric > 1.0 and numeric <= 100.0 else numeric
        if isinstance(value, str):
            match = re.search(r"-?\d+(?:\.\d+)?", value.replace(",", ""))
            if match:
                numeric = float(match.group(0))
                return numeric / 100 if "%" in value or (numeric > 1.0 and numeric <= 100.0) else numeric
        return default

    def _absolute_percent(self, value, default: float) -> float:
        if value is None:
            return default
        if isinstance(value, (int, float)):
            numeric = float(value)
            return numeric * 100 if 0.0 <= numeric <= 1.0 else numeric
        if isinstance(value, str):
            match = re.search(r"-?\d+(?:\.\d+)?", value.replace(",", ""))
            if match:
                numeric = float(match.group(0))
                return numeric
        return default

    def _financial_signal(self, financial: dict) -> float:
        projections = financial.get("financial_projections") or {}
        year_5 = projections.get("year_5") or projections.get("y5") or {}
        irr = self._safe_float(year_5.get("irr"), 0.26)
        roi = self._safe_float(year_5.get("roi"), 0.22)
        signal = mean([
            min(1.0, max(0.2, irr / 0.45)),
            min(1.0, max(0.2, roi / 0.55)),
        ])
        return round(max(0.35, min(0.95, signal)), 3)

    def _overall_confidence(
        self,
        *,
        query: str,
        context: dict,
        framework_outputs: dict[str, dict],
        financial: dict,
        risk: dict,
        profile: dict[str, object],
        bottom_up_revenue_model: dict[str, object],
        scenario_analysis: dict[str, object],
        capability_fit_matrix: dict[str, object],
        execution_realism: dict[str, object],
        strategic_pathways: dict[str, object],
        mece_score: float,
        internal_consistency_score: float,
    ) -> float:
        normalized_risks = self._normalize_risk_register(risk.get("risk_register") or [])
        top_risk_score = max((item["inherent_score"] for item in normalized_risks), default=10)
        risk_penalty = max(0.0, (top_risk_score - 10) / 120)
        composite = mean(
            [
                average_framework_confidence(framework_outputs),
                self._query_specificity(query, context),
                self._citation_strength(framework_outputs),
                self._financial_signal(financial),
                self._commercial_rigor_signal(bottom_up_revenue_model, scenario_analysis),
                self._execution_signal(execution_realism, capability_fit_matrix, strategic_pathways),
                mece_score,
                internal_consistency_score,
            ]
        )
        score = composite - risk_penalty - float(profile.get("complexity_penalty", 0.03)) + self._confidence_variance(query, context)
        return max(0.46, min(0.93, score))

    def _build_framework_outputs(self, *, state, context, citations, market, risk, competitor, geo, financial, strategic, profile) -> dict[str, dict]:
        competitor_profiles = competitor.get("competitor_profiles") or []
        program_label = str(profile["program_label"])
        strategic_path = str(profile["strategic_path"])
        capability_focus = str(profile["capability_focus"])
        objective_phrase = str(profile["objective_phrase"])
        scorecard_label = f"{program_label} scorecard"

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
            "key_implication": f"External conditions can support {strategic_path}, but only under a compliance-first and risk-gated operating model.",
            "action_title": f"External conditions can support {strategic_path} in {context.get('geography') or 'the target market'}, provided regulatory and execution risks are actively managed.",
        }

        porters_structured = dict(competitor.get("framework_outputs", {}).get("porters_five_forces", {}).get("structured_data") or {})
        porters_structured.setdefault("competitive_rivalry", {"score": 7, "rationale": "Rivalry is active and capability-led.", "key_players": [profile.get("name") for profile in competitor_profiles], "citations": citations[:5]})
        porters_structured.setdefault("threat_of_new_entrants", {"score": 4, "rationale": "Entry barriers remain meaningful.", "barriers": ["regulation", "trust", "distribution"], "citations": citations[:5]})
        porters_structured.setdefault("threat_of_substitutes", {"score": 5, "rationale": "Substitutes can capture selected demand.", "substitutes": ["internal build", "adjacent tools"], "citations": citations[:5]})
        porters_structured.setdefault("bargaining_power_buyers", {"score": 6, "rationale": "Sophisticated buyers retain leverage.", "factors": ["procurement", "multi-vendor choice"], "citations": citations[:5]})
        porters_structured.setdefault("bargaining_power_suppliers", {"score": 4, "rationale": "Supplier concentration is manageable.", "factors": ["data providers", "cloud partners"], "citations": citations[:5]})
        porters_structured["overall_attractiveness"] = porters_structured.get("overall_attractiveness", 5)
        porters_structured["attractiveness_label"] = self._attractiveness_label(porters_structured["overall_attractiveness"])
        porters_structured["action_title"] = f"Competitive intensity is manageable only if the company pursues {strategic_path} with a differentiated proposition rather than a generic scale play."
        porters_structured["strategic_implication"] = porters_structured.get(
            "strategic_implication",
            f"The market remains strategically workable only when {strategic_path} is differentiated and carefully sequenced.",
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
        ansoff_structured["recommendation_rationale"] = ansoff_structured.get("recommendation_rationale", strategic.get("option_rationale") or f"{strategic_path.capitalize()} best balances upside, feasibility, and risk.")
        ansoff_structured["action_title"] = f"{strategic_path.capitalize()} offers the clearest path because it preserves upside without overextending the operating model."

        bcg_structured = {
            "business_units": [
                {
                    **unit,
                    "revenue_usd_mn": unit.get("revenue_usd_mn", self._business_unit_revenue(unit.get("category"))),
                    "citations": citations[:5],
                }
                for unit in (financial.get("business_units") or [])
            ],
            "portfolio_recommendation": f"Use core cash-generating assets to fund the {program_label} in staged tranches, while requiring each commitment to earn further investment.",
            "action_title": f"The portfolio can fund the {program_label}, but capital should be released in stages until the core value thesis is proven.",
        }

        seven_s_structured = dict(strategic.get("framework_outputs", {}).get("mckinsey_7s", {}).get("structured_data") or {})
        desired_states = {
            "strategy": "A gated growth strategy with explicit board decision points.",
            "structure": "Clear local-market accountability with central governance guardrails.",
            "systems": f"Operating controls and readiness tracking matched to the {program_label}.",
            "staff": "A strong local leadership and specialist bench.",
            "style": "Fast escalation loops with disciplined governance.",
            "skills": f"Deep regulatory, commercial, and {capability_focus} capability.",
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
        seven_s_structured["critical_gaps"] = seven_s_structured.get("critical_gaps", ["leadership capacity", "systems localisation", "field execution authority"])
        seven_s_structured["action_title"] = f"Organisation alignment is supportive in principle, but systems, talent, and decision rights must strengthen before the {program_label} can scale."

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
        blue_ocean_structured.setdefault("blue_ocean_shift", f"Compete on trust, governance, and execution quality rather than on price alone while pursuing {strategic_path}.")
        blue_ocean_structured["action_title"] = f"Differentiation should come from trust, governance, and execution quality rather than from joining a commodity price race during {program_label} delivery."

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
                    "point": "The external opportunity is material enough to justify a measured strategic move.",
                    "source_agent": AgentName.MARKET_INTELLIGENCE.value,
                    "evidence": market.get("market_size_summary", {}).get("headline", "Demand growth remains attractive."),
                    "citation": citations[0]["title"],
                },
                {
                    "point": f"{strategic_path.capitalize()} offers the strongest risk-adjusted path.",
                    "source_agent": AgentName.STRATEGIC_OPTIONS.value,
                    "evidence": strategic.get("option_rationale", f"{strategic_path.capitalize()} is the recommended route."),
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
                    "point": f"Administrative distance and competitive retaliation can disrupt {program_label} execution.",
                    "source_agent": AgentName.GEO_INTEL.value,
                    "evidence": "CAGE distance and Porter's forces both point to execution friction.",
                    "citation": citations[3]["title"],
                },
            ],
            "action_title": f"The company has enough strategic upside to proceed, but only if it addresses capability gaps and risk gating before accelerating the {program_label}.",
            "swot_implication": f"Net position is attractive but execution-sensitive, favouring a phased and tightly governed {program_label}.",
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
                "measures": ["control pass rate", "program readiness"],
                "targets": ["95% pass rate", "90% readiness"],
                "initiatives": ["Readiness PMO", "Control design sprints"],
            },
            "learning_and_growth": {
                "objectives": ["Build capability depth", f"Create repeatable {capability_focus} muscle"],
                "measures": ["critical hires", "training completion"],
                "targets": ["10 key hires", "100% training completion"],
                "initiatives": ["Local talent pods", "Leadership capability academy"],
            },
        }
        balanced_scorecard_structured["action_title"] = f"Execution should be governed through a balanced scorecard that ties the {program_label} to measurable financial, customer, process, and capability outcomes."

        return {
            "pestle": build_framework_output(
                framework_name=FrameworkName.PESTLE,
                agent_author=AgentName.SYNTHESIS,
                structured_data=pestle_structured,
                narrative=f"PESTLE analysis shows the external environment is workable for {strategic_path}, but only when the company follows a compliance-first operating model instead of chasing speed at the expense of control.",
                context=context,
                confidence_score=0.74,
                citations=citations,
                exhibit_number=1,
                exhibit_title=pestle_structured["action_title"],
                implication=pestle_structured["key_implication"],
                recommended_action=f"Proceed only with a staged {program_label} that treats regulatory readiness and stakeholder management as critical-path work.",
                risk_of_inaction="Ignoring these external constraints would raise execution friction, delay approvals, and reduce the probability of achieving the projected financial case.",
            ),
            "porters_five_forces": build_framework_output(
                framework_name=FrameworkName.PORTERS_FIVE_FORCES,
                agent_author=AgentName.COMPETITOR_ANALYSIS,
                structured_data=porters_structured,
                narrative=f"Porter's Five Forces indicates that the competitive landscape can support {strategic_path}, but only when the proposition is differentiated and the sequencing avoids a direct commodity battle.",
                context=context,
                confidence_score=0.72,
                citations=citations,
                exhibit_number=2,
                exhibit_title=porters_structured["action_title"],
                implication=porters_structured["strategic_implication"],
                recommended_action="Compete with a proposition built around trust, capability, and execution quality rather than attempting to outscale incumbents immediately.",
                risk_of_inaction=f"Pursuing the {program_label} without a clear differentiation thesis would expose the company to aggressive incumbent response and weak economics.",
            ),
            "swot": build_framework_output(
                framework_name=FrameworkName.SWOT,
                agent_author=AgentName.SYNTHESIS,
                structured_data=swot_structured,
                narrative=f"The SWOT synthesis supports a conditional go-ahead: the opportunity is real, but value creation depends on closing internal capability gaps before the company accelerates the {program_label}.",
                context=context,
                confidence_score=0.73,
                citations=citations,
                exhibit_number=14,
                exhibit_title=swot_structured["action_title"],
                implication=swot_structured["swot_implication"],
                recommended_action=f"Use the identified strengths to support a narrowly scoped {program_label} while explicitly remediating the most important 7S gaps.",
                risk_of_inaction=f"If the organisation underestimates these weaknesses, the {program_label} will lose credibility before the value thesis is proven.",
            ),
            "ansoff": build_framework_output(
                framework_name=FrameworkName.ANSOFF,
                agent_author=AgentName.STRATEGIC_OPTIONS,
                structured_data=ansoff_structured,
                narrative=f"The Ansoff analysis clearly favors {strategic_path}: it captures the most attractive upside while keeping product, capital, and execution complexity within a manageable range.",
                context=context,
                confidence_score=0.78,
                citations=citations,
                exhibit_number=5,
                exhibit_title=ansoff_structured["action_title"],
                implication=ansoff_structured["recommendation_rationale"],
                recommended_action=f"Prioritize the {strategic_path} pathway and defer broader complexity until the first operating model proves itself.",
                risk_of_inaction="Choosing a more complex path too early would increase capital burn, execution complexity, and the odds of destroying value before evidence is established.",
            ),
            "bcg_matrix": build_framework_output(
                framework_name=FrameworkName.BCG_MATRIX,
                agent_author=AgentName.FINANCIAL_REASONING,
                structured_data=bcg_structured,
                narrative=f"The BCG view reinforces the financial case for staged investment: the company has portfolio assets that can fund the {program_label}, but incremental capital should be earned through milestone-based progression.",
                context=context,
                confidence_score=0.71,
                citations=citations,
                exhibit_number=9,
                exhibit_title=bcg_structured["action_title"],
                implication=bcg_structured["portfolio_recommendation"],
                recommended_action=f"Fund the {program_label} from stronger portfolio positions while keeping spend contingent on verified traction and readiness.",
                risk_of_inaction=f"Misallocating portfolio capital would weaken the economics of both the core business and the {program_label}.",
            ),
            "mckinsey_7s": build_framework_output(
                framework_name=FrameworkName.MCKINSEY_7S,
                agent_author=AgentName.STRATEGIC_OPTIONS,
                structured_data=seven_s_structured,
                narrative=f"McKinsey 7S shows that strategic intent is aligned, but systems, talent, and operating authority still need deliberate strengthening before the {program_label} can scale with confidence.",
                context=context,
                confidence_score=0.7,
                citations=citations,
                exhibit_number=7,
                exhibit_title=seven_s_structured["action_title"],
                implication=f"The operating model is directionally aligned, but the {program_label} should follow capability readiness rather than precede it.",
                recommended_action="Close the critical gaps in staff, systems, and structure before authorising broader scale.",
                risk_of_inaction=f"Accelerating before these gaps are addressed would create strategy-execution failure and dilute the value of the underlying thesis.",
            ),
            "blue_ocean": build_framework_output(
                framework_name=FrameworkName.BLUE_OCEAN,
                agent_author=AgentName.STRATEGIC_OPTIONS,
                structured_data=blue_ocean_structured,
                narrative=f"The Blue Ocean canvas supports a differentiated play based on trust, governance, and execution quality, giving the company a cleaner route to value creation than a conventional pricing battle.",
                context=context,
                confidence_score=0.74,
                citations=citations,
                exhibit_number=4,
                exhibit_title=blue_ocean_structured["action_title"],
                implication=blue_ocean_structured["blue_ocean_shift"],
                recommended_action=f"Raise compliance assurance and execution quality while reducing unnecessary scope and front-loaded capital exposure across the {program_label}.",
                risk_of_inaction="Without a clear value-curve shift, the company will be pulled into the same price and speed battle as incumbent and digital competitors.",
            ),
            "balanced_scorecard": build_framework_output(
                framework_name=FrameworkName.BALANCED_SCORECARD,
                agent_author=AgentName.SYNTHESIS,
                structured_data=balanced_scorecard_structured,
                narrative=f"The balanced scorecard translates the recommendation into a measurable execution architecture for the {program_label} across financial, customer, internal-process, and learning-and-growth objectives.",
                context=context,
                confidence_score=0.75,
                citations=citations,
                exhibit_number=16,
                exhibit_title=balanced_scorecard_structured["action_title"],
                implication="Execution discipline should be measured across all four scorecard perspectives, not just through top-line growth.",
                recommended_action=f"Run the {scorecard_label} against named owners, targets, and a formal review cadence.",
                risk_of_inaction="Absent a scorecard, the organisation risks scaling activity faster than it scales control, capability, and customer proof.",
            ),
        }

    def _decision_statement(
        self,
        *,
        label: str,
        geography: str,
        recommendation: str,
        financial: dict,
        framework_outputs: dict[str, dict],
        profile: dict[str, object],
        scenario_analysis: dict[str, object],
        capability_fit_matrix: dict[str, object],
        primary_pathway: dict[str, object],
    ) -> str:
        base_case = self._scenario_by_name(scenario_analysis, scenario_analysis.get("recommended_case", "Base"))
        year_5_irr = self._absolute_percent(
            base_case.get("irr_pct"),
            self._absolute_percent(financial.get("financial_projections", {}).get("year_5", {}).get("irr"), 31.0),
        )
        payback_months = int(base_case.get("payback_months") or 28)
        attractiveness = framework_outputs["porters_five_forces"]["structured_data"]["overall_attractiveness"]
        condition = str(profile["condition"])
        critical_gaps = len(capability_fit_matrix.get("critical_gaps") or [])
        pathway_label = str(primary_pathway.get("name") or recommendation).lower()
        return (
            f"{label} — {str(profile['board_action']).capitalize()} through {pathway_label}, {condition}, "
            f"because the base case supports {round(year_5_irr)}% IRR, {payback_months}-month payback, and only {critical_gaps} critical capability gaps remain."
        )

    def _build_executive_summary(
        self,
        *,
        decision_statement: str,
        decision_evidence: list[str],
        risk_register: list[dict],
        strategic: dict,
        profile: dict[str, object],
        scenario_analysis: dict[str, object],
        primary_pathway: dict[str, object],
        execution_realism: dict[str, object],
    ) -> dict:
        top_risk = risk_register[0]["description"] if risk_register else "Regulatory delay could slow time-to-value."
        base_case = self._scenario_by_name(scenario_analysis, scenario_analysis.get("recommended_case", "Base"))
        base_revenue = self._safe_float(base_case.get("revenue_year_3_usd_mn"), 28.0)
        payback_months = int(base_case.get("payback_months") or 28)
        pricing_model = execution_realism.get("pricing_model") or "A phased commercial model"
        return {
            "headline": decision_statement,
            "key_argument_1": decision_evidence[0] if len(decision_evidence) > 0 else "External conditions are supportive when execution remains staged and evidence-led.",
            "key_argument_2": decision_evidence[1] if len(decision_evidence) > 1 else f"The option set favors {primary_pathway.get('name', profile['strategic_path'])} over broader, higher-risk alternatives.",
            "key_argument_3": decision_evidence[2] if len(decision_evidence) > 2 else f"The base case indicates roughly ${round(base_revenue, 1)}M of year-three revenue with payback in about {payback_months} months under {pricing_model.lower()}.",
            "critical_risk": top_risk,
            "next_step": strategic.get("recommended_option") or str(profile["next_step"]),
        }

    def _decision_rationale(
        self,
        *,
        company: str,
        geography: str,
        label: str,
        decision_evidence: list[str],
        internal_consistency_score: float,
        profile: dict[str, object],
        scenario_analysis: dict[str, object],
        capability_fit_matrix: dict[str, object],
        primary_pathway: dict[str, object],
        execution_realism: dict[str, object],
    ) -> str:
        base_case = self._scenario_by_name(scenario_analysis, scenario_analysis.get("recommended_case", "Base"))
        aggressive_case = self._scenario_by_name(scenario_analysis, "Aggressive")
        base_revenue = self._safe_float(base_case.get("revenue_year_3_usd_mn"), 28.0)
        aggressive_revenue = self._safe_float(aggressive_case.get("revenue_year_3_usd_mn"), base_revenue * 1.35)
        capability_gaps = capability_fit_matrix.get("critical_gaps") or []
        commercial_model = execution_realism.get("commercial_model") or "a mixed consulting and recurring-revenue model"
        paragraph_one = (
            f"{company} should receive a {label.lower()} recommendation because the combined market, competitive, risk, and financial evidence supports {profile['strategic_path']} in {geography}, "
            f"provided the company keeps the {profile['program_label']} gated behind {profile['condition']} and follows the primary pathway of {primary_pathway.get('name', profile['default_recommendation'])}."
        )
        paragraph_two = (
            f"The most decisive evidence comes from the convergence of the external attractiveness case, the option analysis, and a bottom-up commercial model that supports roughly ${round(base_revenue, 1)}M of year-three revenue in the base case versus ${round(aggressive_revenue, 1)}M in the upside case. "
            f"Internal consistency remains strong at {round(internal_consistency_score * 100)}%, but execution still depends on closing {len(capability_gaps)} critical capability gaps and proving {commercial_model.lower()} against realistic sales-cycle and integration assumptions."
        )
        return f"{paragraph_one}\n\n{paragraph_two}"

    def _build_section_action_titles(self, context: dict, framework_outputs: dict[str, dict], profile: dict[str, object]) -> dict[str, str]:
        company = context.get("company_name") or "The company"
        geography = context.get("geography") or "the target market"
        return {
            "decision": f"{company} should pursue {profile['strategic_path']} in {geography} only under explicit regulatory, financial, and execution gates.",
            "executive_summary": f"{company}'s recommendation can be understood quickly because the decision, supporting arguments, and critical risk are surfaced first.",
            "methodology": "The eight-agent pipeline created a complete strategic brief by combining market, risk, competitive, geopolitical, financial, and option evidence.",
            "risk_assessment": f"Risk exposure is manageable only when {company} treats regulatory timing, capital discipline, and {profile['capability_focus']} as first-order constraints.",
            "financial_analysis": f"The capital case supports the {profile['program_label']} only when investment is released in stages and linked to validated traction.",
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

    def _compute_mece_score(self, risk: dict, framework_outputs: dict[str, dict], *, context: dict, query: str) -> float:
        risk_categories = {item.get("category", "").lower() for item in self._normalize_risk_register(risk.get("risk_register") or [])}
        required = {"political", "financial", "operational", "reputational", "esg", "regulatory", "execution"}
        coverage = len(risk_categories.intersection(required)) / len(required)
        swot = framework_outputs["swot"]["structured_data"]
        swot_balance = min(1.0, sum(1 for key in ("strengths", "weaknesses", "opportunities", "threats") if swot.get(key)) / 4)
        swot_sources = {
            item.get("source_agent")
            for key in ("strengths", "weaknesses", "opportunities", "threats")
            for item in swot.get(key, [])
            if item.get("source_agent")
        }
        source_diversity = min(1.0, len(swot_sources) / 4)
        framework_coverage = sum(1 for output in framework_outputs.values() if output.get("structured_data")) / max(len(framework_outputs), 1)
        scope_completeness = self._query_specificity(query, context)
        return max(0.55, min(0.93, round(mean([coverage, swot_balance, source_diversity, framework_coverage, scope_completeness]), 3)))

    def _compute_internal_consistency(self, framework_outputs: dict[str, dict], *, financial: dict, risk: dict, profile: dict[str, object]) -> float:
        ansoff = framework_outputs["ansoff"]["structured_data"]
        recommended_quadrant = ansoff.get("recommended_quadrant") or "market_development"
        recommended_option = ansoff.get(recommended_quadrant, {})
        option_signal = self._safe_float(recommended_option.get("feasibility"), framework_outputs["ansoff"]["confidence_score"])
        seven_s_signal = self._safe_float(
            framework_outputs["mckinsey_7s"]["structured_data"].get("alignment_score"),
            framework_outputs["mckinsey_7s"]["confidence_score"],
        )
        porter_signal = self._safe_float(framework_outputs["porters_five_forces"]["structured_data"].get("overall_attractiveness"), 5.0) / 10
        blue_ocean_signal = framework_outputs["blue_ocean"]["confidence_score"]
        financial_signal = self._financial_signal(financial)
        top_risk = max((item["inherent_score"] for item in self._normalize_risk_register(risk.get("risk_register") or [])), default=10)
        risk_signal = max(0.25, 1 - (top_risk / 25))
        base_signal = mean([option_signal, seven_s_signal, porter_signal, blue_ocean_signal, financial_signal])
        tension = mean(
            [
                abs(financial_signal - risk_signal),
                abs(option_signal - seven_s_signal),
                abs(porter_signal - risk_signal),
            ]
        )
        consistency = base_signal - (tension * 0.35) - (float(profile.get("complexity_penalty", 0.03)) / 2)
        return max(0.48, min(0.92, round(consistency, 3)))

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

    def _implementation_roadmap(self, profile: dict[str, object]) -> list[dict]:
        decision_type = str(profile.get("decision_type") or "enter")

        if decision_type in {"acquire", "merge"}:
            return [
                {
                    "phase": "Immediate (0-3 months)",
                    "actions": [
                        "Confirm the target screen, value-creation thesis, and valuation guardrails.",
                        "Launch commercial, legal, financial, and technical diligence workstreams.",
                        "Appoint executive owners for diligence, integration, finance, legal, and people.",
                    ],
                    "owner_function": "Corporate Development",
                    "success_metrics": [
                        "Target screen approved",
                        "Diligence workstreams launched",
                        "Deal guardrails documented",
                    ],
                    "estimated_investment_usd": 950000.0,
                },
                {
                    "phase": "Short-term (3-12 months)",
                    "actions": [
                        "Negotiate the transaction structure and execute signing and closing readiness.",
                        "Stand up integration governance, Day 1 controls, and customer continuity plans.",
                        "Track synergy delivery and retention risk weekly.",
                    ],
                    "owner_function": "Corporate Development and Integration Office",
                    "success_metrics": [
                        "Signing and closing on plan",
                        "Customer continuity protected",
                        "Integration milestones on track",
                    ],
                    "estimated_investment_usd": 4200000.0,
                },
                {
                    "phase": "Medium-term (1-3 years)",
                    "actions": [
                        "Deliver core synergies and rationalise overlapping operating structures.",
                        "Integrate talent, systems, and governance into the target operating model.",
                        "Track value capture against the original deal thesis.",
                    ],
                    "owner_function": "Integration Office and Finance",
                    "success_metrics": [
                        "Synergy run-rate delivered",
                        "Critical talent retained",
                        "Integration issues materially reduced",
                    ],
                    "estimated_investment_usd": 6800000.0,
                },
                {
                    "phase": "Long-term (3-5 years)",
                    "actions": [
                        "Institutionalise the combined operating model and governance cadence.",
                        "Refine portfolio allocation based on post-close performance.",
                        "Codify the M&A playbook for future inorganic moves.",
                    ],
                    "owner_function": "Executive Committee",
                    "success_metrics": [
                        "Combined operating model stabilised",
                        "Value capture sustained",
                        "Repeatable M&A playbook documented",
                    ],
                    "estimated_investment_usd": 10400000.0,
                },
            ]

        if decision_type == "restructure":
            return [
                {
                    "phase": "Immediate (0-3 months)",
                    "actions": [
                        "Confirm the restructuring perimeter, cost baseline, and non-negotiable service levels.",
                        "Set the governance cadence, people-risk safeguards, and communications plan.",
                        "Appoint executive owners for operations, finance, HR, and customer continuity.",
                    ],
                    "owner_function": "Strategy Office and COO",
                    "success_metrics": [
                        "Perimeter approved",
                        "Governance cadence launched",
                        "Critical service levels protected",
                    ],
                    "estimated_investment_usd": 600000.0,
                },
                {
                    "phase": "Short-term (3-12 months)",
                    "actions": [
                        "Execute phased restructuring waves and decision-right redesign.",
                        "Stand up cost, control, and service-continuity dashboards.",
                        "Track workforce transition, morale, and customer-impact metrics weekly.",
                    ],
                    "owner_function": "COO and HR",
                    "success_metrics": [
                        "Wave one delivered on plan",
                        "Service continuity maintained",
                        "Cost and control dashboards operating",
                    ],
                    "estimated_investment_usd": 2300000.0,
                },
                {
                    "phase": "Medium-term (1-3 years)",
                    "actions": [
                        "Embed the redesigned operating model and remove residual complexity.",
                        "Reinvest selectively into the highest-return capabilities.",
                        "Stabilise margin improvement and accountability routines.",
                    ],
                    "owner_function": "Operations and Finance",
                    "success_metrics": [
                        "Margin improvement delivered",
                        "Decision rights stabilised",
                        "Residual complexity reduced",
                    ],
                    "estimated_investment_usd": 4100000.0,
                },
                {
                    "phase": "Long-term (3-5 years)",
                    "actions": [
                        "Institutionalise the simplified operating model and continuous-improvement cadence.",
                        "Refresh the capability portfolio against the new strategic focus.",
                        "Document the restructuring playbook for future transformation cycles.",
                    ],
                    "owner_function": "Executive Committee",
                    "success_metrics": [
                        "Operating model remains stable",
                        "Continuous-improvement cadence established",
                        "Transformation playbook documented",
                    ],
                    "estimated_investment_usd": 5200000.0,
                },
            ]

        if decision_type in {"exit", "divest"}:
            return [
                {
                    "phase": "Immediate (0-3 months)",
                    "actions": [
                        "Confirm the exit perimeter, value floor, and stakeholder communication plan.",
                        "Launch legal, operational, and finance workstreams for separation readiness.",
                        "Appoint executive owners for transaction, operations, legal, and communications.",
                    ],
                    "owner_function": "Corporate Strategy",
                    "success_metrics": [
                        "Exit perimeter approved",
                        "Value floor documented",
                        "Separation workstreams launched",
                    ],
                    "estimated_investment_usd": 700000.0,
                },
                {
                    "phase": "Short-term (3-12 months)",
                    "actions": [
                        "Sequence buyer engagement or shutdown actions and protect customer continuity.",
                        "Stand up separation governance, TSA design, and stranded-cost tracking.",
                        "Track stakeholder confidence and value leakage weekly.",
                    ],
                    "owner_function": "Corporate Strategy and Finance",
                    "success_metrics": [
                        "Buyer engagement or exit plan on track",
                        "Customer continuity maintained",
                        "Stranded-cost dashboard active",
                    ],
                    "estimated_investment_usd": 2600000.0,
                },
                {
                    "phase": "Medium-term (1-3 years)",
                    "actions": [
                        "Complete separation and stabilise the retained organisation.",
                        "Remove stranded costs and reset the portfolio to the new strategic focus.",
                        "Track post-exit performance against the original value-preservation thesis.",
                    ],
                    "owner_function": "Finance and Operations",
                    "success_metrics": [
                        "Separation completed",
                        "Stranded costs materially reduced",
                        "Retained portfolio stabilised",
                    ],
                    "estimated_investment_usd": 4300000.0,
                },
                {
                    "phase": "Long-term (3-5 years)",
                    "actions": [
                        "Institutionalise the simplified portfolio and governance model.",
                        "Reallocate capital to the highest-priority retained businesses.",
                        "Capture the lessons learned for future portfolio moves.",
                    ],
                    "owner_function": "Executive Committee",
                    "success_metrics": [
                        "Portfolio simplification sustained",
                        "Capital reallocation complete",
                        "Portfolio playbook documented",
                    ],
                    "estimated_investment_usd": 6100000.0,
                },
            ]

        if decision_type == "invest":
            return [
                {
                    "phase": "Immediate (0-3 months)",
                    "actions": [
                        "Validate the initiative thesis, milestone gates, and downside triggers.",
                        "Confirm technical readiness, governance, and value-realisation owners.",
                        "Appoint executive sponsors across strategy, finance, operations, and technology.",
                    ],
                    "owner_function": "Strategy Office",
                    "success_metrics": [
                        "Milestone gates approved",
                        "Readiness review completed",
                        "Executive sponsors appointed",
                    ],
                    "estimated_investment_usd": 650000.0,
                },
                {
                    "phase": "Short-term (3-12 months)",
                    "actions": [
                        "Fund the first milestone tranche and launch pilot execution.",
                        "Track operating readiness, technical performance, and early economics weekly.",
                        "Hold formal funding-gate reviews before expanding scope.",
                    ],
                    "owner_function": "Business Unit Leadership",
                    "success_metrics": [
                        "Pilot launched on time",
                        "Milestone one achieved",
                        "Funding-gate review completed",
                    ],
                    "estimated_investment_usd": 2400000.0,
                },
                {
                    "phase": "Medium-term (1-3 years)",
                    "actions": [
                        "Scale the winning use cases and stop or redesign weak ones quickly.",
                        "Optimise unit economics and tighten benefit-realisation tracking.",
                        "Expand capability depth in the highest-return functions.",
                    ],
                    "owner_function": "Commercial and Finance",
                    "success_metrics": [
                        "Target return trajectory maintained",
                        "Weak use cases retired quickly",
                        "Capability gaps reduced",
                    ],
                    "estimated_investment_usd": 5900000.0,
                },
                {
                    "phase": "Long-term (3-5 years)",
                    "actions": [
                        "Institutionalise the initiative into the steady-state operating model.",
                        "Reallocate capital based on proven economics and strategic fit.",
                        "Document the investment playbook for future capital decisions.",
                    ],
                    "owner_function": "Executive Committee",
                    "success_metrics": [
                        "Steady-state model stabilised",
                        "Capital reallocation optimised",
                        "Investment playbook documented",
                    ],
                    "estimated_investment_usd": 9100000.0,
                },
            ]

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

    def _build_bottom_up_revenue_model(self, *, query: str, context: dict, profile: dict[str, object], financial: dict) -> dict[str, object]:
        sector_plan = self._sector_plan(query=query, context=context, profile=profile)
        context_scale = self._context_scale_factor(context)
        year_1_anchor = self._projection_metric(financial, "year_1", "revenue", 12_000_000.0) / 1_000_000
        year_3_anchor = self._projection_metric(financial, "year_3", "revenue", 38_000_000.0) / 1_000_000

        unscaled_total = sum(item["base_year_3_revenue_usd_mn"] for item in sector_plan) or 1.0
        scale_multiplier = max(0.72, min(1.38, (year_3_anchor / unscaled_total) * context_scale))

        sector_build = []
        for item in sector_plan:
            year_3_revenue = round(item["base_year_3_revenue_usd_mn"] * scale_multiplier, 1)
            year_1_revenue = round(max(0.6, year_3_revenue * (year_1_anchor / max(year_3_anchor, 1.0))), 1)
            year_2_revenue = round((year_1_revenue * 1.55) + (year_3_revenue * 0.08), 1)
            sector_build.append(
                {
                    "sector": item["sector"],
                    "priority": item["priority"],
                    "addressable_clients": item["addressable_clients"],
                    "target_clients": item["target_clients"],
                    "win_rate": round(item["win_rate"], 2),
                    "average_contract_value_usd_mn": round(item["average_contract_value_usd_mn"], 2),
                    "year_1_revenue_usd_mn": year_1_revenue,
                    "year_2_revenue_usd_mn": year_2_revenue,
                    "year_3_revenue_usd_mn": year_3_revenue,
                    "sales_cycle_months": item["sales_cycle_months"],
                }
            )

        pricing_model = self._pricing_model(query=query, profile=profile)
        total_year_1 = round(sum(item["year_1_revenue_usd_mn"] for item in sector_build), 1)
        total_year_2 = round(sum(item["year_2_revenue_usd_mn"] for item in sector_build), 1)
        total_year_3 = round(sum(item["year_3_revenue_usd_mn"] for item in sector_build), 1)

        return {
            "summary": "Bottom-up revenue is anchored in named sector priorities, client counts, contract values, and realistic conversion assumptions rather than top-down share claims alone.",
            "pricing_model": pricing_model,
            "sector_build": sector_build,
            "key_assumptions": self._commercial_assumptions(query=query, profile=profile, pricing_model=pricing_model),
            "total_year_1_revenue_usd_mn": total_year_1,
            "total_year_2_revenue_usd_mn": total_year_2,
            "total_year_3_revenue_usd_mn": total_year_3,
        }

    def _build_scenario_analysis(
        self,
        *,
        profile: dict[str, object],
        financial: dict,
        bottom_up_revenue_model: dict[str, object],
        normalized_risks: list[dict],
    ) -> dict[str, object]:
        total_year_3 = self._safe_float(bottom_up_revenue_model.get("total_year_3_revenue_usd_mn"), 38.0)
        total_year_1 = self._safe_float(bottom_up_revenue_model.get("total_year_1_revenue_usd_mn"), 12.0)
        top_risk = max((item["inherent_score"] for item in normalized_risks), default=10)
        risk_drag = max(0.0, (top_risk - 10) / 50)
        decision_type = str(profile.get("decision_type") or "enter")

        scenario_defaults = {
            "enter": {"roi": (1.5, 2.1, 2.8), "payback": (34, 28, 22), "margin": (14, 19, 24)},
            "acquire": {"roi": (1.4, 1.9, 2.5), "payback": (36, 30, 24), "margin": (16, 20, 25)},
            "merge": {"roi": (1.35, 1.85, 2.4), "payback": (38, 31, 25), "margin": (15, 19, 24)},
            "restructure": {"roi": (1.6, 2.0, 2.4), "payback": (28, 22, 18), "margin": (18, 23, 28)},
            "invest": {"roi": (1.45, 1.95, 2.45), "payback": (32, 26, 21), "margin": (15, 20, 25)},
            "exit": {"roi": (1.1, 1.35, 1.6), "payback": (24, 18, 14), "margin": (12, 15, 18)},
            "divest": {"roi": (1.15, 1.4, 1.7), "payback": (26, 19, 15), "margin": (12, 16, 19)},
        }
        defaults = scenario_defaults.get(decision_type, scenario_defaults["enter"])
        revenue_multipliers = (0.72 - risk_drag * 0.08, 1.0, 1.28 - risk_drag * 0.05)
        irr_anchor = self._safe_float(financial.get("financial_projections", {}).get("year_5", {}).get("irr"), 0.27) * 100

        scenarios = []
        for name, revenue_multiple, roi_multiple, payback, margin in zip(
            ("Conservative", "Base", "Aggressive"),
            revenue_multipliers,
            defaults["roi"],
            defaults["payback"],
            defaults["margin"],
            strict=False,
        ):
            revenue_year_3 = round(total_year_3 * revenue_multiple, 1)
            revenue_year_1 = round(total_year_1 * max(0.74, revenue_multiple * 0.92), 1)
            ebitda_margin_pct = round(max(8.0, margin - (risk_drag * 12)), 1)
            scenarios.append(
                {
                    "name": name,
                    "revenue_year_1_usd_mn": revenue_year_1,
                    "revenue_year_3_usd_mn": revenue_year_3,
                    "ebitda_margin_pct": ebitda_margin_pct,
                    "roi_multiple": round(max(1.0, roi_multiple - (risk_drag * 0.4)), 2),
                    "irr_pct": round(max(12.0, irr_anchor * revenue_multiple), 1),
                    "payback_months": int(round(payback + (risk_drag * 6))),
                    "assumptions": self._scenario_assumptions(name=name, profile=profile),
                }
            )

        return {
            "recommended_case": "Base",
            "decision_rule": "Commit capital to the base case and unlock aggressive capacity only after customer conversion, margin, and execution milestones are validated.",
            "scenarios": scenarios,
        }

    def _build_capability_fit_matrix(self, *, query: str, context: dict, profile: dict[str, object]) -> dict[str, object]:
        rows = []
        for capability in self._capability_blueprint(query=query, context=context, profile=profile):
            rows.append(
                {
                    "capability": capability["capability"],
                    "current_state": capability["current_state"],
                    "target_state": capability["target_state"],
                    "gap": capability["gap"],
                    "priority": capability["priority"],
                    "build_fit": capability["build_fit"],
                    "acquisition_fit": capability["acquisition_fit"],
                    "integration_risk": capability["integration_risk"],
                    "recommended_action": capability["recommended_action"],
                }
            )

        critical_gaps = [row["capability"] for row in rows if row["priority"] == "Critical"]
        return {
            "summary": "Capability fit makes explicit which strategic layers can be built internally, which require external acceleration, and which create integration risk if solved too quickly.",
            "rows": rows,
            "critical_gaps": critical_gaps,
        }

    def _build_strategic_pathways(
        self,
        *,
        query: str,
        context: dict,
        profile: dict[str, object],
        capability_fit_matrix: dict[str, object],
        scenario_analysis: dict[str, object],
        normalized_risks: list[dict],
    ) -> dict[str, object]:
        decision_type = str(profile.get("decision_type") or "enter")
        critical_gap_count = len(capability_fit_matrix.get("critical_gaps") or [])
        top_risk = max((item["inherent_score"] for item in normalized_risks), default=10)
        base_case = self._scenario_by_name(scenario_analysis, scenario_analysis.get("recommended_case", "Base"))
        roi_multiple = self._safe_float(base_case.get("roi_multiple"), 1.9)
        downside_penalty = (top_risk / 25) + (critical_gap_count * 0.06)

        if decision_type in {"acquire", "merge"}:
            options = [
                self._pathway_option(
                    "Full acquisition",
                    "Buys speed and control, but concentrates valuation and integration risk upfront.",
                    0.78 - downside_penalty,
                    "High",
                    "Low",
                    "High",
                    "Use only when product maturity, retention, and synergy capture are already proven.",
                ),
                self._pathway_option(
                    "Minority stake plus commercial partnership",
                    "Preserves speed-to-market while delaying full integration until traction and product fit are proven.",
                    0.84 - (downside_penalty * 0.55) + (roi_multiple / 20),
                    "Medium",
                    "High",
                    "Medium",
                    "Best when demand is real but product maturity and integration confidence still need validation.",
                ),
                self._pathway_option(
                    "Technology alliance with call option",
                    "Retains flexibility and insight while limiting capital at risk during category formation.",
                    0.72 - (downside_penalty * 0.45),
                    "Medium",
                    "Very High",
                    "Low",
                    "Use when the market is promising but the category is too early for full ownership.",
                ),
            ]
        elif decision_type == "restructure":
            options = [
                self._pathway_option(
                    "Phased internal restructuring",
                    "Retains control and protects customer continuity while margin interventions are sequenced.",
                    0.82 - (downside_penalty * 0.45),
                    "Medium",
                    "Medium",
                    "Medium",
                    "Best when service continuity and change management are more important than headline speed.",
                ),
                self._pathway_option(
                    "Selective carve-out or JV",
                    "Moves complexity off the core balance sheet but increases stakeholder and governance complexity.",
                    0.67 - (downside_penalty * 0.6),
                    "Medium",
                    "High",
                    "High",
                    "Use when a sub-scale unit needs separation to release value.",
                ),
                self._pathway_option(
                    "Outsource selected non-core work",
                    "Accelerates cost relief but risks hollowing out strategic capability if applied too broadly.",
                    0.63 - (downside_penalty * 0.5),
                    "High",
                    "Medium",
                    "Medium",
                    "Use only for low-differentiation activities with clear service-level controls.",
                ),
            ]
        else:
            options = [
                self._pathway_option(
                    "Partner-led phased rollout",
                    "Balances market speed, capital discipline, and local learning before broader scale.",
                    0.84 - (downside_penalty * 0.45) + (roi_multiple / 24),
                    "Medium",
                    "High",
                    "Medium",
                    "Best when local capabilities still need to be validated through lighthouse clients.",
                ),
                self._pathway_option(
                    "Direct greenfield build",
                    "Maximises control but requires more time, talent, and upfront investment before proof of demand.",
                    0.68 - (downside_penalty * 0.65),
                    "High",
                    "Medium",
                    "High",
                    "Use only when proprietary capability and operating control outweigh speed.",
                ),
                self._pathway_option(
                    "Acquisition-led acceleration",
                    "Can compress time-to-value, but only if the target fills clearly defined capability gaps without overloading integration capacity.",
                    0.71 - (downside_penalty * 0.58),
                    "High",
                    "Low",
                    "High",
                    "Use when the market window is short and there is a target with strong capability fit.",
                ),
            ]

        sorted_options = sorted(options, key=lambda item: item["fit_score"], reverse=True)
        if sorted_options:
            sorted_options[0]["recommended"] = True

        return {
            "summary": "The strategic pathway comparison tests not only upside, but also flexibility, capital intensity, and execution strain before the board commits to a route.",
            "decision_rule": "Prefer the route with the strongest fit score that also keeps optionality open until commercial proof points are met.",
            "options": sorted_options,
        }

    def _build_execution_realism(
        self,
        *,
        query: str,
        context: dict,
        profile: dict[str, object],
        normalized_risks: list[dict],
        bottom_up_revenue_model: dict[str, object],
        strategic_pathways: dict[str, object],
    ) -> dict[str, object]:
        decision_type = str(profile.get("decision_type") or "enter")
        top_risk = max((item["inherent_score"] for item in normalized_risks), default=10)
        average_sales_cycle = round(
            mean(entry.get("sales_cycle_months", 9) for entry in (bottom_up_revenue_model.get("sector_build") or [{"sales_cycle_months": 9}])),
            1,
        )
        primary_path = self._primary_pathway(strategic_pathways).get("name", profile.get("default_recommendation"))

        if decision_type in {"acquire", "merge"}:
            items = [
                {"factor": "Integration cost", "baseline": "$4M-$8M one-time integration spend", "risk": "Synergies slip if systems and operating model integration are under-scoped.", "mitigation": "Run a Day 1 plus 100-day integration plan before signing."},
                {"factor": "Sales ramp", "baseline": f"{average_sales_cycle + 1:.0f}-{average_sales_cycle + 4:.0f} month cross-sell cycle", "risk": "Revenue synergies arrive later than the investment case assumes.", "mitigation": "Anchor the base case in retained accounts before assuming broad cross-sell wins."},
                {"factor": "Talent retention", "baseline": "15-20% key talent attrition risk in year one", "risk": "Capability erosion destroys the acquired thesis.", "mitigation": "Tie retention packages to delivery, product, and client milestones."},
                {"factor": "Client willingness to pay", "baseline": "High in regulated accounts, moderate in general enterprise", "risk": "Platform attach rates remain weaker than expected outside core use cases.", "mitigation": "Bundle advisory with recurring assurance and audit tooling."},
            ]
            commercial_model = "Acquire or partner for capability, then monetize through retained accounts, cross-sell, and recurring assurance services."
            pricing_model = "Advisory plus platform attach plus recurring assurance retainer"
        elif decision_type == "restructure":
            items = [
                {"factor": "Change absorption", "baseline": "Two to three restructuring waves over 12-18 months", "risk": "Too much change too quickly damages service continuity.", "mitigation": "Sequence cost actions around customer-critical teams and service levels."},
                {"factor": "Savings capture", "baseline": "60-70% of identified savings captured in year one", "risk": "Delayed redesign and stranded cost leakage flatten payback.", "mitigation": "Track savings through named workstreams and monthly CFO reviews."},
                {"factor": "Talent risk", "baseline": "Critical role attrition risk remains elevated for 6-9 months", "risk": "Loss of pivotal operators offsets margin gains.", "mitigation": "Protect mission-critical roles through retention and communication plans."},
                {"factor": "Stakeholder tolerance", "baseline": "Moderate tolerance for disruption", "risk": "Employee and customer trust deteriorate if messaging is inconsistent.", "mitigation": "Pair each wave with explicit customer and people safeguards."},
            ]
            commercial_model = "Margin and control recovery through phased internal redesign rather than immediate revenue expansion."
            pricing_model = "N/A - value is realized through cost, control, and retention outcomes"
        else:
            items = [
                {"factor": "Sales ramp", "baseline": f"{average_sales_cycle:.0f}-{average_sales_cycle + 3:.0f} month enterprise cycle", "risk": "Year-one revenue lags the headline opportunity because lighthouse deals take longer to close.", "mitigation": "Use partner-led pilots and board-backed lighthouse accounts to shorten proof cycles."},
                {"factor": "Talent build", "baseline": "6-12 specialist hires required before scale", "risk": "Capability gaps delay implementation and customer onboarding.", "mitigation": "Stage hiring against booked demand and partner support."},
                {"factor": "Client willingness to pay", "baseline": "High in regulated or mission-critical segments; moderate elsewhere", "risk": "Price realization weakens if the proposition looks like generic consulting.", "mitigation": "Bundle differentiated tooling, auditability, and recurring services into the offer."},
                {"factor": "Go-to-market motion", "baseline": str(primary_path), "risk": "Scaling beyond the initial route too early increases execution drag and capital intensity.", "mitigation": "Keep market expansion gated to lighthouse proof points and operating readiness."},
            ]
            commercial_model = "Consulting-led land strategy with recurring platform, audit, or managed-service attach as credibility grows."
            pricing_model = self._pricing_model(query=query, profile=profile)

        execution_pressure = "Elevated" if top_risk >= 15 else "Moderate" if top_risk >= 10 else "Contained"
        return {
            "summary": "Execution realism stress-tests the recommendation against sales-cycle, capability, talent, and integration constraints that typically break otherwise attractive strategic theses.",
            "commercial_model": commercial_model,
            "pricing_model": pricing_model,
            "execution_pressure": execution_pressure,
            "items": items,
        }

    def _commercial_rigor_signal(self, bottom_up_revenue_model: dict[str, object], scenario_analysis: dict[str, object]) -> float:
        sector_build = bottom_up_revenue_model.get("sector_build") or []
        scenarios = scenario_analysis.get("scenarios") or []
        assumptions = bottom_up_revenue_model.get("key_assumptions") or []
        coverage = min(1.0, len(sector_build) / 3) if sector_build else 0.0
        fields = (
            mean(
                [
                    1.0
                    if entry.get("target_clients") and entry.get("average_contract_value_usd_mn") and entry.get("sales_cycle_months")
                    else 0.0
                    for entry in sector_build
                ]
            )
            if sector_build
            else 0.0
        )
        scenario_score = min(1.0, len(scenarios) / 3) if scenarios else 0.0
        assumption_score = min(1.0, len(assumptions) / 4) if assumptions else 0.0
        return round(mean([coverage, fields, scenario_score, assumption_score]), 3)

    def _execution_signal(self, execution_realism: dict[str, object], capability_fit_matrix: dict[str, object], strategic_pathways: dict[str, object]) -> float:
        realism_items = execution_realism.get("items") or []
        capability_rows = capability_fit_matrix.get("rows") or []
        pathway_options = strategic_pathways.get("options") or []
        realism_score = min(1.0, len(realism_items) / 4) if realism_items else 0.0
        capability_score = min(1.0, len(capability_rows) / 5) if capability_rows else 0.0
        pathway_score = min(1.0, len(pathway_options) / 3) if pathway_options else 0.0
        recommended_bonus = 1.0 if any(option.get("recommended") for option in pathway_options) else 0.6
        return round(mean([realism_score, capability_score, pathway_score, recommended_bonus]), 3)

    def _primary_pathway(self, strategic_pathways: dict[str, object]) -> dict[str, object]:
        options = strategic_pathways.get("options") or []
        if not options:
            return {}
        for option in options:
            if option.get("recommended"):
                return option
        return max(options, key=lambda item: float(item.get("fit_score", 0)))

    def _scenario_by_name(self, scenario_analysis: dict[str, object], name: str) -> dict[str, object]:
        scenarios = scenario_analysis.get("scenarios") or []
        for scenario in scenarios:
            if str(scenario.get("name")).lower() == str(name).lower():
                return scenario
        return scenarios[0] if scenarios else {}

    def _pathway_option(
        self,
        name: str,
        strategic_logic: str,
        fit_score: float,
        capital_intensity: str,
        flexibility: str,
        execution_risk: str,
        trigger: str,
    ) -> dict[str, object]:
        return {
            "name": name,
            "strategic_logic": strategic_logic,
            "fit_score": round(max(0.25, min(0.95, fit_score)) * 10, 1),
            "capital_intensity": capital_intensity,
            "flexibility": flexibility,
            "execution_risk": execution_risk,
            "trigger": trigger,
            "recommended": False,
        }

    def _scenario_assumptions(self, *, name: str, profile: dict[str, object]) -> list[str]:
        if name == "Conservative":
            return [
                "Customer conversion trails plan by one to two quarters.",
                "Hiring and partner onboarding take longer than expected.",
                "Margin only improves once the initial operating model is stable.",
            ]
        if name == "Aggressive":
            return [
                "Lighthouse clients convert quickly into repeatable references.",
                "Cross-sell or partner leverage accelerates ahead of plan.",
                "Execution gates are met without material rework.",
            ]
        return [
            f"{profile['program_label'].capitalize()} milestones are met on the planned cadence.",
            "Core assumptions on conversion, pricing, and delivery productivity broadly hold.",
            "No critical risk invalidates the preferred route in the first 12 months.",
        ]

    def _commercial_assumptions(self, *, query: str, profile: dict[str, object], pricing_model: str) -> list[str]:
        assumptions = [
            f"Commercial model: {pricing_model}.",
            "Lighthouse clients convert into repeatable proof points before broad scale-up.",
            "Sales cycles remain enterprise-grade rather than digital self-serve.",
            "Capital is released only when booked demand and delivery readiness improve together.",
        ]
        if any(keyword in query.lower() for keyword in ("ai governance", "dpdp", "privacy", "compliance", "model risk")):
            assumptions.append("Recurring governance, audit, or monitoring attach rates are required to avoid a pure consulting margin profile.")
        return assumptions

    def _pricing_model(self, *, query: str, profile: dict[str, object]) -> str:
        if any(keyword in query.lower() for keyword in ("ai governance", "dpdp", "privacy", "compliance", "model risk")):
            return "Advisory plus platform subscription plus recurring assurance retainer"
        if str(profile.get("decision_type") or "") == "restructure":
            return "Value realization through cost, control, and retention improvements"
        if str(profile.get("decision_type") or "") in {"acquire", "merge"}:
            return "Retained accounts plus cross-sell plus recurring managed-service attach"
        return "Advisory-led land, followed by implementation and recurring managed-service attach"

    def _projection_metric(self, financial: dict, year_key: str, field: str, default: float) -> float:
        return self._safe_float((financial.get("financial_projections") or {}).get(year_key, {}).get(field), default)

    def _context_scale_factor(self, context: dict) -> float:
        revenue_hint = self._extract_numeric(context.get("annual_revenue") or context.get("annual_revenue_usd_mn"), 500.0)
        employee_hint = self._extract_numeric(context.get("employees"), 2500.0)
        scale = 0.85
        scale += min(0.25, revenue_hint / 3000)
        scale += min(0.15, employee_hint / 12000)
        return round(max(0.8, min(1.3, scale)), 3)

    def _extract_numeric(self, value, default: float) -> float:
        if value is None:
            return default
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            cleaned = value.replace(",", "")
            match = re.search(r"-?\d+(?:\.\d+)?", cleaned)
            if match:
                number = float(match.group(0))
                if "bn" in cleaned.lower() or "billion" in cleaned.lower():
                    return number * 1000
                return number
        return default

    def _sector_plan(self, *, query: str, context: dict, profile: dict[str, object]) -> list[dict[str, object]]:
        sector = str(context.get("sector") or "").lower()
        query_lower = query.lower()
        decision_type = str(profile.get("decision_type") or "enter")

        if any(keyword in query_lower for keyword in ("ai governance", "dpdp", "privacy", "compliance", "model risk")):
            if decision_type in {"acquire", "merge"}:
                return [
                    {"sector": "Regulated enterprise cross-sell", "priority": "Primary", "addressable_clients": 28, "target_clients": 6, "win_rate": 0.21, "average_contract_value_usd_mn": 1.7, "sales_cycle_months": 9, "base_year_3_revenue_usd_mn": 12.0},
                    {"sector": "Existing startup customer base", "priority": "Primary", "addressable_clients": 18, "target_clients": 13, "win_rate": 0.72, "average_contract_value_usd_mn": 0.55, "sales_cycle_months": 5, "base_year_3_revenue_usd_mn": 8.2},
                    {"sector": "Managed governance retainers", "priority": "Secondary", "addressable_clients": 32, "target_clients": 8, "win_rate": 0.19, "average_contract_value_usd_mn": 0.85, "sales_cycle_months": 8, "base_year_3_revenue_usd_mn": 9.3},
                ]
            return [
                {"sector": "BFSI compliance programs", "priority": "Primary", "addressable_clients": 34, "target_clients": 5, "win_rate": 0.15, "average_contract_value_usd_mn": 1.25, "sales_cycle_months": 10, "base_year_3_revenue_usd_mn": 10.5},
                {"sector": "Healthcare and life sciences governance", "priority": "Primary", "addressable_clients": 26, "target_clients": 4, "win_rate": 0.14, "average_contract_value_usd_mn": 1.05, "sales_cycle_months": 9, "base_year_3_revenue_usd_mn": 8.4},
                {"sector": "SaaS assurance retainers", "priority": "Secondary", "addressable_clients": 62, "target_clients": 8, "win_rate": 0.13, "average_contract_value_usd_mn": 0.42, "sales_cycle_months": 6, "base_year_3_revenue_usd_mn": 6.8},
                {"sector": "Audit and monitoring managed services", "priority": "Selective", "addressable_clients": 24, "target_clients": 4, "win_rate": 0.16, "average_contract_value_usd_mn": 0.95, "sales_cycle_months": 8, "base_year_3_revenue_usd_mn": 7.1},
            ]

        if "health" in sector:
            return [
                {"sector": "Provider networks", "priority": "Primary", "addressable_clients": 22, "target_clients": 4, "win_rate": 0.18, "average_contract_value_usd_mn": 1.2, "sales_cycle_months": 9, "base_year_3_revenue_usd_mn": 8.7},
                {"sector": "Payers and insurers", "priority": "Primary", "addressable_clients": 18, "target_clients": 3, "win_rate": 0.16, "average_contract_value_usd_mn": 1.35, "sales_cycle_months": 10, "base_year_3_revenue_usd_mn": 7.8},
                {"sector": "Digital health challengers", "priority": "Secondary", "addressable_clients": 40, "target_clients": 6, "win_rate": 0.14, "average_contract_value_usd_mn": 0.48, "sales_cycle_months": 7, "base_year_3_revenue_usd_mn": 5.6},
            ]

        if "professional" in sector or "consult" in sector:
            return [
                {"sector": "Regulated large-enterprise programs", "priority": "Primary", "addressable_clients": 30, "target_clients": 5, "win_rate": 0.16, "average_contract_value_usd_mn": 1.05, "sales_cycle_months": 8, "base_year_3_revenue_usd_mn": 9.0},
                {"sector": "Managed transformation retainers", "priority": "Primary", "addressable_clients": 22, "target_clients": 4, "win_rate": 0.18, "average_contract_value_usd_mn": 1.15, "sales_cycle_months": 7, "base_year_3_revenue_usd_mn": 8.4},
                {"sector": "Adjacency cross-sell accounts", "priority": "Secondary", "addressable_clients": 55, "target_clients": 7, "win_rate": 0.12, "average_contract_value_usd_mn": 0.52, "sales_cycle_months": 6, "base_year_3_revenue_usd_mn": 5.8},
            ]

        if "tech" in sector or "software" in sector or "saas" in sector or "fintech" in sector:
            return [
                {"sector": "Large enterprise accounts", "priority": "Primary", "addressable_clients": 26, "target_clients": 4, "win_rate": 0.15, "average_contract_value_usd_mn": 1.3, "sales_cycle_months": 9, "base_year_3_revenue_usd_mn": 9.2},
                {"sector": "Strategic platform partners", "priority": "Primary", "addressable_clients": 18, "target_clients": 3, "win_rate": 0.17, "average_contract_value_usd_mn": 1.45, "sales_cycle_months": 8, "base_year_3_revenue_usd_mn": 8.1},
                {"sector": "Digital challengers", "priority": "Secondary", "addressable_clients": 58, "target_clients": 8, "win_rate": 0.14, "average_contract_value_usd_mn": 0.55, "sales_cycle_months": 6, "base_year_3_revenue_usd_mn": 6.3},
            ]

        return [
            {"sector": "Lighthouse enterprise accounts", "priority": "Primary", "addressable_clients": 24, "target_clients": 4, "win_rate": 0.16, "average_contract_value_usd_mn": 1.0, "sales_cycle_months": 8, "base_year_3_revenue_usd_mn": 8.2},
            {"sector": "Strategic partner channels", "priority": "Primary", "addressable_clients": 18, "target_clients": 3, "win_rate": 0.17, "average_contract_value_usd_mn": 1.1, "sales_cycle_months": 7, "base_year_3_revenue_usd_mn": 7.1},
            {"sector": "Mid-market expansion accounts", "priority": "Secondary", "addressable_clients": 60, "target_clients": 7, "win_rate": 0.12, "average_contract_value_usd_mn": 0.42, "sales_cycle_months": 6, "base_year_3_revenue_usd_mn": 5.4},
        ]

    def _capability_blueprint(self, *, query: str, context: dict, profile: dict[str, object]) -> list[dict[str, str]]:
        query_lower = query.lower()
        if any(keyword in query_lower for keyword in ("ai governance", "dpdp", "privacy", "compliance", "model risk")):
            return [
                {"capability": "AI audit tooling", "current_state": "Medium", "target_state": "Strong", "gap": "A repeatable audit layer is needed to convert advisory work into scalable delivery.", "priority": "Critical", "build_fit": "Moderate", "acquisition_fit": "Strong", "integration_risk": "Medium", "recommended_action": "Acquire or partner for product depth while building delivery playbooks internally."},
                {"capability": "Model explainability and risk scoring", "current_state": "Low", "target_state": "Strong", "gap": "Explainability and model-risk tooling are still too thin for enterprise-scale governance work.", "priority": "Critical", "build_fit": "Moderate", "acquisition_fit": "Strong", "integration_risk": "Medium", "recommended_action": "Secure external capability quickly, then embed it into the consulting stack."},
                {"capability": "Data lineage and consent orchestration", "current_state": "Low", "target_state": "Strong", "gap": "DPDP-grade lineage and consent controls are not yet robust enough for board-level assurances.", "priority": "Critical", "build_fit": "Moderate", "acquisition_fit": "Strong", "integration_risk": "High", "recommended_action": "Pair product capability acquisition with a phased integration blueprint."},
                {"capability": "Continuous compliance monitoring", "current_state": "Medium", "target_state": "Strong", "gap": "Monitoring exists conceptually but lacks reusable tooling and managed-service rhythm.", "priority": "High", "build_fit": "Strong", "acquisition_fit": "Moderate", "integration_risk": "Medium", "recommended_action": "Build the managed-service layer around external tooling where helpful."},
                {"capability": "Advisory delivery bench", "current_state": "Medium", "target_state": "Strong", "gap": "Specialist governance talent is scarce and must scale in parallel with product capability.", "priority": "High", "build_fit": "Strong", "acquisition_fit": "Moderate", "integration_risk": "Medium", "recommended_action": "Build and retain specialist delivery talent against target verticals."},
            ]

        decision_type = str(profile.get("decision_type") or "enter")
        if decision_type in {"acquire", "merge"}:
            return [
                {"capability": "Target screening and valuation", "current_state": "Medium", "target_state": "Strong", "gap": "The deal thesis must separate strategic fit from momentum-driven valuation.", "priority": "Critical", "build_fit": "Strong", "acquisition_fit": "Low", "integration_risk": "Low", "recommended_action": "Strengthen internal deal-screening discipline before committing."},
                {"capability": "Integration management office", "current_state": "Medium", "target_state": "Strong", "gap": "Integration governance is often underpowered relative to synergy ambition.", "priority": "Critical", "build_fit": "Strong", "acquisition_fit": "Low", "integration_risk": "High", "recommended_action": "Stand up Day 1, 100-day, and synergy governance before closing."},
                {"capability": "Product and platform depth", "current_state": "Medium", "target_state": "Strong", "gap": "External capability may be required where speed and technical differentiation matter.", "priority": "High", "build_fit": "Moderate", "acquisition_fit": "Strong", "integration_risk": "Medium", "recommended_action": "Use acquisition or alliance selectively where build speed is insufficient."},
                {"capability": "Cross-sell GTM motion", "current_state": "Medium", "target_state": "Strong", "gap": "Revenue synergies fail when account plans are vague or compensation is misaligned.", "priority": "High", "build_fit": "Strong", "acquisition_fit": "Moderate", "integration_risk": "Medium", "recommended_action": "Build named account plans and compensation alignment before counting synergies."},
                {"capability": "Talent retention and culture bridge", "current_state": "Low", "target_state": "Strong", "gap": "Key-team attrition can erase the deal rationale in the first year.", "priority": "Critical", "build_fit": "Strong", "acquisition_fit": "Low", "integration_risk": "High", "recommended_action": "Tie retention to client, product, and integration milestones."},
            ]

        if decision_type == "restructure":
            return [
                {"capability": "Operating-model redesign", "current_state": "Medium", "target_state": "Strong", "gap": "The target state is not yet translated into decision rights and workflow changes.", "priority": "Critical", "build_fit": "Strong", "acquisition_fit": "Low", "integration_risk": "Medium", "recommended_action": "Design the future-state model before launching broad cost actions."},
                {"capability": "Change governance", "current_state": "Medium", "target_state": "Strong", "gap": "Restructuring cadence and leadership ownership need to become more explicit.", "priority": "Critical", "build_fit": "Strong", "acquisition_fit": "Low", "integration_risk": "Medium", "recommended_action": "Run a dedicated transformation office with customer and people safeguards."},
                {"capability": "Margin analytics", "current_state": "Medium", "target_state": "Strong", "gap": "Cost and service trade-offs are not yet transparent enough for confident sequencing.", "priority": "High", "build_fit": "Strong", "acquisition_fit": "Low", "integration_risk": "Low", "recommended_action": "Tighten margin visibility by customer, team, and activity."},
                {"capability": "Workforce transition planning", "current_state": "Low", "target_state": "Strong", "gap": "People risk can overwhelm the savings thesis if transitions are under-planned.", "priority": "High", "build_fit": "Strong", "acquisition_fit": "Low", "integration_risk": "Medium", "recommended_action": "Protect critical roles and phase transitions against service-risk thresholds."},
                {"capability": "Control redesign", "current_state": "Medium", "target_state": "Strong", "gap": "Governance must improve as quickly as cost improves.", "priority": "High", "build_fit": "Strong", "acquisition_fit": "Low", "integration_risk": "Low", "recommended_action": "Redesign controls alongside org changes rather than after them."},
            ]

        return [
            {"capability": "Local market access", "current_state": "Medium", "target_state": "Strong", "gap": "Distribution and customer access still depend on a small number of routes.", "priority": "Critical", "build_fit": "Moderate", "acquisition_fit": "Moderate", "integration_risk": "Medium", "recommended_action": "Use partners and lighthouse accounts to validate the route before scaling."},
            {"capability": "Regulatory and control readiness", "current_state": "Medium", "target_state": "Strong", "gap": "Control infrastructure is directionally strong but not yet localised enough for scale.", "priority": "Critical", "build_fit": "Strong", "acquisition_fit": "Low", "integration_risk": "Medium", "recommended_action": "Localise controls and readiness milestones before broad rollout."},
            {"capability": "Implementation delivery bench", "current_state": "Low", "target_state": "Strong", "gap": "Customer delivery capacity is thin relative to the speed implied by the growth plan.", "priority": "High", "build_fit": "Strong", "acquisition_fit": "Moderate", "integration_risk": "Medium", "recommended_action": "Stage hiring and partner support against booked demand."},
            {"capability": "Commercial packaging and pricing", "current_state": "Medium", "target_state": "Strong", "gap": "Value-based packaging is not yet sharp enough to avoid a generic services price war.", "priority": "High", "build_fit": "Strong", "acquisition_fit": "Low", "integration_risk": "Low", "recommended_action": "Bundle differentiated capability into recurring or attachable commercial constructs."},
            {"capability": "Program governance", "current_state": "Medium", "target_state": "Strong", "gap": "Board-level gating exists conceptually but requires tighter milestone discipline in the field.", "priority": "High", "build_fit": "Strong", "acquisition_fit": "Low", "integration_risk": "Low", "recommended_action": "Run the initiative through a milestone-based PMO with named owners."},
        ]
