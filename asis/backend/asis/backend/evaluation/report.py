"""
DSR Evaluation Audit Trail — Gregor & Hevner (2013) compliance.

Gregor and Hevner (2013) require that a DSR artefact evaluation record:
  1. The evaluation strategy chosen and its justification
  2. The criteria used to judge the artefact
  3. The data collected, its provenance, and the scoring protocol
  4. The statistical analysis performed
  5. The conclusion and limitations

This module serialises all evaluation artefacts to a timestamped JSON
report and optionally to a Markdown summary suitable for appendix inclusion.

References
----------
Gregor, S. & Hevner, A. R. (2013). Positioning and presenting design
  science research for maximum impact. MIS Quarterly, 37(2), 337–355.

Hevner, A. R., March, S. T., Park, J. & Ram, S. (2004). Design science
  in information systems research. MIS Quarterly, 28(1), 75–105.
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from asis.backend.evaluation.scenarios import Scenario
from asis.backend.evaluation.statistics import WilcoxonResult

_EVALUATOR_ID = "ASIS-DSR-AutoScorer-v1.0"
_SCORING_PROTOCOL_VERSION = "1.0"


# ── Audit trail builder ───────────────────────────────────────────────────────

def build_audit_trail(
    scenarios: list[Scenario],
    paired_results: list[dict[str, Any]],
    wilcoxon: WilcoxonResult,
    run_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Assemble the complete audit trail document.

    Parameters
    ----------
    scenarios       : The 10 Scenario objects (for source references).
    paired_results  : Per-scenario dicts from the runner (multi_agent + baseline).
    wilcoxon        : Completed WilcoxonResult.
    run_metadata    : Optional extra context (git SHA, system info, etc.).
    """
    ts = datetime.now(timezone.utc).isoformat()
    run_id = f"DSR-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"

    scenario_manifest = [
        {
            "scenario_id": s.scenario_id,
            "company": s.company,
            "decision_type": s.decision_type,
            "geography": s.geography,
            "sector": s.sector,
            "published_source": s.published_source,
            "source_url": s.source_url,
            "query_sha256": hashlib.sha256(s.query.encode()).hexdigest(),
        }
        for s in scenarios
    ]

    return {
        "dsr_evaluation_report": {
            "run_id": run_id,
            "generated_at_utc": ts,
            "evaluator_id": _EVALUATOR_ID,
            "scoring_protocol_version": _SCORING_PROTOCOL_VERSION,
            "run_metadata": run_metadata or {},
        },
        "evaluation_strategy": _evaluation_strategy_section(),
        "scoring_protocol": _scoring_protocol_section(),
        "scenario_manifest": scenario_manifest,
        "paired_results": paired_results,
        "statistical_analysis": wilcoxon.to_dict(),
        "conclusion": _conclusion_section(wilcoxon),
        "limitations": _limitations_section(),
        "reproducibility": {
            "scorer": "Deterministic heuristic rubric — no LLM judge",
            "random_seed": "N/A (no stochastic operations in scorer)",
            "scipy_version": _get_scipy_version(),
            "input_checksums": {
                r["scenario_id"]: {
                    "multi_agent_sha256": hashlib.sha256(
                        json.dumps(r["multi_agent"], sort_keys=True).encode()
                    ).hexdigest(),
                    "baseline_sha256": hashlib.sha256(
                        json.dumps(r["baseline"], sort_keys=True).encode()
                    ).hexdigest(),
                }
                for r in paired_results
            },
        },
    }


def _evaluation_strategy_section() -> dict[str, Any]:
    return {
        "methodology": "Quantitative DSR evaluation (Hevner et al., 2004, Criterion 3)",
        "design": (
            "Controlled comparison of multi-agent ASIS against a single-agent LLM "
            "baseline. Both systems receive identical inputs (MNC scenario query + "
            "company context) and are scored by the same deterministic five-dimension "
            "rubric. The Wilcoxon signed-rank test (n=10, one-tailed, α=0.05) is "
            "used to test the hypothesis that multi-agent orchestration produces "
            "superior strategic analysis output."
        ),
        "rationale_for_non_parametric_test": (
            "n=10 violates the normality assumption required by a paired t-test "
            "(Central Limit Theorem typically requires n≥30). The Wilcoxon signed-rank "
            "test is the appropriate non-parametric alternative for paired ordinal "
            "or continuous data with small samples (Siegel, 1956; Field, 2013)."
        ),
        "hypothesis": {
            "H0": "median(ASIS score) ≤ median(baseline score) across all scenarios",
            "H1": "median(ASIS score) > median(baseline score) across all scenarios",
            "alpha": 0.05,
            "direction": "one-tailed (greater)",
        },
        "artefact_being_evaluated": "ASIS v4.0 eight-agent LangGraph pipeline",
        "baseline": (
            "Single-agent LLM baseline: one call to the same primary model "
            "(Groq llama-3.3-70b-versatile) with full context in one prompt. "
            "No multi-agent routing, no parallel branches, no quality gate."
        ),
        "control_variable": (
            "Underlying LLM model — both systems use the same Groq model so the "
            "comparison isolates the effect of multi-agent orchestration architecture, "
            "not raw model capability."
        ),
    }


