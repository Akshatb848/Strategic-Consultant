from __future__ import annotations

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations
from asis.backend.agents.types import PipelineState


class StrategistAgent(BaseAgent):
    agent_id = "strategist"
    agent_name = "Strategist"
    framework = "Minto Pyramid + MECE decomposition"

    def local_result(self, state: PipelineState) -> dict:
        context = state.get("extracted_context") or {}
        company = context.get("company_name") or "the organisation"
        sector = context.get("sector") or "the target sector"
        geography = context.get("geography") or "the target geography"
        decision = context.get("decision_type") or "strategic move"
        confidence = calculate_confidence(query=state["query"], context=context, evidence_bonus=5)
        decomposition = [
            f"Market attractiveness for {sector} in {geography}.",
            f"Right-to-win and execution fit for {company}.",
            f"Downside risk and governance requirements before the {decision} decision.",
        ]
        hypotheses = [
            f"{company} can outperform if execution is phased and risk-controlled.",
            f"Regulatory and talent constraints will decide speed-to-value more than raw market demand.",
            "Financial upside is real only if adoption and margin assumptions survive adversarial challenge.",
        ]
        workstreams = [
            {"name": "Market & competition", "owner": "Market Intel"},
            {"name": "Financial return case", "owner": "Quant"},
            {"name": "Enterprise risk register", "owner": "Risk"},
        ]
        return {
            "problem_decomposition": decomposition,
            "key_hypotheses": hypotheses,
            "workstreams": workstreams,
            "mece_tree": [
                {
                    "branch": "Strategic attractiveness",
                    "questions": [
                        f"Is {sector} in {geography} attractive enough to justify investment?",
                        "Which sub-segments compound fastest over the next 36 months?",
                    ],
                },
                {
                    "branch": "Right to win",
                    "questions": [
                        f"Does {company} have a differentiated advantage against incumbents?",
                        "Can the operating model absorb the chosen pace of expansion?",
                    ],
                },
                {
                    "branch": "Governance and downside",
                    "questions": [
                        "What breaks the thesis first if assumptions prove optimistic?",
                        "What board gates are required before scaling capital allocation?",
                    ],
                },
            ],
            "analytical_framework": "Minto Pyramid with MECE decomposition and board-priority workstreams.",
            "agent_assignments": workstreams,
            "success_criteria": [
                "A recommendation that is financially viable and risk-adjusted.",
                "A governance posture the board can defend to regulators and stakeholders.",
                "A phased roadmap with explicit value gates and downside triggers.",
            ],
            "decision_type": decision,
            "strategic_priority": "Controlled growth with governance-led execution",
            "time_horizon": "0-36 months with quarterly board gates",
            "confidence_score": confidence,
            "citations": build_citations(context),
        }
