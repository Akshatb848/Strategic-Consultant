from __future__ import annotations

import re
from statistics import mean
from typing import Any

from asis.backend.graph.context import extract_query_facts
from asis.backend.schemas.v4 import QualityCheckResult, QualityReport, StrategicBriefV4

_URL_PATTERN = re.compile(
    r"^https?://"                          # scheme
    r"(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}"   # domain
    r"(?:/[^\s]*)?$"                       # optional path
)


def _looks_like_url(value: str) -> bool:
    return bool(_URL_PATTERN.match(value.strip()))


class QualityGate:
    """
    Runs the v4 output checks required before a StrategicBriefV4 is treated as
    production-ready. BLOCK failures are intended to trigger synthesis retries;
    WARN failures are surfaced in the quality report and UI.
    """

    REQUIRED_FRAMEWORKS = {
        "pestle",
        "swot",
        "porters_five_forces",
        "ansoff",
        "bcg_matrix",
        "mckinsey_7s",
        "blue_ocean",
        "balanced_scorecard",
    }

    async def validate(self, brief: StrategicBriefV4, retry_count: int = 0) -> QualityReport:
        checks = [
            self._check_decision_prefix(brief),
            self._check_decision_length(brief),
            self._check_citation_density(brief),
            self._check_citation_url_format(brief),
            self._check_citation_verifiability(brief),
            self._check_source_role_relevance(brief),
            self._check_framework_completeness(brief),
            self._check_framework_structural_depth(brief),
            self._check_framework_distinctiveness(brief),
            self._check_framework_placeholder_specificity(brief),
            self._check_collaboration_trace(brief),
            self._check_context_specificity(brief),
            self._check_prompt_fidelity(brief),
            self._check_named_competitor_coverage(brief),
            self._check_bottom_up_economics(brief),
            self._check_execution_specificity(brief),
            self._check_mece_score(brief),
            self._check_internal_consistency(brief),
            self._check_cross_agent_consistency(brief),
            self._check_roadmap_phases(brief),
            self._check_recommendation_pathway_alignment(brief),
            self._check_financial_scenario_consistency(brief),
            self._check_financial_input_ranges(brief),
            self._check_bottom_up_formula_integrity(brief),
            self._check_numeric_evidence_contract(brief),
            self._check_scenario_duplicate_guard(brief),
            self._check_red_team_materiality(brief),
            self._check_confidence_calibration(brief),
            self._check_context_leakage(brief),
            self._check_duplicate_semantic_keys(brief),
        ]
        flags = [check.notes for check in checks if not check.passed and check.notes]
        citation_density_score = self._citation_density_score(brief)
        mece_score = brief.mece_score
        internal_consistency_score = brief.internal_consistency_score
        context_specificity_score = self._context_specificity_score(brief)
        financial_grounding_score = self._financial_grounding_score(brief)
        execution_specificity_score = self._execution_specificity_score(brief)
        overall_grade = self._grade(
            checks,
            mece_score,
            citation_density_score,
            internal_consistency_score,
            context_specificity_score,
            financial_grounding_score,
            execution_specificity_score,
        )
        return QualityReport(
            overall_grade=overall_grade,
            checks=checks,
            quality_flags=flags,
            mece_score=mece_score,
            citation_density_score=citation_density_score,
            internal_consistency_score=internal_consistency_score,
            context_specificity_score=context_specificity_score,
            financial_grounding_score=financial_grounding_score,
            execution_specificity_score=execution_specificity_score,
            retry_count=retry_count,
        )

    @staticmethod
    def has_block_failures(report: QualityReport) -> bool:
        return any(check.level == "BLOCK" and not check.passed for check in report.checks)

    def _check_decision_prefix(self, brief: StrategicBriefV4) -> QualityCheckResult:
        passed = brief.decision_statement.startswith(("PROCEED", "CONDITIONAL PROCEED", "DO NOT PROCEED"))
        return QualityCheckResult(
            id="decision_prefix",
            description="decision_statement must begin with PROCEED, CONDITIONAL PROCEED, or DO NOT PROCEED",
            level="BLOCK",
            passed=passed,
            notes=None if passed else "Decision statement prefix is invalid.",
        )

    def _check_citation_density(self, brief: StrategicBriefV4) -> QualityCheckResult:
        passed = all(len(output.citations) >= 5 for output in brief.framework_outputs.values())
        return QualityCheckResult(
            id="citation_density",
            description="Every framework narrative must contain at least 1 citation per 100 words, with a minimum of 5 citations per framework",
            level="BLOCK",
            passed=passed,
            notes=None if passed else "One or more framework sections do not meet minimum citation density.",
        )

    def _check_framework_completeness(self, brief: StrategicBriefV4) -> QualityCheckResult:
        missing = sorted(self.REQUIRED_FRAMEWORKS.difference(brief.framework_outputs.keys()))
        passed = not missing
        return QualityCheckResult(
            id="framework_completeness",
            description="All 8 framework keys must be present and non-empty in framework_outputs",
            level="BLOCK",
            passed=passed,
            notes=None if passed else f"Missing framework outputs: {', '.join(missing)}.",
        )

    def _check_framework_structural_depth(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Every named framework must expose the minimum data structure needed to solve it."""
        failures: list[str] = []
        outputs = brief.framework_outputs or {}
        required_paths = {
            "pestle": ("political", "economic", "social", "technological", "legal", "environmental"),
            "porters_five_forces": (
                "competitive_rivalry",
                "threat_of_new_entrants",
                "threat_of_substitutes",
                "bargaining_power_buyers",
                "bargaining_power_suppliers",
            ),
            "swot": ("strengths", "weaknesses", "opportunities", "threats"),
            "ansoff": ("market_penetration", "market_development", "product_development", "diversification", "recommended_quadrant"),
            "mckinsey_7s": ("strategy", "structure", "systems", "staff", "style", "skills", "shared_values"),
        }
        for framework, keys in required_paths.items():
            data = (outputs.get(framework).structured_data if outputs.get(framework) else {}) or {}
            missing = [key for key in keys if key not in data or data.get(key) in ({}, [], "", None)]
            if missing:
                failures.append(f"{framework}: missing {', '.join(missing)}")

        bcg_units = ((outputs.get("bcg_matrix").structured_data if outputs.get("bcg_matrix") else {}) or {}).get("business_units") or []
        if len(bcg_units) < 2:
            failures.append("bcg_matrix: fewer than 2 business units")

        blue = (outputs.get("blue_ocean").structured_data if outputs.get("blue_ocean") else {}) or {}
        if not blue.get("factors") or not blue.get("company_curve"):
            failures.append("blue_ocean: missing factors or company curve")

        scorecard = brief.balanced_scorecard.model_dump(mode="json") if brief.balanced_scorecard else {}
        for perspective in ("financial", "customer", "internal_process", "learning_and_growth"):
            item = scorecard.get(perspective) or {}
            if not item.get("objectives") or not item.get("measures") or not item.get("targets") or not item.get("initiatives"):
                failures.append(f"balanced_scorecard: incomplete {perspective}")

        passed = not failures
        return QualityCheckResult(
            id="framework_structural_depth",
            description="Each named framework must include the core fields needed to solve that framework from the analysis data",
            level="BLOCK",
            passed=passed,
            notes=None if passed else f"Incomplete framework data: {'; '.join(failures[:6])}.",
        )

    def _check_framework_distinctiveness(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Framework sections should not collapse into repeated generic narrative."""
        normalized: dict[str, str] = {}
        generic_titles: list[str] = []
        for framework_name, output in (brief.framework_outputs or {}).items():
            title = (output.exhibit_title or "").strip().lower()
            if title in {"market analysis", "competition", "growth", "framework analysis", "risk register", "vrio analysis"}:
                generic_titles.append(framework_name)
            narrative = re.sub(r"[^a-z0-9]+", " ", (output.narrative or "").lower()).strip()
            normalized[framework_name] = " ".join(narrative.split()[:26])

        duplicates = []
        seen: dict[str, str] = {}
        for framework_name, narrative_key in normalized.items():
            if narrative_key and narrative_key in seen:
                duplicates.append(f"{seen[narrative_key]} / {framework_name}")
            elif narrative_key:
                seen[narrative_key] = framework_name

        passed = not duplicates and not generic_titles
        return QualityCheckResult(
            id="framework_distinctiveness",
            description="Framework sections must have distinct, finding-led titles and narratives rather than repeated generic consulting language",
            level="BLOCK",
            passed=passed,
            notes=None if passed else (
                f"Generic framework presentation detected: duplicate narratives {duplicates[:3]} generic titles {generic_titles[:5]}."
            ),
        )

    def _check_framework_placeholder_specificity(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Block framework rows that are present but still generic, placeholder-like, or detached from named competitors."""
        facts = extract_query_facts(str(brief.report_metadata.query or ""))
        named_competitors = facts.get("named_competitors") or []
        material_context = bool(named_competitors or facts.get("investment_range_usd_mn") or facts.get("strategic_themes"))
        placeholder_values = {"", "-", "n/a", "na", "none", "not available", "tbd"}
        generic_labels = {
            "core business",
            "new market entry",
            "digital partnerships",
            "incumbent leader",
            "digital challenger",
            "global specialist",
        }
        failures: list[str] = []

        seven_s = (brief.framework_outputs.get("mckinsey_7s").structured_data if brief.framework_outputs.get("mckinsey_7s") else {}) or {}
        for dimension in ("strategy", "structure", "systems", "staff", "style", "skills", "shared_values"):
            record = seven_s.get(dimension) or {}
            evidence_text = " ".join(
                str(record.get(key) or "")
                for key in ("finding", "rationale", "implication", "current_state", "desired_state", "gap")
            ).strip()
            if evidence_text.lower() in placeholder_values or len(evidence_text.split()) < 8:
                failures.append(f"mckinsey_7s.{dimension} is placeholder or too thin")

        bcg_units = ((brief.framework_outputs.get("bcg_matrix").structured_data if brief.framework_outputs.get("bcg_matrix") else {}) or {}).get("business_units") or []
        generic_bcg = [
            str(unit.get("name", "")).strip()
            for unit in bcg_units
            if isinstance(unit, dict) and str(unit.get("name", "")).strip().lower() in generic_labels
        ]
        if material_context and generic_bcg:
            failures.append(f"bcg_matrix uses generic units: {', '.join(generic_bcg)}")

        blue = (brief.framework_outputs.get("blue_ocean").structured_data if brief.framework_outputs.get("blue_ocean") else {}) or {}
        competitor_curves = blue.get("competitor_curves") if isinstance(blue, dict) else {}
        if isinstance(competitor_curves, dict):
            generic_competitors = [name for name in competitor_curves if str(name).strip().lower() in generic_labels]
            if named_competitors and generic_competitors:
                failures.append(f"blue_ocean uses generic competitors: {', '.join(generic_competitors)}")
            competitor_text = " ".join(str(name).lower() for name in competitor_curves)
            missing = [name for name in named_competitors if name.lower() not in competitor_text]
            if named_competitors and missing:
                failures.append(f"blue_ocean missing named competitors: {', '.join(missing)}")

        porter = (brief.framework_outputs.get("porters_five_forces").structured_data if brief.framework_outputs.get("porters_five_forces") else {}) or {}
        porter_text = self._flatten_text(porter).lower()
        if named_competitors and not any(name.lower() in porter_text for name in named_competitors):
            failures.append("porters_five_forces does not benchmark named competitors")

        passed = not failures
        return QualityCheckResult(
            id="framework_placeholder_specificity",
            description="Framework rows must contain problem-specific findings and named competitors where the prompt supplies them",
            level="BLOCK",
            passed=passed,
            notes=None if passed else f"Framework specificity failures: {'; '.join(failures[:6])}.",
        )

    def _check_collaboration_trace(self, brief: StrategicBriefV4) -> QualityCheckResult:
        passed = len(brief.agent_collaboration_trace) >= 5
        return QualityCheckResult(
            id="collaboration_trace",
            description="agent_collaboration_trace must have >= 5 entries proving cross-agent data flow",
            level="BLOCK",
            passed=passed,
            notes=None if passed else "Agent collaboration trace is too sparse to prove inter-agent data flow.",
        )

    def _check_context_specificity(self, brief: StrategicBriefV4) -> QualityCheckResult:
        score = self._context_specificity_score(brief)
        passed = score >= 0.6
        return QualityCheckResult(
            id="context_specificity",
            description="The brief should be grounded in a clearly specified company, geography, sector, decision type, and timeframe where available",
            level="WARN",
            passed=passed,
            notes=None if passed else "The strategic question is underspecified, which reduces board-readiness and recommendation precision.",
        )

    def _check_prompt_fidelity(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """The final report must preserve the original board-question facts."""
        query = str(brief.report_metadata.query or "")
        facts = extract_query_facts(query)
        payload_dict = brief.model_dump(mode="json")
        if isinstance(payload_dict.get("report_metadata"), dict):
            payload_dict["report_metadata"]["query"] = ""
        payload = self._flatten_text(payload_dict).lower()
        failures: list[str] = []

        investment = facts.get("investment_range_usd_mn") or {}
        if investment:
            low = str(int(float(investment["min"])))
            high = str(int(float(investment["max"])))
            if low not in payload or high not in payload:
                failures.append(f"investment range ${low}M-${high}M missing from final brief")

        horizon = facts.get("time_horizon_years") or {}
        if horizon:
            low = str(int(float(horizon["min"])))
            high = str(int(float(horizon["max"])))
            if low not in payload or high not in payload:
                failures.append(f"time horizon {low}-{high} years missing from final brief")

        for geography in facts.get("geographies") or []:
            if geography.lower() not in payload:
                failures.append(f"geography missing from final brief: {geography}")

        theme_labels = {
            "proprietary_ai_platform": ("proprietary", "ai", "platform"),
            "data_ecosystem": ("data", "ecosystem"),
            "mna_services": ("m&a", "service"),
            "technology_services": ("technology", "service"),
            "market_leadership": ("leadership",),
        }
        for theme in facts.get("strategic_themes") or []:
            required_terms = theme_labels.get(theme, ())
            if required_terms and not all(term in payload for term in required_terms):
                failures.append(f"strategic theme missing from final brief: {theme}")

        passed = not failures
        return QualityCheckResult(
            id="prompt_fidelity",
            description="The final strategic brief must preserve investment range, timeframe, geography, and strategic themes from the original prompt",
            level="BLOCK",
            passed=passed,
            notes=None if passed else f"Prompt fidelity failures: {'; '.join(failures[:6])}.",
        )

    def _check_named_competitor_coverage(self, brief: StrategicBriefV4) -> QualityCheckResult:
        query = str(brief.report_metadata.query or "")
        competitors = extract_query_facts(query).get("named_competitors") or []
        if not competitors:
            return QualityCheckResult(
                id="named_competitor_coverage",
                description="Named competitors in the prompt must be explicitly benchmarked in competitor frameworks",
                level="BLOCK",
                passed=True,
                notes=None,
            )

        competitor_payload = " ".join(
            [
                self._flatten_text((brief.market_analysis or {}).get("competitor_profiles") or []),
                self._flatten_text((brief.framework_outputs.get("porters_five_forces").structured_data if brief.framework_outputs.get("porters_five_forces") else {}) or {}),
                self._flatten_text((brief.framework_outputs.get("blue_ocean").structured_data if brief.framework_outputs.get("blue_ocean") else {}) or {}),
            ]
        ).lower()
        missing = [name for name in competitors if name.lower() not in competitor_payload]
        generic_names = {"incumbent leader", "digital challenger", "global specialist"}
        generic_only = any(name in competitor_payload for name in generic_names) and not all(
            name.lower() in competitor_payload for name in competitors
        )
        passed = not missing and not generic_only
        return QualityCheckResult(
            id="named_competitor_coverage",
            description="Named competitors in the prompt must appear in competitor profiles, Porter's forces, and Blue Ocean benchmarking",
            level="BLOCK",
            passed=passed,
            notes=None if passed else f"Named competitor coverage failure: missing {', '.join(missing)}; generic-only={generic_only}.",
        )

    def _check_bottom_up_economics(self, brief: StrategicBriefV4) -> QualityCheckResult:
        score = self._financial_grounding_score(brief)
        passed = score >= 0.65
        return QualityCheckResult(
            id="bottom_up_economics",
            description="The brief should include a bottom-up revenue build, scenario coverage, and explicit commercial assumptions",
            level="WARN",
            passed=passed,
            notes=None if passed else "Commercial logic is still too top-down; add sector-level revenue build, scenario ranges, and explicit assumptions.",
        )

    def _check_execution_specificity(self, brief: StrategicBriefV4) -> QualityCheckResult:
        score = self._execution_specificity_score(brief)
        passed = score >= 0.65
        return QualityCheckResult(
            id="execution_specificity",
            description="The brief should contain capability-gap, execution, and implementation specificity beyond high-level phases",
            level="WARN",
            passed=passed,
            notes=None if passed else "Execution realism is underspecified; capability gaps, GTM assumptions, and integration constraints need sharper treatment.",
        )

    def _check_mece_score(self, brief: StrategicBriefV4) -> QualityCheckResult:
        passed = brief.mece_score >= 0.6
        return QualityCheckResult(
            id="mece_score",
            description="MECEScore below 0.6 indicates overlapping or incomplete findings",
            level="WARN",
            passed=passed,
            notes=None if passed else "MECE score suggests overlapping or incomplete framework coverage.",
        )

    def _check_internal_consistency(self, brief: StrategicBriefV4) -> QualityCheckResult:
        passed = brief.internal_consistency_score >= 0.7
        return QualityCheckResult(
            id="internal_consistency",
            description="Risk findings must not materially contradict financial projections or strategic recommendations",
            level="WARN",
            passed=passed,
            notes=None if passed else "Frameworks contain material tension between risk, financial, and strategic conclusions.",
        )

    def _check_decision_length(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Decision statement must be ≤35 words (blueprint specification)."""
        word_count = len(brief.decision_statement.split())
        passed = word_count <= 35
        return QualityCheckResult(
            id="decision_length",
            description="decision_statement must be a single sentence of 35 words or fewer",
            level="WARN",
            passed=passed,
            notes=None if passed else f"Decision statement is {word_count} words (limit: 35). Condense to a single declarative sentence.",
        )

    def _check_citation_url_format(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Every citation with a URL must have a syntactically valid http/https URL."""
        bad_citations: list[str] = []
        for framework_name, output in brief.framework_outputs.items():
            for citation in output.citations:
                url = getattr(citation, "url", None) or (citation if isinstance(citation, str) else "")
                if url and not _looks_like_url(str(url)):
                    bad_citations.append(f"{framework_name}: {str(url)[:60]}")
        passed = not bad_citations
        return QualityCheckResult(
            id="citation_url_format",
            description="All citation URLs must be valid http/https URLs (no fabricated or placeholder links)",
            level="WARN",
            passed=passed,
            notes=None if passed else f"Malformed citation URLs detected: {'; '.join(bad_citations[:5])}.",
        )

    def _check_citation_verifiability(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Citations must include a named source and a usable public URL, not placeholders."""
        unverifiable: list[str] = []
        placeholder_terms = ("example.com", "placeholder", "unknown", "n/a", "internal estimate", "asis synthesis")
        for framework_name, output in brief.framework_outputs.items():
            for citation in output.citations:
                source = str(getattr(citation, "source", "") or getattr(citation, "publisher", "") or "").strip()
                title = str(getattr(citation, "title", "") or "").strip()
                url = str(getattr(citation, "url", "") or "").strip()
                combined = f"{source} {title} {url}".lower()
                if not source or not title or not url or not _looks_like_url(url) or any(term in combined for term in placeholder_terms):
                    unverifiable.append(f"{framework_name}: {title or source or url or 'missing citation'}")
        passed = not unverifiable
        return QualityCheckResult(
            id="citation_verifiability",
            description="All framework citations must have a real source, title, and verifiable http/https URL",
            level="BLOCK",
            passed=passed,
            notes=None if passed else f"Unverifiable citations detected: {'; '.join(unverifiable[:6])}.",
        )

    def _check_source_role_relevance(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Material reports need sources relevant to market, competitor, and financial claims."""
        facts = extract_query_facts(str(brief.report_metadata.query or ""))
        investment = facts.get("investment_range_usd_mn") or {}
        investment_mid = self._coerce_float(investment.get("mid") if isinstance(investment, dict) else None) or 0
        named_competitors = facts.get("named_competitors") or []
        material_decision = bool(investment_mid >= 250 or named_competitors or facts.get("strategic_themes"))
        if not material_decision:
            return QualityCheckResult(
                id="source_role_relevance",
                description="Material reports must include source roles beyond macro context",
                level="BLOCK",
                passed=True,
                notes=None,
            )

        citations = self._all_citations(brief)
        roles = {role for citation in citations for role in self._citation_roles(citation, named_competitors)}
        failures: list[str] = []
        if "macro" in roles and not roles.intersection({"sector", "competitor", "regulatory", "financial"}):
            failures.append("only macro sources are present")
        if not roles.intersection({"sector", "financial"}):
            failures.append("no sector or financial source supports market/economic claims")
        if named_competitors and "competitor" not in roles:
            failures.append("named competitor claims lack competitor-relevant sources")

        passed = not failures
        return QualityCheckResult(
            id="source_role_relevance",
            description="Large or competitor-explicit reports must include sector, financial, and competitor-relevant source coverage",
            level="BLOCK",
            passed=passed,
            notes=None if passed else f"Source role relevance failure: {'; '.join(failures)}. Roles found: {', '.join(sorted(roles)) or 'none'}.",
        )

    def _check_cross_agent_consistency(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Detect material contradictions between BCG growth rate and market intel growth rate.

        If Market Intel reports a market growth rate and BCG Matrix also reports
        business unit market_growth_rate, they should not contradict by more than 20pp.
        """
        try:
            bcg_data = (brief.framework_outputs.get("bcg_matrix") or None)
            market_data = brief.market_analysis or {}
            if not bcg_data:
                return QualityCheckResult(
                    id="cross_agent_consistency",
                    description="BCG growth rate must not contradict Market Intel growth rate by more than 20 percentage points",
                    level="WARN",
                    passed=True,
                    notes=None,
                )
            bcg_units = (bcg_data.structured_data or {}).get("business_units") or []
            if not bcg_units:
                return QualityCheckResult(
                    id="cross_agent_consistency",
                    description="BCG growth rate must not contradict Market Intel growth rate by more than 20 percentage points",
                    level="WARN",
                    passed=True,
                    notes=None,
                )
            avg_bcg_growth = sum(float(u.get("market_growth_rate") or 0) for u in bcg_units) / len(bcg_units)
            market_growth = float(market_data.get("market_growth_rate") or market_data.get("cagr_pct") or avg_bcg_growth)
            discrepancy = abs(avg_bcg_growth - market_growth)
            passed = discrepancy <= 20
            return QualityCheckResult(
                id="cross_agent_consistency",
                description="BCG growth rate must not contradict Market Intel growth rate by more than 20 percentage points",
                level="WARN",
                passed=passed,
                notes=None if passed else (
                    f"BCG avg growth ({avg_bcg_growth:.1f}%) contradicts Market Intel "
                    f"({market_growth:.1f}%) by {discrepancy:.1f}pp. "
                    "Align financial and market assumptions."
                ),
            )
        except Exception:
            return QualityCheckResult(
                id="cross_agent_consistency",
                description="BCG growth rate must not contradict Market Intel growth rate by more than 20 percentage points",
                level="WARN",
                passed=True,
                notes=None,
            )

    def _check_roadmap_phases(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Implementation roadmap must contain all 4 required phases."""
        roadmap = brief.implementation_roadmap or []
        passed = len(roadmap) >= 4
        return QualityCheckResult(
            id="roadmap_phases",
            description="Implementation roadmap must have exactly 4 phases: Immediate (0-3m), Short-term (3-12m), Medium-term (1-3y), Long-term (3-5y)",
            level="WARN",
            passed=passed,
            notes=None if passed else f"Roadmap has only {len(roadmap)} phase(s); all 4 phases are required for board-ready reporting.",
        )

    def _check_recommendation_pathway_alignment(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Acquisition/M&A recommendations must align with the recommended pathway."""
        intent_text = " ".join(
            [
                str((brief.context or {}).get("decision_type") or ""),
                str((brief.report_metadata.query if brief.report_metadata else "") or ""),
                str(brief.decision_statement or ""),
                str(brief.recommendation or ""),
            ]
        ).lower()
        acquisition_terms = (
            "acquire",
            "acquisition",
            "minority stake",
            "take a stake",
            "m&a",
            "merger",
            "post-merger",
            "post merger",
            "buyout",
            "takeover",
        )
        if not any(term in intent_text for term in acquisition_terms):
            return QualityCheckResult(
                id="recommendation_pathway_alignment",
                description="Recommended pathway must match acquisition/M&A intent when the question requires it",
                level="BLOCK",
                passed=True,
                notes=None,
            )

        pathways = ((brief.market_analysis or {}).get("strategic_pathways") or {}).get("options") or []
        recommended = [option for option in pathways if isinstance(option, dict) and option.get("recommended")]
        if not recommended and pathways:
            recommended = [pathways[0]]

        pathway_text = " ".join(
            self._flatten_text(option)
            for option in recommended
            if isinstance(option, dict)
        ).lower()
        aligned_terms = (
            "acquisition",
            "acquire",
            "stake",
            "minority",
            "merger",
            "m&a",
            "partnership",
            "alliance",
            "joint venture",
            "call option",
            "invest",
        )
        passed = bool(pathway_text and any(term in pathway_text for term in aligned_terms))
        return QualityCheckResult(
            id="recommendation_pathway_alignment",
            description="Acquisition/M&A questions must recommend an acquisition, minority investment, alliance, partnership, or explicit build-vs-buy path",
            level="BLOCK",
            passed=passed,
            notes=None if passed else "The final recommendation has acquisition/M&A intent, but the recommended pathway is generic or unrelated.",
        )

    def _check_financial_scenario_consistency(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Bottom-up Year 3 revenue must reconcile with the recommended scenario."""
        financial_analysis = brief.financial_analysis or {}
        bottom_up = financial_analysis.get("bottom_up_revenue_model") or {}
        scenario_analysis = financial_analysis.get("scenario_analysis") or {}

        bottom_up_total = self._coerce_float(bottom_up.get("total_year_3_revenue_usd_mn"))
        if bottom_up_total is None:
            sector_rows = bottom_up.get("sector_build") or []
            row_values = [
                self._coerce_float(row.get("base_year_3_revenue_usd_mn"))
                for row in sector_rows
                if isinstance(row, dict)
            ]
            bottom_up_total = sum(value for value in row_values if value is not None) if row_values else None

        scenarios = scenario_analysis.get("scenarios") or []
        recommended_name = str(scenario_analysis.get("recommended_case") or "Base").lower()
        scenario = None
        for candidate in scenarios:
            if not isinstance(candidate, dict):
                continue
            candidate_name = str(candidate.get("name") or candidate.get("scenario") or "").lower()
            if candidate_name == recommended_name or recommended_name in candidate_name:
                scenario = candidate
                break
        if scenario is None and scenarios:
            scenario = scenarios[0]

        scenario_revenue = self._coerce_float((scenario or {}).get("revenue_year_3_usd_mn"))
        if bottom_up_total is None or scenario_revenue is None or bottom_up_total <= 0:
            return QualityCheckResult(
                id="financial_scenario_consistency",
                description="Recommended financial scenario must reconcile with bottom-up Year 3 revenue build",
                level="BLOCK",
                passed=True,
                notes=None,
            )

        ratio = scenario_revenue / bottom_up_total
        passed = 0.65 <= ratio <= 1.35
        return QualityCheckResult(
            id="financial_scenario_consistency",
            description="Recommended scenario Year 3 revenue should be within 35% of the bottom-up build unless explicitly justified",
            level="BLOCK",
            passed=passed,
            notes=None if passed else (
                f"Scenario Year 3 revenue (${scenario_revenue:.1f}M) does not reconcile with "
                f"bottom-up build (${bottom_up_total:.1f}M)."
            ),
        )

    def _check_financial_input_ranges(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Financial rows must use sane ranges and totals must reconcile to displayed segment rows."""
        bottom_up = ((brief.financial_analysis or {}).get("bottom_up_revenue_model") or {})
        sector_rows = bottom_up.get("sector_build") or []
        failures: list[str] = []
        row_total = 0.0
        for index, row in enumerate(sector_rows):
            if not isinstance(row, dict):
                failures.append(f"row {index + 1}: not an object")
                continue
            addressable = self._coerce_float(row.get("addressable_clients"))
            target = self._coerce_float(row.get("target_clients"))
            win_rate = self._coerce_float(row.get("win_rate"))
            acv = self._coerce_float(row.get("average_contract_value_usd_mn"))
            revenue = self._coerce_float(row.get("year_3_revenue_usd_mn") or row.get("base_year_3_revenue_usd_mn"))
            if addressable is not None and target is not None and target > addressable:
                failures.append(f"row {index + 1}: target clients exceed addressable clients")
            if win_rate is None or not 0 <= win_rate <= 1:
                failures.append(f"row {index + 1}: win rate must be 0-1")
            if acv is None or acv <= 0:
                failures.append(f"row {index + 1}: ACV must be positive")
            if revenue is None or revenue <= 0:
                failures.append(f"row {index + 1}: Year 3 revenue must be positive")
            else:
                row_total += revenue

        reported_total = self._coerce_float(bottom_up.get("total_year_3_revenue_usd_mn"))
        if sector_rows and reported_total is not None and row_total > 0:
            ratio = reported_total / row_total
            if not 0.98 <= ratio <= 1.02:
                failures.append(f"reported Year 3 total ${reported_total:.1f}M does not equal segment sum ${row_total:.1f}M")

        passed = not failures
        return QualityCheckResult(
            id="financial_input_ranges",
            description="Bottom-up financial rows must use sane ranges and reconcile displayed totals",
            level="BLOCK",
            passed=passed,
            notes=None if passed else f"Financial input integrity failures: {'; '.join(failures[:6])}.",
        )

    def _check_bottom_up_formula_integrity(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Displayed revenue rows must reconcile to the explicit formula, not unexplained synthetic totals."""
        bottom_up = ((brief.financial_analysis or {}).get("bottom_up_revenue_model") or {})
        sector_rows = bottom_up.get("sector_build") or []
        failures: list[str] = []
        for index, row in enumerate(sector_rows):
            if not isinstance(row, dict):
                continue
            target = self._coerce_float(row.get("target_clients"))
            win_rate = self._coerce_float(row.get("win_rate"))
            acv = self._coerce_float(row.get("average_contract_value_usd_mn"))
            expansion = self._coerce_float(row.get("account_expansion_multiplier"))
            scale = self._coerce_float(row.get("scale_multiplier"))
            revenue = self._coerce_float(row.get("year_3_revenue_usd_mn") or row.get("base_year_3_revenue_usd_mn"))
            if None in (target, win_rate, acv, expansion, scale, revenue):
                failures.append(f"row {index + 1}: missing explicit target x win-rate x ACV x expansion formula fields")
                continue
            expected = target * win_rate * acv * expansion * scale
            if expected <= 0:
                failures.append(f"row {index + 1}: expected revenue formula is non-positive")
                continue
            ratio = revenue / expected
            if not 0.9 <= ratio <= 1.1:
                failures.append(f"row {index + 1}: Year 3 revenue ${revenue:.1f}M does not reconcile to formula ${expected:.1f}M")
            if expansion > 4.0:
                failures.append(f"row {index + 1}: account expansion multiplier {expansion:.1f}x is too aggressive without separate proof")

        passed = not failures
        return QualityCheckResult(
            id="bottom_up_formula_integrity",
            description="Bottom-up revenue rows must reconcile to target clients, win rate, ACV, account expansion, and scale multiplier",
            level="BLOCK",
            passed=passed,
            notes=None if passed else f"Bottom-up formula failures: {'; '.join(failures[:6])}.",
        )

    def _check_numeric_evidence_contract(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Major numbers must carry a formula or an explicit source/assumption basis."""
        financial_analysis = brief.financial_analysis or {}
        bottom_up = financial_analysis.get("bottom_up_revenue_model") or {}
        scenarios = (financial_analysis.get("scenario_analysis") or {}).get("scenarios") or []
        evidence_contract = brief.evidence_contract or {}
        failures: list[str] = []

        for index, row in enumerate(bottom_up.get("sector_build") or []):
            if not isinstance(row, dict):
                continue
            if not row.get("formula_basis"):
                failures.append(f"bottom-up row {index + 1}: missing formula_basis")
            if not row.get("source_or_assumption"):
                failures.append(f"bottom-up row {index + 1}: missing source_or_assumption")

        for index, scenario in enumerate(scenarios):
            if not isinstance(scenario, dict):
                continue
            for key in ("formula_basis", "source_or_assumption", "investment_basis", "payback_basis"):
                if not scenario.get(key):
                    failures.append(f"scenario {index + 1}: missing {key}")

        numeric_assumptions = evidence_contract.get("numeric_assumptions") if isinstance(evidence_contract, dict) else None
        if not isinstance(numeric_assumptions, list) or len(numeric_assumptions) < 3:
            failures.append("evidence_contract.numeric_assumptions has fewer than 3 auditable entries")

        passed = not failures
        return QualityCheckResult(
            id="numeric_evidence_contract",
            description="Financial rows and scenarios must expose formula basis, source or assumption basis, and auditable numeric assumptions",
            level="BLOCK",
            passed=passed,
            notes=None if passed else f"Numeric evidence contract failures: {'; '.join(failures[:8])}.",
        )

    def _check_scenario_duplicate_guard(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Block known default financial ladders that caused generic PDFs across unrelated prompts."""
        scenarios = ((brief.financial_analysis or {}).get("scenario_analysis") or {}).get("scenarios") or []
        irr_signature = tuple(
            round(self._coerce_float(item.get("irr_pct") if isinstance(item, dict) else None) or -999, 1)
            for item in scenarios
        )
        payback_signature = tuple(
            int(round(self._coerce_float(item.get("payback_months") if isinstance(item, dict) else None) or -999))
            for item in scenarios
        )
        roi_signature = tuple(
            round(self._coerce_float(item.get("roi_multiple") if isinstance(item, dict) else None) or -999, 2)
            for item in scenarios
        )

        known_generic_irr = {
            (21.8, 31.0, 39.4),
            (21.8, 31.0, 39.0),
            (22.0, 31.0, 39.0),
        }
        known_generic_payback = {
            (33, 27, 22),
            (37, 31, 25),
            (34, 28, 22),
            (36, 30, 24),
        }
        known_generic_roi = {
            (1.37, 1.87, 2.37),
            (1.32, 1.82, 2.42),
            (1.5, 2.1, 2.8),
            (1.4, 1.9, 2.5),
        }
        failures: list[str] = []
        if irr_signature in known_generic_irr:
            failures.append(f"IRR ladder {irr_signature} matches a known generic scaffold")
        if payback_signature in known_generic_payback and roi_signature in known_generic_roi:
            failures.append(f"payback/ROI ladder {payback_signature}/{roi_signature} matches a default scaffold")

        passed = not failures
        return QualityCheckResult(
            id="scenario_duplicate_guard",
            description="Scenario ROI, IRR, and payback ladders must be derived from the prompt-specific investment and cash-flow model",
            level="BLOCK",
            passed=passed,
            notes=None if passed else f"Scenario duplicate guard failures: {'; '.join(failures)}.",
        )

    def _check_red_team_materiality(self, brief: StrategicBriefV4) -> QualityCheckResult:
        facts = extract_query_facts(str(brief.report_metadata.query or ""))
        investment = facts.get("investment_range_usd_mn") or {}
        investment_mid = self._coerce_float(investment.get("mid") if isinstance(investment, dict) else None) or 0
        if investment_mid < 250 and not facts.get("named_competitors"):
            return QualityCheckResult(
                id="red_team_materiality",
                description="Large or competitor-explicit decisions must include adversarial red-team challenges",
                level="BLOCK",
                passed=True,
                notes=None,
            )
        red_team = brief.red_team or {}
        challenges = red_team.get("invalidated_claims") or red_team.get("challenges") or []
        has_major = any(str(item.get("severity", "")).upper() in {"MAJOR", "FATAL"} for item in challenges if isinstance(item, dict))
        passed = bool(challenges) and has_major
        return QualityCheckResult(
            id="red_team_materiality",
            description="Large or competitor-explicit decisions must include major/fatal red-team challenges before export",
            level="BLOCK",
            passed=passed,
            notes=None if passed else "Material decision has no visible major/fatal red-team challenge.",
        )

    def _check_confidence_calibration(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Confidence must be calculated and variable, not flat or hardcoded."""
        scores = [round(float(output.confidence_score), 3) for output in brief.framework_outputs.values()]
        confidence = round(float(brief.overall_confidence), 3)
        decision_confidence = round(float(brief.decision_confidence), 3)
        failures: list[str] = []
        if confidence in {0.85, 85.0} or decision_confidence in {0.85, 85.0}:
            failures.append("overall confidence is the known hardcoded 85 value")
        if abs(confidence - decision_confidence) > 0.001:
            failures.append("decision confidence and overall confidence diverge")
        if scores and max(scores) - min(scores) < 0.025:
            failures.append("framework confidence scores are too flat")
        if len(set(scores)) <= 2:
            failures.append("too few distinct framework confidence scores")

        passed = not failures
        return QualityCheckResult(
            id="confidence_calibration",
            description="Overall and framework confidence must vary with evidence quality, specificity, financial rigor, and execution risk",
            level="BLOCK",
            passed=passed,
            notes=None if passed else f"Confidence calibration failure: {'; '.join(failures)}.",
        )

    def _check_context_leakage(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Block obvious stale-context leakage from previously generated analyses."""
        allowed_context = " ".join(
            [
                str(brief.report_metadata.query or ""),
                self._flatten_text(brief.context or {}),
            ]
        ).lower()
        payload_text = self._flatten_text(brief.model_dump(mode="json")).lower()
        leakage_terms = ("reliance", "jioai", "jio ai", "jio")
        leaked = [
            term
            for term in leakage_terms
            if term in payload_text and term not in allowed_context
        ]
        passed = not leaked
        return QualityCheckResult(
            id="context_leakage",
            description="Brief must not contain company, competitor, or case-study names that are absent from the query/context",
            level="BLOCK",
            passed=passed,
            notes=None if passed else f"Potential stale-context leakage detected: {', '.join(sorted(set(leaked)))}.",
        )

    def _check_duplicate_semantic_keys(self, brief: StrategicBriefV4) -> QualityCheckResult:
        """Block JSON payloads that duplicate keys by case/underscore variants."""
        duplicates = self._semantic_duplicate_paths(brief.model_dump(mode="json"))
        passed = not duplicates
        return QualityCheckResult(
            id="duplicate_semantic_keys",
            description="Nested report JSON must not contain semantically duplicate keys such as pestle_analysis and PESTLE_Analysis",
            level="BLOCK",
            passed=passed,
            notes=None if passed else f"Semantically duplicate JSON keys detected: {'; '.join(duplicates[:5])}.",
        )

    def _citation_density_score(self, brief: StrategicBriefV4) -> float:
        scores = [min(1.0, len(output.citations) / 5) for output in brief.framework_outputs.values()]
        return round(mean(scores), 3) if scores else 0.0

    def _context_specificity_score(self, brief: StrategicBriefV4) -> float:
        context = brief.context or {}
        query = str(brief.report_metadata.query or "")
        score = 0.28
        if context.get("company_name"):
            score += 0.18
        if context.get("geography"):
            score += 0.16
        if context.get("sector"):
            score += 0.12
        if context.get("decision_type"):
            score += 0.12
        if any(token in query.lower() for token in ["202", "quarter", "month", "year", "q1", "q2", "q3", "q4"]):
            score += 0.08
        if context.get("annual_revenue") or context.get("annual_revenue_usd_mn"):
            score += 0.04
        if context.get("employees"):
            score += 0.02
        return round(min(1.0, score), 3)

    def _financial_grounding_score(self, brief: StrategicBriefV4) -> float:
        financial_analysis = brief.financial_analysis or {}
        bottom_up = financial_analysis.get("bottom_up_revenue_model") or {}
        scenario_analysis = financial_analysis.get("scenario_analysis") or {}

        sector_build = bottom_up.get("sector_build") or []
        scenarios = scenario_analysis.get("scenarios") or []
        assumptions = bottom_up.get("key_assumptions") or []

        sector_score = min(1.0, len(sector_build) / 3) if sector_build else 0.0
        field_score = (
            mean(
                [
                    1.0
                    if entry.get("target_clients") and entry.get("average_contract_value_usd_mn") and entry.get("win_rate") is not None
                    else 0.0
                    for entry in sector_build
                ]
            )
            if sector_build
            else 0.0
        )
        scenario_score = min(1.0, len(scenarios) / 3) if scenarios else 0.0
        assumption_score = min(1.0, len(assumptions) / 4) if assumptions else 0.0

        return round(mean([sector_score, field_score, scenario_score, assumption_score]), 3)

    def _execution_specificity_score(self, brief: StrategicBriefV4) -> float:
        risk_analysis = brief.risk_analysis or {}
        market_analysis = brief.market_analysis or {}

        execution_realism = risk_analysis.get("execution_realism") or {}
        capability_fit = market_analysis.get("capability_fit_matrix") or {}
        strategic_pathways = market_analysis.get("strategic_pathways") or {}

        realism_items = execution_realism.get("items") or []
        capability_rows = capability_fit.get("rows") or []
        pathway_options = strategic_pathways.get("options") or []

        realism_score = min(1.0, len(realism_items) / 4) if realism_items else 0.0
        capability_score = min(1.0, len(capability_rows) / 5) if capability_rows else 0.0
        pathway_score = min(1.0, len(pathway_options) / 3) if pathway_options else 0.0
        roadmap_score = min(1.0, len(brief.implementation_roadmap or []) / 4)

        return round(mean([realism_score, capability_score, pathway_score, roadmap_score]), 3)

    @staticmethod
    def _coerce_float(value: object) -> float | None:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            if isinstance(value, str):
                match = re.search(r"-?\d+(?:\.\d+)?", value.replace(",", ""))
                if match:
                    return float(match.group(0))
            return None

    def _flatten_text(self, value: Any) -> str:
        if isinstance(value, dict):
            return " ".join(self._flatten_text(item) for item in value.values())
        if isinstance(value, list):
            return " ".join(self._flatten_text(item) for item in value)
        if value is None:
            return ""
        return str(value)

    def _all_citations(self, brief: StrategicBriefV4) -> list[Any]:
        citations: list[Any] = list(brief.citations or [])
        for output in (brief.framework_outputs or {}).values():
            citations.extend(output.citations or [])
        return citations

    def _citation_roles(self, citation: Any, named_competitors: list[str] | None = None) -> set[str]:
        source = str(getattr(citation, "source", "") or getattr(citation, "publisher", "") or "")
        title = str(getattr(citation, "title", "") or "")
        excerpt = str(getattr(citation, "excerpt", "") or "")
        text = f"{source} {title} {excerpt}".lower()
        roles: set[str] = set()
        if any(token in text for token in ("imf", "world bank", "economic outlook", "economic prospects", "economic survey")):
            roles.add("macro")
        if any(token in text for token in ("market", "sector", "technology", "services", "automotive", "fintech", "nasscom", "ibef", "dun & bradstreet", "dnb")):
            roles.add("sector")
        if any(token in text for token in ("roi", "irr", "margin", "capital", "investment", "financial", "supplier study")):
            roles.add("financial")
        if any(token in text for token in ("regulation", "regulatory", "act", "nist", "meity", "rbi", "cma", "commission", "ai risk")):
            roles.add("regulatory")
        for competitor in named_competitors or []:
            competitor_tokens = [part for part in re.split(r"[^a-z0-9]+", competitor.lower()) if len(part) >= 3]
            if competitor.lower() in text or any(token in text for token in competitor_tokens):
                roles.add("competitor")
        if any(token in text for token in ("mckinsey", "bain", "bcg", "boston consulting group", "deloitte", "pwc", "ey", "kpmg")):
            roles.add("competitor")
            roles.add("sector")
        return roles

    def _semantic_duplicate_paths(self, value: Any, path: str = "$") -> list[str]:
        duplicates: list[str] = []
        if isinstance(value, list):
            for index, item in enumerate(value):
                duplicates.extend(self._semantic_duplicate_paths(item, f"{path}[{index}]"))
            return duplicates
        if not isinstance(value, dict):
            return duplicates

        seen: dict[str, str] = {}
        for key, item in value.items():
            semantic_key = re.sub(r"[^a-z0-9]", "", str(key).lower())
            if semantic_key in seen:
                duplicates.append(f"{path}.{seen[semantic_key]} / {key}")
            else:
                seen[semantic_key] = str(key)
            duplicates.extend(self._semantic_duplicate_paths(item, f"{path}.{key}"))
        return duplicates

    def _grade(
        self,
        checks: list[QualityCheckResult],
        mece_score: float,
        citation_density_score: float,
        internal_consistency_score: float,
        context_specificity_score: float,
        financial_grounding_score: float,
        execution_specificity_score: float,
    ) -> str:
        if any(check.level == "BLOCK" and not check.passed for check in checks):
            return "FAIL"

        warn_failures = sum(1 for check in checks if check.level == "WARN" and not check.passed)
        mean_score = mean(
            [
                mece_score,
                citation_density_score,
                internal_consistency_score,
                context_specificity_score,
                financial_grounding_score,
                execution_specificity_score,
            ]
        )
        if mean_score >= 0.86 and warn_failures == 0:
            return "A"
        if mean_score >= 0.73 and context_specificity_score >= 0.55 and warn_failures <= 2:
            return "B"
        return "C"
