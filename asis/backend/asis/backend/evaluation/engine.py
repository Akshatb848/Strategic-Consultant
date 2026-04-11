from __future__ import annotations


class EvaluationEngine:
    WEIGHTS = {
        "analytical_depth": 0.25,
        "factual_accuracy": 0.25,
        "contextual_relevance": 0.20,
        "actionability": 0.20,
        "internal_consistency": 0.10,
    }

    def score(self, multi_agent_brief: dict, baseline_brief: dict) -> dict:
        multi_dims = self._dimension_scores(multi_agent_brief)
        base_dims = self._dimension_scores(baseline_brief)
        multi_score = round(sum(multi_dims[k] * self.WEIGHTS[k] for k in self.WEIGHTS), 4)
        base_score = round(sum(base_dims[k] * self.WEIGHTS[k] for k in self.WEIGHTS), 4)
        return {
            "multi_agent_score": multi_score,
            "baseline_score": base_score,
            "delta": round(multi_score - base_score, 4),
            "dimension_scores": multi_dims,
        }

    def _dimension_scores(self, brief: dict) -> dict[str, float]:
        citations = len(brief.get("citations") or [])
        roadmap = len(brief.get("roadmap") or [])
        bsc = len(brief.get("balanced_scorecard") or [])
        recommendation = bool(brief.get("recommendation"))
        verification = bool((brief.get("verification") or {}).get("recommendation") or brief.get("verification"))
        context = brief.get("context") or {}
        specificity = sum(1 for key in ("company_name", "sector", "geography") if context.get(key))
        return {
            "analytical_depth": min(1.0, 0.45 + 0.08 * roadmap + 0.04 * bsc),
            "factual_accuracy": min(1.0, 0.4 + 0.06 * citations),
            "contextual_relevance": min(1.0, 0.45 + 0.15 * specificity),
            "actionability": min(1.0, 0.35 + 0.15 * roadmap + (0.15 if recommendation else 0.0)),
            "internal_consistency": 0.9 if verification else 0.65,
        }
