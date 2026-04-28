"""
Evaluation Engine — wires the RubricScorer into ASIS pipeline output.

The engine is called by pipeline.py when run_baseline=True on an analysis.
It scores both the multi-agent brief and the baseline brief using the same
deterministic five-dimension rubric, then stores the paired result on the
Report.evaluation JSON column for retrieval by the DSR runner script.
"""
from __future__ import annotations

from typing import Any

from asis.backend.evaluation.rubric import (
    DIMENSION_WEIGHTS,
    RubricResult,
    score_brief,
)


class EvaluationEngine:
    """Score a multi-agent brief against a baseline brief using the rubric."""

    WEIGHTS = DIMENSION_WEIGHTS

    def score(self, multi_agent_brief: dict, baseline_brief: dict) -> dict[str, Any]:
        """
        Returns a dict stored in Report.evaluation with both scored results
        and the per-dimension delta.
        """
        scenario_id = (
            multi_agent_brief.get("_scenario_id")
            or baseline_brief.get("_scenario_id")
            or "UNKNOWN"
        )

        ma_result: RubricResult = score_brief(multi_agent_brief, scenario_id, "multi_agent")
        bl_result: RubricResult = score_brief(baseline_brief, scenario_id, "baseline")

        dimension_deltas = {
            dim: round(ma_result.dimension_scores[dim] - bl_result.dimension_scores[dim], 4)
            for dim in ma_result.dimension_scores
        }

        return {
            "multi_agent": ma_result.to_dict(),
            "baseline": bl_result.to_dict(),
            "composite_delta": round(ma_result.composite - bl_result.composite, 4),
            "dimension_deltas": dimension_deltas,
            # Legacy fields kept for backward compatibility
            "multi_agent_score": round(ma_result.composite / 10.0, 4),
            "baseline_score": round(bl_result.composite / 10.0, 4),
            "delta": round((ma_result.composite - bl_result.composite) / 10.0, 4),
            "dimension_scores": {k: round(v / 10.0, 4) for k, v in ma_result.dimension_scores.items()},
        }