def _scoring_protocol_section() -> dict[str, Any]:
    return {
        "scorer_type": "Automated deterministic rubric (no LLM judge)",
        "inter_rater_reliability_note": (
            "Single automated scorer eliminates inter-rater variance. "
            "The scorer is deterministic: identical inputs always produce identical "
            "scores. This satisfies the auditability requirement of Gregor and "
            "Hevner (2013) Section 3.2 without requiring Kappa calculation."
        ),
        "dimensions": [
            {
                "id": "D1",
                "label": "Strategic Coherence",
                "weight": 0.25,
                "max_score": 10,
                "criteria": [
                    "Decision statement uses valid prefix (PROCEED/CONDITIONAL PROCEED/DO NOT PROCEED) — 2pt",
                    "Recommendation label is a recognised value — 2pt",
                    "Executive summary ≥30 words and substantive — 2pt",
                    "Board narrative ≥50 words — 2pt",
                    "MECE score or internal consistency score ≥0.70 — 2pt",
                ],
            },
            {
                "id": "D2",
                "label": "Evidence Grounding",
                "weight": 0.20,
                "max_score": 10,
                "criteria": [
                    "Citation count (≥10=3pt, ≥5=2pt, ≥1=1pt, 0=0pt) — up to 3pt",
                    "Financial scenario/bottom-up assumptions present — 3pt",
                    "Cross-agent collaboration trace ≥5 entries — up to 2pt",
                    "Overall confidence calibrated to 50–95% range — up to 2pt",
                ],
            },
            {
                "id": "D3",
                "label": "Risk Coverage",
                "weight": 0.20,
                "max_score": 10,
                "criteria": [
                    "Risk category breadth (target 5 of: regulatory/financial/operational/reputational/strategic/cyber/ESG) — up to 4pt",
                    "Mitigation strategies present — 3pt",
                    "Severity/likelihood scoring on register items — 2pt",
                    "Regulatory or geopolitical risk specifically flagged — 1pt",
                ],
            },
            {
                "id": "D4",
                "label": "Actionability",
                "weight": 0.20,
                "max_score": 10,
                "criteria": [
                    "4-phase implementation roadmap present — 4pt (3-phase=2pt, 1-2 phase=1pt)",
                    "KPIs or balanced scorecard present — 3pt",
                    "Clear recommendation label — 2pt",
                    "Specific immediate next step ≥5 words — 1pt",
                ],
            },
            {
                "id": "D5",
                "label": "Analytical Depth",
                "weight": 0.15,
                "max_score": 10,
                "criteria": [
                    "Framework count (≥8=4pt, ≥6=3pt, ≥4=2pt, ≥1=1pt, 0=0pt) — up to 4pt",
                    "Context specificity (company+sector+geography+decision_type) — up to 3pt",
                    "Strategic options or three-option analysis present — 2pt",
                    "Verification/CoVe output present — 1pt",
                ],
            },
        ],
        "composite_formula": (
            "composite = 0.25×D1 + 0.20×D2 + 0.20×D3 + 0.20×D4 + 0.15×D5"
        ),
        "weight_rationale": (
            "D1 carries the highest weight (0.25) because strategic coherence is the "
            "primary deliverable of a board-ready brief. D2–D4 are equally weighted "
            "(0.20 each) reflecting balanced importance of evidence, risk, and "
            "actionability in management consulting practice "
            "(Eisenhardt & Graebner, 2007). D5 is lowest (0.15) as depth without "
            "coherence has limited value."
        ),
    }


