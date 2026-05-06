"""
DSR Evaluation Rubric — five-dimension deterministic scorer.

Dimensions (each scored 0–10, two decimal places):
  D1  Strategic Coherence   — recommendation–evidence alignment, MECE, decision clarity
  D2  Evidence Grounding    — citations, financial assumptions, cross-agent consistency
  D3  Risk Coverage         — register completeness, severity calibration, mitigations
  D4  Actionability         — roadmap, KPIs, milestones, clear recommendation
  D5  Analytical Depth      — framework count, specificity, cross-framework synthesis

Scoring is fully deterministic (no LLM judge) so it is reproducible and
produces the same score for the same brief on every run.  This satisfies
the auditability requirement of Gregor and Hevner (2013).

Weights used in the composite score follow the field's practice for
strategic analysis evaluation (see Eisenhardt & Graebner, 2007):
  D1=0.25  D2=0.20  D3=0.20  D4=0.20  D5=0.15
"""
from __future__ import annotations

from dataclasses import dataclass
from statistics import mean
from typing import Any


@dataclass(frozen=True)
class DimensionScore:
    label: str
    score: float          # 0.0 – 10.0
    max_score: float = 10.0
    rationale: str = ""

    @property
    def normalised(self) -> float:
        return round(self.score / self.max_score, 4)


@dataclass
class RubricResult:
    scenario_id: str
    system: str           # "multi_agent" | "baseline"

    d1_strategic_coherence: DimensionScore
    d2_evidence_grounding: DimensionScore
    d3_risk_coverage: DimensionScore
    d4_actionability: DimensionScore
    d5_analytical_depth: DimensionScore

    @property
    def dimension_scores(self) -> dict[str, float]:
        return {
            "d1_strategic_coherence": self.d1_strategic_coherence.score,
            "d2_evidence_grounding": self.d2_evidence_grounding.score,
            "d3_risk_coverage": self.d3_risk_coverage.score,
            "d4_actionability": self.d4_actionability.score,
            "d5_analytical_depth": self.d5_analytical_depth.score,
        }

    @property
    def composite(self) -> float:
        weights = {"d1": 0.25, "d2": 0.20, "d3": 0.20, "d4": 0.20, "d5": 0.15}
        raw = (
            weights["d1"] * self.d1_strategic_coherence.score
            + weights["d2"] * self.d2_evidence_grounding.score
            + weights["d3"] * self.d3_risk_coverage.score
            + weights["d4"] * self.d4_actionability.score
            + weights["d5"] * self.d5_analytical_depth.score
        )
        return round(raw, 4)

    def to_dict(self) -> dict[str, Any]:
        return {
            "scenario_id": self.scenario_id,
            "system": self.system,
            "composite": self.composite,
            "dimensions": {
                k: {"score": v, "max": 10.0, "normalised": round(v / 10.0, 4)}
                for k, v in self.dimension_scores.items()
            },
            "rationale": {
                "d1_strategic_coherence": self.d1_strategic_coherence.rationale,
                "d2_evidence_grounding": self.d2_evidence_grounding.rationale,
                "d3_risk_coverage": self.d3_risk_coverage.rationale,
                "d4_actionability": self.d4_actionability.rationale,
                "d5_analytical_depth": self.d5_analytical_depth.rationale,
            },
        }


# ── Helper extractors ─────────────────────────────────────────────────────────

def _text(*fields: Any) -> str:
    parts = []
    for f in fields:
        if isinstance(f, str):
            parts.append(f)
        elif isinstance(f, dict):
            parts.extend(str(v) for v in f.values())
        elif isinstance(f, list):
            parts.extend(str(item) for item in f)
    return " ".join(parts).lower()


def _count_citations(brief: dict) -> int:
    total = 0
    # Framework-level citations
    for fo in (brief.get("framework_outputs") or {}).values():
        if isinstance(fo, dict):
            total += len(fo.get("citations") or [])
    # Top-level citations array
    total += len(brief.get("citations") or [])
    return total


def _count_roadmap_phases(brief: dict) -> int:
    roadmap = brief.get("implementation_roadmap") or []
    if isinstance(roadmap, list):
        return len(roadmap)
    return 0


