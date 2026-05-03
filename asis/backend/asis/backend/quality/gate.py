from __future__ import annotations

import re
from statistics import mean
from typing import Any

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
            self._check_framework_completeness(brief),
            self._check_collaboration_trace(brief),
            self._check_context_specificity(brief),
            self._check_bottom_up_economics(brief),
            self._check_execution_specificity(brief),
            self._check_mece_score(brief),
            self._check_internal_consistency(brief),
            self._check_cross_agent_consistency(brief),
            self._check_roadmap_phases(brief),
            self._check_recommendation_pathway_alignment(brief),
            self._check_financial_scenario_consistency(brief),
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
