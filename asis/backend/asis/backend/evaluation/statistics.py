"""
DSR Statistical Analysis — Wilcoxon Signed-Rank Test.

Implements the non-parametric comparison required by the evaluation design:
  H0: median(multi-agent scores) ≤ median(single-agent baseline scores)
  H1: median(multi-agent scores)  > median(single-agent baseline scores)

One-tailed Wilcoxon signed-rank test (alternative='greater') is used because:
  - n=10 pairs violates the normality assumption for a paired t-test
  - Wilcoxon is standard for small-sample DSR quantitative comparisons
    (see Pries & Jain, 2010; Runeson & Höst, 2009)
  - One-tailed test matches the directional hypothesis of the artefact

Effect size: r = Z / sqrt(N) — equivalent of Cohen's d for Wilcoxon,
interpreted as small (0.1), medium (0.3), large (0.5) per Cohen (1988).

Output is a WilcoxonResult dataclass that the report module serialises
to JSON for the audit trail.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from statistics import median, stdev
from typing import Any

try:
    from scipy.stats import wilcoxon as _scipy_wilcoxon  # type: ignore[import]
    _SCIPY_AVAILABLE = True
except ImportError:
    _SCIPY_AVAILABLE = False


@dataclass
class DimensionTest:
    dimension: str
    ma_scores: list[float]
    bl_scores: list[float]
    statistic: float
    p_value: float
    effect_size_r: float
    significant: bool         # p < 0.05 (one-tailed)
    direction: str            # "multi_agent_better" | "baseline_better" | "no_difference"
    ma_median: float
    bl_median: float
    delta_median: float


@dataclass
class WilcoxonResult:
    n_scenarios: int
    composite: DimensionTest
    dimensions: list[DimensionTest]
    overall_significant: bool
    interpretation: str
    method_note: str = (
        "Wilcoxon signed-rank test (one-tailed, alternative='greater'). "
        "Effect size r = Z / sqrt(N). Significance threshold α = 0.05."
    )
    fallback_used: bool = False   # True if scipy unavailable and manual calc used

    def to_dict(self) -> dict[str, Any]:
        return {
            "n_scenarios": self.n_scenarios,
            "method_note": self.method_note,
            "fallback_used": self.fallback_used,
            "overall_significant": self.overall_significant,
            "interpretation": self.interpretation,
            "composite": _dim_to_dict(self.composite),
            "dimensions": [_dim_to_dict(d) for d in self.dimensions],
        }


def _dim_to_dict(d: DimensionTest) -> dict[str, Any]:
    return {
        "dimension": d.dimension,
        "ma_scores": d.ma_scores,
        "bl_scores": d.bl_scores,
        "ma_median": d.ma_median,
        "bl_median": d.bl_median,
        "delta_median": d.delta_median,
        "wilcoxon_statistic": d.statistic,
        "p_value": d.p_value,
        "effect_size_r": d.effect_size_r,
        "significant_at_0_05": d.significant,
        "direction": d.direction,
    }


# ── Manual Wilcoxon implementation (fallback if scipy not installed) ───────────

def _manual_wilcoxon_greater(x: list[float], y: list[float]) -> tuple[float, float]:
    """
    Approximate one-tailed Wilcoxon signed-rank test (alternative='greater').
    Returns (W+, p_value_approx).
    Uses the normal approximation: valid for n ≥ 8.
    """
    diffs = [xi - yi for xi, yi in zip(x, y)]
    non_zero = [(i, d) for i, d in enumerate(diffs) if d != 0]
    n = len(non_zero)
    if n == 0:
        return 0.0, 1.0

    # Sort by absolute difference
    sorted_diffs = sorted(non_zero, key=lambda t: abs(t[1]))

    # Assign ranks (handle ties by averaging)
    ranks: list[float] = []
    i = 0
    while i < n:
        j = i
        while j < n and abs(sorted_diffs[j][1]) == abs(sorted_diffs[i][1]):
            j += 1
        avg_rank = (i + 1 + j) / 2.0
        for _ in range(i, j):
            ranks.append(avg_rank)
        i = j

    w_plus = sum(r for r, (_, d) in zip(ranks, sorted_diffs) if d > 0)

    # Normal approximation
    mean_w = n * (n + 1) / 4.0
    var_w = n * (n + 1) * (2 * n + 1) / 24.0
    if var_w == 0:
        return w_plus, 1.0
    z = (w_plus - mean_w) / math.sqrt(var_w)
    # One-tailed p (alternative = greater): P(Z > z)
    p_approx = 1 - _phi(z)
    return w_plus, round(p_approx, 6)


def _phi(z: float) -> float:
    """Standard normal CDF approximation (Abramowitz & Stegun 26.2.17)."""
    a1, a2, a3, a4, a5 = 0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429
    k = 1.0 / (1.0 + 0.2316419 * abs(z))
    poly = k * (a1 + k * (a2 + k * (a3 + k * (a4 + k * a5))))
    phi = 1.0 - (1.0 / math.sqrt(2 * math.pi)) * math.exp(-0.5 * z * z) * poly
    return phi if z >= 0 else 1.0 - phi


# ── Core test runner ──────────────────────────────────────────────────────────

def _run_test(
    label: str,
    ma_scores: list[float],
    bl_scores: list[float],
    n: int,
) -> DimensionTest:
    if _SCIPY_AVAILABLE:
        try:
            stat, p = _scipy_wilcoxon(ma_scores, bl_scores, alternative="greater")
        except Exception:
            stat, p = _manual_wilcoxon_greater(ma_scores, bl_scores)
    else:
        stat, p = _manual_wilcoxon_greater(ma_scores, bl_scores)

    # Effect size r = Z / sqrt(N)
    # Derive Z from W+ using normal approximation
    n_nonzero = sum(1 for a, b in zip(ma_scores, bl_scores) if a != b)
    mean_w = n_nonzero * (n_nonzero + 1) / 4.0
    var_w = n_nonzero * (n_nonzero + 1) * (2 * n_nonzero + 1) / 24.0
    z = (stat - mean_w) / math.sqrt(var_w) if var_w > 0 else 0.0
    effect_r = round(abs(z) / math.sqrt(n), 4) if n > 0 else 0.0

    ma_med = round(median(ma_scores), 4)
    bl_med = round(median(bl_scores), 4)
    delta = round(ma_med - bl_med, 4)

    if delta > 0:
        direction = "multi_agent_better"
    elif delta < 0:
        direction = "baseline_better"
    else:
        direction = "no_difference"

    return DimensionTest(
        dimension=label,
        ma_scores=ma_scores,
        bl_scores=bl_scores,
        statistic=round(stat, 4),
        p_value=round(p, 6),
        effect_size_r=effect_r,
        significant=p < 0.05,
        direction=direction,
        ma_median=ma_med,
        bl_median=bl_med,
        delta_median=delta,
    )


def run_wilcoxon(
    paired_results: list[dict[str, Any]],
) -> WilcoxonResult:
    """
    Parameters
    ----------
    paired_results : list of dicts, each with keys:
        'scenario_id', 'multi_agent' (RubricResult.to_dict()),
        'baseline' (RubricResult.to_dict())

    Returns
    -------
    WilcoxonResult with composite and per-dimension tests.
    """
    n = len(paired_results)
    if n < 2:
        raise ValueError("Wilcoxon test requires at least 2 paired observations.")

    dimension_keys = [
        "d1_strategic_coherence",
        "d2_evidence_grounding",
        "d3_risk_coverage",
        "d4_actionability",
        "d5_analytical_depth",
    ]

    # Extract score arrays
    ma_composite = [r["multi_agent"]["composite"] for r in paired_results]
    bl_composite = [r["baseline"]["composite"] for r in paired_results]

    ma_dims: dict[str, list[float]] = {d: [] for d in dimension_keys}
    bl_dims: dict[str, list[float]] = {d: [] for d in dimension_keys}

    for r in paired_results:
        for dim in dimension_keys:
            ma_dims[dim].append(r["multi_agent"]["dimensions"][dim]["score"])
            bl_dims[dim].append(r["baseline"]["dimensions"][dim]["score"])

    composite_test = _run_test("composite", ma_composite, bl_composite, n)

    dimension_tests = [
        _run_test(dim, ma_dims[dim], bl_dims[dim], n)
        for dim in dimension_keys
    ]

    # Interpretation following Cohen (1988) effect size conventions
    r = composite_test.effect_size_r
    if r >= 0.5:
        effect_label = "large"
    elif r >= 0.3:
        effect_label = "medium"
    elif r >= 0.1:
        effect_label = "small"
    else:
        effect_label = "negligible"

    sig_dims = [d.dimension for d in dimension_tests if d.significant]

    if composite_test.significant:
        interpretation = (
            f"The multi-agent ASIS pipeline produced statistically significantly "
            f"higher composite scores than the single-agent baseline "
            f"(W={composite_test.statistic}, p={composite_test.p_value:.4f}, "
            f"r={r:.3f}, {effect_label} effect, n={n}). "
            f"Significant dimensions: {', '.join(sig_dims) if sig_dims else 'none individually'}."
        )
    else:
        interpretation = (
            f"The composite score difference was not statistically significant at α=0.05 "
            f"(W={composite_test.statistic}, p={composite_test.p_value:.4f}, "
            f"r={r:.3f}, {effect_label} effect, n={n}). "
            "This may reflect insufficient power (n=10) rather than absence of effect; "
            "a larger replication is recommended."
        )

    return WilcoxonResult(
        n_scenarios=n,
        composite=composite_test,
        dimensions=dimension_tests,
        overall_significant=composite_test.significant,
        interpretation=interpretation,
        fallback_used=not _SCIPY_AVAILABLE,
    )