def _count_frameworks(brief: dict) -> int:
    return len(brief.get("framework_outputs") or {})


def _risk_categories(brief: dict) -> set[str]:
    risk_data = brief.get("risk_analysis") or {}
    register = risk_data.get("risk_register") or risk_data.get("risks") or []
    categories: set[str] = set()
    if isinstance(register, list):
        for item in register:
            cat = (item.get("category") or item.get("type") or "").lower()
            if cat:
                categories.add(cat)
    return categories


def _has_financial_assumptions(brief: dict) -> bool:
    fa = brief.get("financial_analysis") or {}
    scenario = fa.get("scenario_analysis") or {}
    bottom_up = fa.get("bottom_up_revenue_model") or {}
    return bool(scenario.get("scenarios") or bottom_up.get("sector_build"))


def _recommendation_present(brief: dict) -> bool:
    rec = brief.get("recommendation") or brief.get("decision_recommendation") or ""
    return bool(rec and rec.upper() in {"PROCEED", "CONDITIONAL PROCEED", "DO NOT PROCEED", "HOLD", "ESCALATE", "REJECT"})


def _decision_statement_valid(brief: dict) -> bool:
    ds = brief.get("decision_statement") or ""
    return any(ds.upper().startswith(prefix) for prefix in ("PROCEED", "CONDITIONAL PROCEED", "DO NOT PROCEED"))


def _kpis_present(brief: dict) -> bool:
    roadmap = brief.get("implementation_roadmap") or []
    for phase in roadmap:
        if isinstance(phase, dict) and phase.get("kpis"):
            return True
    bsc = brief.get("balanced_scorecard") or []
    return bool(bsc)


def _mitigations_present(brief: dict) -> bool:
    risk_data = brief.get("risk_analysis") or {}
    register = risk_data.get("risk_register") or risk_data.get("risks") or []
    if isinstance(register, list):
        return any(isinstance(r, dict) and r.get("mitigation") for r in register)
    return False


def _cross_agent_trace_length(brief: dict) -> int:
    trace = brief.get("agent_collaboration_trace") or []
    return len(trace)


# ── Dimension scorers ─────────────────────────────────────────────────────────

def score_d1_strategic_coherence(brief: dict) -> DimensionScore:
    score = 0.0
    notes: list[str] = []

    # 2pt — decision statement begins with a valid prefix
    if _decision_statement_valid(brief):
        score += 2.0
        notes.append("Decision statement has valid prefix (+2)")
    else:
        notes.append("Decision statement missing/invalid prefix (+0)")

    # 2pt — recommendation is a recognised label
    if _recommendation_present(brief):
        score += 2.0
        notes.append("Recommendation label valid (+2)")

    # 2pt — executive summary present and non-trivial (>30 words)
    exec_summary = brief.get("executive_summary") or {}
    if isinstance(exec_summary, dict):
        text = _text(*exec_summary.values())
    else:
        text = str(exec_summary)
    if len(text.split()) >= 30:
        score += 2.0
        notes.append("Executive summary substantive (+2)")
    else:
        notes.append("Executive summary thin or absent (+0)")

    # 2pt — board narrative present and non-trivial (>50 words)
    bn = brief.get("board_narrative") or ""
    if len(str(bn).split()) >= 50:
        score += 2.0
        notes.append("Board narrative substantive (+2)")

    # 2pt — MECE score or internal consistency score ≥ 0.70
    mece = float(brief.get("mece_score") or 0)
    ics = float(brief.get("internal_consistency_score") or 0)
    if mece >= 0.70 or ics >= 0.70:
        score += 2.0
        notes.append("MECE/consistency score ≥0.70 (+2)")
    elif mece >= 0.50 or ics >= 0.50:
        score += 1.0
        notes.append("MECE/consistency score ≥0.50 (+1)")

    return DimensionScore(
        label="D1 Strategic Coherence",
        score=round(min(10.0, score), 2),
        rationale=" | ".join(notes),
    )