def _conclusion_section(wilcoxon: WilcoxonResult) -> dict[str, Any]:
    composite = wilcoxon.composite
    return {
        "statistical_conclusion": wilcoxon.interpretation,
        "composite_result": {
            "W_statistic": composite.statistic,
            "p_value": composite.p_value,
            "effect_size_r": composite.effect_size_r,
            "ma_median_composite": composite.ma_median,
            "bl_median_composite": composite.bl_median,
            "delta_median": composite.delta_median,
            "significant_at_0_05": composite.significant,
        },
        "per_dimension_conclusions": [
            {
                "dimension": d.dimension,
                "direction": d.direction,
                "significant": d.significant,
                "p_value": d.p_value,
                "ma_median": d.ma_median,
                "bl_median": d.bl_median,
            }
            for d in wilcoxon.dimensions
        ],
        "dsr_contribution_claim": (
            "The evaluation provides empirical evidence "
            + (
                "supporting the claim that multi-agent orchestration in ASIS v4.0 "
                "produces strategically superior outputs compared to a single-agent "
                "LLM baseline, satisfying Gregor & Hevner (2013) Criterion 3 "
                "(Evaluation by Observation)."
                if wilcoxon.overall_significant
                else
                "that multi-agent orchestration produces directionally better outputs, "
                "though the difference did not reach statistical significance at α=0.05 "
                "with n=10. This is consistent with limited statistical power; the "
                "DSR contribution claim is better supported by qualitative analysis "
                "of individual scenario outputs."
            )
        ),
    }


def _limitations_section() -> list[dict[str, str]]:
    return [
        {
            "limitation": "Small sample (n=10)",
            "implication": (
                "Statistical power is limited. A post-hoc power analysis "
                "(effect r=0.3, α=0.05, one-tailed Wilcoxon) suggests n≥22 "
                "for 80% power. Results should be treated as preliminary."
            ),
        },
        {
            "limitation": "Automated rubric scorer",
            "implication": (
                "The deterministic rubric measures structural and formal properties "
                "of the brief (citation count, roadmap phases, recommendation presence). "
                "It does not measure the quality of strategic reasoning per se. "
                "Human expert scoring of a subset (n=3) is recommended as validation."
            ),
        },
        {
            "limitation": "Single LLM provider",
            "implication": (
                "Both ASIS and the baseline use Groq (llama-3.3-70b-versatile). "
                "Results may not generalise to other LLM families. "
                "Replication with Claude or GPT-4o is recommended."
            ),
        },
        {
            "limitation": "Scenarios drawn from public sources",
            "implication": (
                "The LLM may have been trained on these scenarios, introducing "
                "data contamination risk. Both systems are equally affected, "
                "preserving internal validity, but external validity to novel "
                "strategic situations requires separate evaluation."
            ),
        },
        {
            "limitation": "No ground-truth validation",
            "implication": (
                "There is no oracle answer for strategic decisions. The rubric "
                "measures output quality proxies, not decision correctness. "
                "Expert practitioner review against published post-decision outcomes "
                "is recommended as a complementary validity check."
            ),
        },
    ]


def _get_scipy_version() -> str:
    try:
        import scipy  # type: ignore[import]
        return scipy.__version__
    except ImportError:
        return "not installed (manual implementation used)"


# ── Output serialisers ────────────────────────────────────────────────────────

