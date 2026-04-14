from __future__ import annotations

from statistics import mean

from asis.backend.schemas.v4 import QualityCheckResult, QualityReport, StrategicBriefV4


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
            self._check_citation_density(brief),
            self._check_framework_completeness(brief),
            self._check_collaboration_trace(brief),
            self._check_context_specificity(brief),
            self._check_bottom_up_economics(brief),
            self._check_execution_specificity(brief),
            self._check_mece_score(brief),
            self._check_internal_consistency(brief),
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