def score_d2_evidence_grounding(brief: dict) -> DimensionScore:
    score = 0.0
    notes: list[str] = []

    # 3pt — citation count (0=0pt, 1-4=1pt, 5-9=2pt, ≥10=3pt)
    n_citations = _count_citations(brief)
    if n_citations >= 10:
        score += 3.0
        notes.append(f"{n_citations} citations (+3)")
    elif n_citations >= 5:
        score += 2.0
        notes.append(f"{n_citations} citations (+2)")
    elif n_citations >= 1:
        score += 1.0
        notes.append(f"{n_citations} citations (+1)")
    else:
        notes.append("0 citations (+0)")

    # 3pt — financial assumptions present
    if _has_financial_assumptions(brief):
        score += 3.0
        notes.append("Financial scenario/assumptions present (+3)")
    else:
        notes.append("No financial assumptions (+0)")

    # 2pt — cross-agent collaboration trace ≥5 entries
    trace_len = _cross_agent_trace_length(brief)
    if trace_len >= 5:
        score += 2.0
        notes.append(f"Collaboration trace length={trace_len} (+2)")
    elif trace_len >= 1:
        score += 1.0
        notes.append(f"Collaboration trace length={trace_len} (+1)")

    # 2pt — overall_confidence present and calibrated (50–95 range)
    conf = float(brief.get("overall_confidence") or brief.get("decision_confidence") or 0)
    if 0 < conf <= 1:
        conf *= 100
    if 50 <= conf <= 95:
        score += 2.0
        notes.append(f"Calibrated confidence {conf:.1f}% (+2)")
    elif 0 < conf < 50 or conf > 95:
        score += 1.0
        notes.append(f"Confidence present but extreme {conf:.1f}% (+1)")

    return DimensionScore(
        label="D2 Evidence Grounding",
        score=round(min(10.0, score), 2),
        rationale=" | ".join(notes),
    )


def score_d3_risk_coverage(brief: dict) -> DimensionScore:
    score = 0.0
    notes: list[str] = []

    # 4pt — risk category breadth (target ≥5 distinct categories = 4pt)
    categories = _risk_categories(brief)
    required = {"regulatory", "financial", "operational", "reputational", "strategic", "cyber", "esg", "compliance", "market", "execution"}
    covered = len(categories.intersection(required))
    cat_score = min(4.0, covered * 0.8)
    score += cat_score
    notes.append(f"{covered} risk categories covered ({', '.join(sorted(categories)[:5])}) (+{cat_score:.1f})")

    # 3pt — mitigation strategies present for risks
    if _mitigations_present(brief):
        score += 3.0
        notes.append("Mitigation strategies present (+3)")
    else:
        notes.append("Mitigations absent (+0)")

    # 2pt — severity / likelihood scoring present
    risk_data = brief.get("risk_analysis") or {}
    register = risk_data.get("risk_register") or risk_data.get("risks") or []
    has_severity = any(
        isinstance(r, dict) and (r.get("severity") or r.get("severity_score") or r.get("likelihood"))
        for r in (register if isinstance(register, list) else [])
    )
    if has_severity:
        score += 2.0
        notes.append("Severity/likelihood scoring present (+2)")

    # 1pt — geopolitical or regulatory risk specifically flagged
    full_text = _text(brief.get("risk_analysis") or {})
    if any(kw in full_text for kw in ("geopolit", "regulatory", "compliance", "sanction", "antitrust")):
        score += 1.0
        notes.append("Regulatory/geopolitical risk flagged (+1)")

    return DimensionScore(
        label="D3 Risk Coverage",
        score=round(min(10.0, score), 2),
        rationale=" | ".join(notes),
    )