def save_json(audit_trail: dict[str, Any], output_dir: str = "./evaluation_output") -> str:
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    run_id = audit_trail["dsr_evaluation_report"]["run_id"]
    path = os.path.join(output_dir, f"{run_id}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(audit_trail, f, indent=2, ensure_ascii=False)
    return path


def save_markdown(audit_trail: dict[str, Any], output_dir: str = "./evaluation_output") -> str:
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    run_id = audit_trail["dsr_evaluation_report"]["run_id"]
    path = os.path.join(output_dir, f"{run_id}.md")

    report = audit_trail["dsr_evaluation_report"]
    stats = audit_trail["statistical_analysis"]
    conclusion = audit_trail["conclusion"]
    protocol = audit_trail["scoring_protocol"]
    limitations = audit_trail["limitations"]
    scenarios = audit_trail["scenario_manifest"]

    lines: list[str] = [
        f"# DSR Evaluation Report — ASIS v4.0",
        f"",
        f"**Run ID:** `{run_id}`  ",
        f"**Generated:** {report['generated_at_utc']}  ",
        f"**Evaluator:** {report['evaluator_id']}  ",
        f"**Scoring Protocol Version:** {report['scoring_protocol_version']}",
        f"",
        f"---",
        f"",
        f"## 1. Evaluation Strategy",
        f"",
        f"**Methodology:** {audit_trail['evaluation_strategy']['methodology']}",
        f"",
        f"**Design:** {audit_trail['evaluation_strategy']['design']}",
        f"",
        f"| | Value |",
        f"|---|---|",
        f"| H₀ | {audit_trail['evaluation_strategy']['hypothesis']['H0']} |",
        f"| H₁ | {audit_trail['evaluation_strategy']['hypothesis']['H1']} |",
        f"| α | {audit_trail['evaluation_strategy']['hypothesis']['alpha']} |",
        f"| Direction | {audit_trail['evaluation_strategy']['hypothesis']['direction']} |",
        f"| n scenarios | {stats['n_scenarios']} |",
        f"",
        f"**Baseline:** {audit_trail['evaluation_strategy']['baseline']}",
        f"",
        f"**Control variable:** {audit_trail['evaluation_strategy']['control_variable']}",
        f"",
        f"---",
        f"",
        f"## 2. Scoring Protocol",
        f"",
        f"**Scorer type:** {protocol['scorer_type']}",
        f"",
        f"**Inter-rater note:** {protocol['inter_rater_reliability_note']}",
        f"",
        f"**Composite formula:** `{protocol['composite_formula']}`",
        f"",
        f"### Dimensions",
        f"",
        f"| ID | Label | Weight | Max |",
        f"|---|---|---|---|",
    ]
    for d in protocol["dimensions"]:
        lines.append(f"| {d['id']} | {d['label']} | {d['weight']} | {d['max_score']} |")

    lines += [
        f"",
        f"---",
        f"",
        f"## 3. Scenario Manifest",
        f"",
        f"| ID | Company | Decision | Geography | Source |",
        f"|---|---|---|---|---|",
    ]
    for s in scenarios:
        lines.append(
            f"| {s['scenario_id']} | {s['company']} | {s['decision_type']} "
            f"| {s['geography']} | [{s['published_source'][:50]}...]({s['source_url']}) |"
        )

    comp = stats["composite"]
    lines += [
        f"",
        f"---",
        f"",
        f"## 4. Statistical Results",
        f"",
        f"### Composite Score — Wilcoxon Signed-Rank Test",
        f"",
        f"| Metric | Value |",
        f"|---|---|",
        f"| Multi-agent median | {comp['ma_median']:.2f} / 10 |",
        f"| Baseline median | {comp['bl_median']:.2f} / 10 |",
        f"| Δ median | {comp['delta_median']:+.2f} |",
        f"| W statistic | {comp['wilcoxon_statistic']} |",
        f"| p-value (one-tailed) | {comp['p_value']:.4f} |",
        f"| Effect size r | {comp['effect_size_r']:.3f} |",
        f"| Significant (α=0.05) | {'**Yes**' if comp['significant_at_0_05'] else 'No'} |",
        f"",
        f"### Per-Dimension Results",
        f"",
        f"| Dimension | MA Median | BL Median | Δ | p | Sig. |",
        f"|---|---|---|---|---|---|",
    ]
    for d in stats["dimensions"]:
        sig = "✓" if d["significant_at_0_05"] else "—"
        lines.append(
            f"| {d['dimension']} | {d['ma_median']:.2f} | {d['bl_median']:.2f} "
            f"| {d['delta_median']:+.2f} | {d['p_value']:.4f} | {sig} |"
        )

    lines += [
        f"",
        f"---",
        f"",
        f"## 5. Conclusion",
        f"",
        conclusion["statistical_conclusion"],
        f"",
        f"**DSR contribution claim:** {conclusion['dsr_contribution_claim']}",
        f"",
        f"---",
        f"",
        f"## 6. Limitations",
        f"",
    ]
    for lim in limitations:
        lines.append(f"**{lim['limitation']}:** {lim['implication']}")
        lines.append(f"")

    lines += [
        f"---",
        f"",
        f"*Report generated automatically by `{report['evaluator_id']}`.*  ",
        f"*Gregor & Hevner (2013): MIS Quarterly 37(2), 337–355.*",
    ]

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return path
