"""Unit tests for asis.backend.quality.gate.QualityGate.

Tests individual check methods and the overall grade calculation using
lightweight mock objects so no database or LLM call is needed.
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from asis.backend.quality.gate import QualityGate, _looks_like_url

# ── URL helper ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "url,expected",
    [
        ("https://www.imf.org/en/Publications/WEO", True),
        ("http://example.com/path?query=1", True),
        ("not-a-url", False),
        ("ftp://example.com", False),
        ("", False),
        ("https://", False),
        ("https://example", True),  # single-label domain still matches
    ],
)
def test_looks_like_url(url: str, expected: bool) -> None:
    assert _looks_like_url(url) is expected


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_citation(url: str | None = None):
    c = MagicMock()
    c.url = url
    return c


def _make_framework_output(num_citations: int = 5, url: str | None = "https://example.com"):
    fo = MagicMock()
    fo.citations = [_make_citation(url) for _ in range(num_citations)]
    fo.structured_data = {}
    return fo


FRAMEWORK_KEYS = [
    "pestle", "swot", "porters_five_forces", "ansoff",
    "bcg_matrix", "mckinsey_7s", "blue_ocean", "balanced_scorecard",
]


def _make_brief(
    *,
    decision_statement: str = "PROCEED — enter the Indian fintech market via a phased partnership model.",
    framework_outputs: dict | None = None,
    agent_collaboration_trace: list | None = None,
    mece_score: float = 0.75,
    internal_consistency_score: float = 0.80,
    context: dict | None = None,
    query: str = "Should Acme Financial enter the Indian fintech market in 2026?",
    market_analysis: dict | None = None,
    financial_analysis: dict | None = None,
    risk_analysis: dict | None = None,
    implementation_roadmap: list | None = None,
) -> MagicMock:
    brief = MagicMock()
    brief.decision_statement = decision_statement
    brief.mece_score = mece_score
    brief.internal_consistency_score = internal_consistency_score
    brief.context = context or {
        "company_name": "Acme Financial",
        "geography": "India",
        "sector": "Fintech",
        "decision_type": "market_entry",
    }
    brief.report_metadata = SimpleNamespace(query=query)
    brief.market_analysis = market_analysis or {}
    brief.financial_analysis = financial_analysis or {}
    brief.risk_analysis = risk_analysis or {}
    brief.implementation_roadmap = implementation_roadmap if implementation_roadmap is not None else [
        MagicMock(), MagicMock(), MagicMock(), MagicMock()
    ]
    if framework_outputs is None:
        brief.framework_outputs = {k: _make_framework_output() for k in FRAMEWORK_KEYS}
    else:
        brief.framework_outputs = framework_outputs
    if agent_collaboration_trace is None:
        brief.agent_collaboration_trace = [MagicMock() for _ in range(6)]
    else:
        brief.agent_collaboration_trace = agent_collaboration_trace
    return brief


# ── Individual checks ─────────────────────────────────────────────────────────

class TestDecisionPrefix:
    gate = QualityGate()

    @pytest.mark.parametrize("prefix", ["PROCEED", "CONDITIONAL PROCEED", "DO NOT PROCEED"])
    def test_valid_prefixes_pass(self, prefix: str) -> None:
        brief = _make_brief(decision_statement=f"{prefix} — some strategic reasoning here.")
        result = self.gate._check_decision_prefix(brief)
        assert result.passed

    def test_invalid_prefix_blocks(self) -> None:
        brief = _make_brief(decision_statement="We recommend entering the market.")
        result = self.gate._check_decision_prefix(brief)
        assert not result.passed
        assert result.level == "BLOCK"


class TestDecisionLength:
    gate = QualityGate()

    def test_within_35_words_passes(self) -> None:
        words = " ".join(["word"] * 35)
        brief = _make_brief(decision_statement=f"PROCEED — {words[:100]}.")
        result = self.gate._check_decision_length(brief)
        assert result.passed

    def test_over_35_words_warns(self) -> None:
        long_statement = "PROCEED — " + " ".join(["word"] * 40)
        brief = _make_brief(decision_statement=long_statement)
        result = self.gate._check_decision_length(brief)
        assert not result.passed
        assert result.level == "WARN"
        assert "40" in (result.notes or "")


class TestCitationDensity:
    gate = QualityGate()

    def test_all_frameworks_have_5_plus_citations(self) -> None:
        brief = _make_brief(
            framework_outputs={k: _make_framework_output(num_citations=5) for k in FRAMEWORK_KEYS}
        )
        result = self.gate._check_citation_density(brief)
        assert result.passed
        assert result.level == "BLOCK"

    def test_framework_with_fewer_than_5_fails(self) -> None:
        outputs = {k: _make_framework_output(num_citations=5) for k in FRAMEWORK_KEYS}
        outputs["pestle"] = _make_framework_output(num_citations=4)
        brief = _make_brief(framework_outputs=outputs)
        result = self.gate._check_citation_density(brief)
        assert not result.passed
        assert result.level == "BLOCK"


class TestFrameworkCompleteness:
    gate = QualityGate()

    def test_all_frameworks_present_passes(self) -> None:
        brief = _make_brief()
        result = self.gate._check_framework_completeness(brief)
        assert result.passed

    def test_missing_framework_blocks(self) -> None:
        outputs = {k: _make_framework_output() for k in FRAMEWORK_KEYS if k != "bcg_matrix"}
        brief = _make_brief(framework_outputs=outputs)
        result = self.gate._check_framework_completeness(brief)
        assert not result.passed
        assert result.level == "BLOCK"
        assert "bcg_matrix" in (result.notes or "")


class TestCollaborationTrace:
    gate = QualityGate()

    def test_five_or_more_entries_pass(self) -> None:
        brief = _make_brief(agent_collaboration_trace=[MagicMock() for _ in range(5)])
        result = self.gate._check_collaboration_trace(brief)
        assert result.passed

    def test_fewer_than_five_blocks(self) -> None:
        brief = _make_brief(agent_collaboration_trace=[MagicMock() for _ in range(4)])
        result = self.gate._check_collaboration_trace(brief)
        assert not result.passed
        assert result.level == "BLOCK"


class TestCitationUrlFormat:
    gate = QualityGate()

    def test_valid_urls_pass(self) -> None:
        brief = _make_brief()
        result = self.gate._check_citation_url_format(brief)
        assert result.passed
        assert result.level == "WARN"

    def test_malformed_url_warns(self) -> None:
        outputs = {k: _make_framework_output(url="https://example.com") for k in FRAMEWORK_KEYS}
        outputs["swot"] = _make_framework_output(url="not-a-valid-url")
        brief = _make_brief(framework_outputs=outputs)
        result = self.gate._check_citation_url_format(brief)
        assert not result.passed
        assert result.level == "WARN"


class TestRoadmapPhases:
    gate = QualityGate()

    def test_four_phases_pass(self) -> None:
        brief = _make_brief(implementation_roadmap=[MagicMock() for _ in range(4)])
        result = self.gate._check_roadmap_phases(brief)
        assert result.passed

    def test_fewer_than_four_warns(self) -> None:
        brief = _make_brief(implementation_roadmap=[MagicMock() for _ in range(3)])
        result = self.gate._check_roadmap_phases(brief)
        assert not result.passed
        assert result.level == "WARN"
        assert "3" in (result.notes or "")


# ── Grade calculation ─────────────────────────────────────────────────────────

class TestGradeCalculation:
    gate = QualityGate()

    def _block_check(self, passed: bool):
        from asis.backend.schemas.v4 import QualityCheckResult
        return QualityCheckResult(id="x", description="x", level="BLOCK", passed=passed)

    def _warn_check(self, passed: bool):
        from asis.backend.schemas.v4 import QualityCheckResult
        return QualityCheckResult(id="x", description="x", level="WARN", passed=passed)

    def test_block_failure_returns_fail(self) -> None:
        checks = [self._block_check(False), self._warn_check(True)]
        grade = self.gate._grade(checks, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9)
        assert grade == "FAIL"

    def test_all_pass_high_scores_returns_A(self) -> None:
        checks = [self._block_check(True), self._warn_check(True)]
        grade = self.gate._grade(checks, 0.88, 0.90, 0.88, 0.88, 0.88, 0.88)
        assert grade == "A"

    def test_moderate_scores_returns_B(self) -> None:
        checks = [self._block_check(True), self._warn_check(False)]
        grade = self.gate._grade(checks, 0.75, 0.78, 0.75, 0.60, 0.75, 0.75)
        assert grade == "B"

    def test_low_scores_returns_C(self) -> None:
        checks = [self._block_check(True)] + [self._warn_check(False) for _ in range(4)]
        grade = self.gate._grade(checks, 0.5, 0.5, 0.5, 0.3, 0.5, 0.5)
        assert grade == "C"


# ── has_block_failures static helper ─────────────────────────────────────────

def test_has_block_failures_false_when_all_pass() -> None:
    from asis.backend.schemas.v4 import QualityCheckResult, QualityReport

    report = QualityReport(
        overall_grade="A",
        checks=[
            QualityCheckResult(id="a", description="a", level="BLOCK", passed=True),
            QualityCheckResult(id="b", description="b", level="WARN", passed=False),
        ],
        quality_flags=[],
    )
    assert not QualityGate.has_block_failures(report)


def test_has_block_failures_true_when_block_fails() -> None:
    from asis.backend.schemas.v4 import QualityCheckResult, QualityReport

    report = QualityReport(
        overall_grade="FAIL",
        checks=[
            QualityCheckResult(id="a", description="a", level="BLOCK", passed=False),
        ],
        quality_flags=["Block failed."],
    )
    assert QualityGate.has_block_failures(report)