def score_d4_actionability(brief: dict) -> DimensionScore:
    score = 0.0
    notes: list[str] = []

    # 4pt — roadmap phase count (0=0pt, 1-2=1pt, 3=2pt, 4=4pt)
    phases = _count_roadmap_phases(brief)
    if phases >= 4:
        score += 4.0
        notes.append(f"{phases}-phase roadmap (+4)")
    elif phases == 3:
        score += 2.0
        notes.append(f"{phases}-phase roadmap (+2)")
    elif phases >= 1:
        score += 1.0
        notes.append(f"{phases}-phase roadmap (+1)")
    else:
        notes.append("No roadmap (+0)")

    # 3pt — KPIs or balanced scorecard present
    if _kpis_present(brief):
        score += 3.0
        notes.append("KPIs/BSC present (+3)")

    # 2pt — decision recommendation clear
    if _recommendation_present(brief):
        score += 2.0
        notes.append("Clear recommendation (+2)")

    # 1pt — next-step or immediate action specified
    exec_summary = brief.get("executive_summary") or {}
    ns = ""
    if isinstance(exec_summary, dict):
        ns = str(exec_summary.get("next_step") or "")
    if len(ns.split()) >= 5:
        score += 1.0
        notes.append("Immediate next step specified (+1)")

    return DimensionScore(
        label="D4 Actionability",
        score=round(min(10.0, score), 2),
        rationale=" | ".join(notes),
    )


def score_d5_analytical_depth(brief: dict) -> DimensionScore:
    score = 0.0
    notes: list[str] = []

    # 4pt — framework count (0=0, 1-3=1pt, 4-5=2pt, 6-7=3pt, ≥8=4pt)
    n_frameworks = _count_frameworks(brief)
    if n_frameworks >= 8:
        score += 4.0
    elif n_frameworks >= 6:
        score += 3.0
    elif n_frameworks >= 4:
        score += 2.0
    elif n_frameworks >= 1:
        score += 1.0
    notes.append(f"{n_frameworks} frameworks applied (+{min(4, max(0, n_frameworks//2))})")

    # 3pt — context specificity (company + sector + geography all present)
    context = brief.get("context") or {}
    specificity = sum(1 for k in ("company_name", "sector", "geography", "decision_type") if context.get(k))
    spec_score = min(3.0, specificity * 0.75)
    score += spec_score
    notes.append(f"Context specificity {specificity}/4 (+{spec_score:.1f})")

    # 2pt — strategic options or three-option analysis present
    opts = brief.get("strategic_options") or brief.get("three_options") or {}
    if isinstance(opts, dict) and opts:
        score += 2.0
        notes.append("Strategic options analysis present (+2)")
    elif isinstance(opts, list) and opts:
        score += 2.0
        notes.append("Strategic options analysis present (+2)")

    # 1pt — verification / CoVe output present
    verification = brief.get("verification") or brief.get("cove_verification") or {}
    if verification:
        score += 1.0
        notes.append("Verification/CoVe output present (+1)")

    return DimensionScore(
        label="D5 Analytical Depth",
        score=round(min(10.0, score), 2),
        rationale=" | ".join(notes),
    )


# ── Public interface ──────────────────────────────────────────────────────────

def score_brief(brief: dict, scenario_id: str, system: str) -> RubricResult:
    """
    Apply all five dimensions to a brief and return a RubricResult.

    Parameters
    ----------
    brief       : The strategic brief dict (multi-agent or baseline output).
    scenario_id : E.g. "S01".
    system      : "multi_agent" or "baseline".
    """
    return RubricResult(
        scenario_id=scenario_id,
        system=system,
        d1_strategic_coherence=score_d1_strategic_coherence(brief),
        d2_evidence_grounding=score_d2_evidence_grounding(brief),
        d3_risk_coverage=score_d3_risk_coverage(brief),
        d4_actionability=score_d4_actionability(brief),
        d5_analytical_depth=score_d5_analytical_depth(brief),
    )


DIMENSION_WEIGHTS: dict[str, float] = {
    "d1_strategic_coherence": 0.25,
    "d2_evidence_grounding": 0.20,
    "d3_risk_coverage": 0.20,
    "d4_actionability": 0.20,
    "d5_analytical_depth": 0.15,
}

DIMENSION_LABELS: dict[str, str] = {
    "d1_strategic_coherence": "D1 Strategic Coherence",
    "d2_evidence_grounding": "D2 Evidence Grounding",
    "d3_risk_coverage": "D3 Risk Coverage",
    "d4_actionability": "D4 Actionability",
    "d5_analytical_depth": "D5 Analytical Depth",
}
