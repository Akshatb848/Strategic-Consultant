#!/usr/bin/env python3
"""
DSR Evaluation Runner — ASIS v4.0

Runs the complete quantitative DSR evaluation:
  1. Submits all 10 MNC scenarios to both ASIS (multi-agent) and the
     single-agent LLM baseline via the same Groq provider.
  2. Scores each brief with the deterministic five-dimension rubric.
  3. Applies the Wilcoxon signed-rank test across all paired scores.
  4. Writes a timestamped JSON audit trail and Markdown summary to
     ./evaluation_output/ (or --output-dir).

Usage
-----
From asis/backend/:

    # Full run (all 10 scenarios, both systems)
    python scripts/dsr_eval.py

    # Quick smoke-test (scenarios S01 and S02 only)
    python scripts/dsr_eval.py --scenarios S01 S02

    # Custom output directory
    python scripts/dsr_eval.py --output-dir /tmp/dsr_results

    # Skip ASIS pipeline (baseline only, for rubric debugging)
    python scripts/dsr_eval.py --baseline-only

Prerequisites
-------------
- GROQ_API_KEY must be set in the environment (or .env.gcp loaded)
- ASIS_DEMO_MODE must be false
- The asis-backend package must be importable (run from asis/backend/)

Design Decisions
----------------
- Both systems use the same Groq model (llama-3.3-70b-versatile) so the
  experiment controls for model capability and isolates architecture effects.
- The pipeline runs analyses INLINE (no Celery worker required) by calling
  V4EnterpriseWorkflow.run() directly on a synthetic Analysis DB record.
- Each scenario is run sequentially to avoid rate-limit issues on the Groq
  free tier (which limits concurrent requests).
- A 5-second cooldown between scenarios respects Groq's RPM limits.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

# ── Make sure the package is importable ──────────────────────────────────────
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_ROOT))

# Bootstrap settings before any ASIS imports
os.environ.setdefault("ASIS_DEMO_MODE", "false")
os.environ.setdefault("ALLOW_LLM_FALLBACK", "false")
os.environ.setdefault("RUN_ANALYSES_INLINE", "true")
os.environ.setdefault("DATABASE_URL", "sqlite:///./dsr_eval.db")

from asis.backend.config.settings import get_settings
from asis.backend.evaluation.baseline import SingleAgentBaseline
from asis.backend.evaluation.report import build_audit_trail, save_json, save_markdown
from asis.backend.evaluation.rubric import score_brief
from asis.backend.evaluation.scenarios import SCENARIOS, SCENARIO_INDEX, Scenario
from asis.backend.evaluation.statistics import run_wilcoxon


# ── ASIS pipeline runner ──────────────────────────────────────────────────────

def run_asis_pipeline(scenario: Scenario) -> dict:
    """
    Run the V4 multi-agent pipeline on the scenario and return the
    final strategic brief as a dict.

    We create a minimal in-memory Analysis record, invoke the pipeline
    directly, and extract the synthesis output without going through the
    HTTP API. This avoids needing a running web server.
    """
    from asis.backend.db import database as db_state, models
    from asis.backend.graph.pipeline import V4EnterpriseWorkflow
    from asis.backend.graph.context import extract_problem_context

    # Ensure DB schema exists (SQLite auto-create)
    db_state.init_db()

    analysis_id = uuid.uuid4().hex
    with db_state.SessionLocal() as db:
        analysis = models.Analysis(
            id=analysis_id,
            user_id="dsr-eval",
            query=scenario.query,
            company_context=scenario.company_context,
            extracted_context=extract_problem_context(scenario.query, scenario.company_context),
            status="queued",
            run_baseline=False,  # baseline handled separately
        )
        db.add(analysis)
        db.commit()

    workflow = V4EnterpriseWorkflow()
    workflow.run(analysis_id)

    with db_state.SessionLocal() as db:
        analysis = db.get(models.Analysis, analysis_id)
        if not analysis or analysis.status != "completed":
            err = getattr(analysis, "error_message", "unknown") if analysis else "not found"
            raise RuntimeError(
                f"ASIS pipeline failed for {scenario.scenario_id}: {err}"
            )
        brief = dict(analysis.strategic_brief or {})

    brief["_scenario_id"] = scenario.scenario_id
    brief["_system"] = "multi_agent"
    return brief


# ── Per-scenario evaluation ───────────────────────────────────────────────────

def evaluate_scenario(
    scenario: Scenario,
    baseline: SingleAgentBaseline,
    baseline_only: bool = False,
) -> dict:
    print(f"\n{'='*60}")
    print(f"  {scenario.scenario_id} — {scenario.company} ({scenario.decision_type})")
    print(f"{'='*60}")

    # ── Baseline ──
    print("  [1/2] Running single-agent baseline …", end=" ", flush=True)
    t0 = time.perf_counter()
    baseline_brief = baseline.run(scenario.query, scenario.company_context)
    bl_ms = int((time.perf_counter() - t0) * 1000)
    print(f"done ({bl_ms:,} ms)")

    bl_result = score_brief(baseline_brief, scenario.scenario_id, "baseline")

    if baseline_only:
        return {
            "scenario_id": scenario.scenario_id,
            "company": scenario.company,
            "decision_type": scenario.decision_type,
            "multi_agent": None,
            "baseline": bl_result.to_dict(),
            "composite_delta": None,
            "baseline_latency_ms": bl_ms,
            "asis_latency_ms": None,
        }

    # ── ASIS multi-agent ──
    print("  [2/2] Running ASIS 8-agent pipeline …", end=" ", flush=True)
    t0 = time.perf_counter()
    try:
        asis_brief = run_asis_pipeline(scenario)
        asis_ms = int((time.perf_counter() - t0) * 1000)
        print(f"done ({asis_ms:,} ms)")
    except Exception as exc:
        asis_ms = int((time.perf_counter() - t0) * 1000)
        print(f"FAILED ({exc})")
        # Substitute a minimal failed brief so the scenario is still scored
        asis_brief = {
            "_scenario_id": scenario.scenario_id,
            "_system": "multi_agent_failed",
            "_error": str(exc),
        }

    ma_result = score_brief(asis_brief, scenario.scenario_id, "multi_agent")

    composite_delta = round(ma_result.composite - bl_result.composite, 4)
    print(
        f"  Score  MA={ma_result.composite:.2f}  BL={bl_result.composite:.2f}  "
        f"Δ={composite_delta:+.2f}"
    )

    return {
        "scenario_id": scenario.scenario_id,
        "company": scenario.company,
        "decision_type": scenario.decision_type,
        "multi_agent": ma_result.to_dict(),
        "baseline": bl_result.to_dict(),
        "composite_delta": composite_delta,
        "baseline_latency_ms": bl_ms,
        "asis_latency_ms": asis_ms,
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="ASIS DSR Evaluation Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--scenarios",
        nargs="+",
        default=None,
        metavar="SID",
        help="Scenario IDs to run (e.g. S01 S03). Default: all 10.",
    )
    parser.add_argument(
        "--output-dir",
        default="./evaluation_output",
        metavar="DIR",
        help="Directory for JSON and Markdown output files.",
    )
    parser.add_argument(
        "--baseline-only",
        action="store_true",
        help="Skip ASIS pipeline; run and score baseline only (rubric debugging).",
    )
    parser.add_argument(
        "--cooldown",
        type=int,
        default=5,
        metavar="SECS",
        help="Seconds to wait between scenarios (respects Groq RPM limits). Default: 5.",
    )
    args = parser.parse_args()

    # ── Validate settings ──
    settings = get_settings()
    if not settings.groq_api_key:
        print(
            "ERROR: GROQ_API_KEY is not set. "
            "Export it or copy .env.gcp to the working directory.",
            file=sys.stderr,
        )
        sys.exit(1)
    if settings.demo_mode:
        print(
            "ERROR: ASIS_DEMO_MODE is true. Set ASIS_DEMO_MODE=false to run live LLM calls.",
            file=sys.stderr,
        )
        sys.exit(1)

    # ── Select scenarios ──
    if args.scenarios:
        unknown = [sid for sid in args.scenarios if sid not in SCENARIO_INDEX]
        if unknown:
            print(f"ERROR: Unknown scenario IDs: {unknown}", file=sys.stderr)
            sys.exit(1)
        selected = [SCENARIO_INDEX[sid] for sid in args.scenarios]
    else:
        selected = SCENARIOS

    print(f"\nASIS DSR Evaluation — {len(selected)} scenario(s)")
    print(f"Provider : Groq (model={settings.groq_model_primary})")
    print(f"Mode     : {'baseline-only' if args.baseline_only else 'multi-agent vs baseline'}")
    print(f"Output   : {args.output_dir}")

    baseline = SingleAgentBaseline()
    paired_results: list[dict] = []

    for i, scenario in enumerate(selected):
        if i > 0:
            print(f"\n  Cooling down {args.cooldown}s …", end=" ", flush=True)
            time.sleep(args.cooldown)
            print("done")

        result = evaluate_scenario(scenario, baseline, baseline_only=args.baseline_only)
        paired_results.append(result)

    # ── Statistical analysis ──
    if not args.baseline_only and len(paired_results) >= 2:
        complete = [r for r in paired_results if r["multi_agent"] is not None]
        print(f"\n{'='*60}")
        print(f"  Running Wilcoxon signed-rank test on {len(complete)} pairs …")
        wilcoxon = run_wilcoxon(complete)
        print(f"  Composite: W={wilcoxon.composite.statistic}, p={wilcoxon.composite.p_value:.4f}, "
              f"r={wilcoxon.composite.effect_size_r:.3f}")
        print(f"  Significant: {wilcoxon.overall_significant}")
    else:
        wilcoxon = None

    # ── Build and save audit trail ──
    import subprocess
    try:
        git_sha = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], text=True
        ).strip()
    except Exception:
        git_sha = "unknown"

    run_metadata = {
        "git_sha": git_sha,
        "groq_model_primary": settings.groq_model_primary,
        "groq_model_fast": settings.groq_model_fast,
        "n_scenarios_attempted": len(selected),
        "n_scenarios_completed": len(paired_results),
        "baseline_only": args.baseline_only,
        "python_version": sys.version,
        "run_start_utc": datetime.now(timezone.utc).isoformat(),
    }

    audit_trail = build_audit_trail(
        scenarios=selected,
        paired_results=paired_results,
        wilcoxon=wilcoxon or _empty_wilcoxon(),
        run_metadata=run_metadata,
    )

    json_path = save_json(audit_trail, args.output_dir)
    md_path = save_markdown(audit_trail, args.output_dir)

    print(f"\n{'='*60}")
    print(f"  Evaluation complete.")
    print(f"  JSON audit trail : {json_path}")
    print(f"  Markdown summary : {md_path}")
    print(f"{'='*60}\n")


def _empty_wilcoxon():
    """Placeholder WilcoxonResult for baseline-only runs."""
    from asis.backend.evaluation.statistics import WilcoxonResult, DimensionTest
    empty_dim = DimensionTest(
        dimension="N/A",
        ma_scores=[], bl_scores=[],
        statistic=0.0, p_value=1.0,
        effect_size_r=0.0, significant=False,
        direction="no_difference",
        ma_median=0.0, bl_median=0.0, delta_median=0.0,
    )
    return WilcoxonResult(
        n_scenarios=0,
        composite=empty_dim,
        dimensions=[],
        overall_significant=False,
        interpretation="Statistical analysis not run (baseline-only mode).",
    )


if __name__ == "__main__":
    main()
