from __future__ import annotations

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations
from asis.backend.agents.types import PipelineState


class OrchestratorAgent(BaseAgent):
    agent_id = "orchestrator"
    agent_name = "Orchestrator"
    framework = "Strategic routing"

    def local_result(self, state: PipelineState) -> dict:
        context = state.get("extracted_context") or {}
        return {
            "execution_plan": [
                "Strategist decomposes the board question into MECE workstreams.",
                "Quant and Market Intel run in parallel with shared context.",
                "Risk synthesises operational, regulatory and strategic exposure.",
                "Red Team and Ethicist challenge the thesis before CoVe verification.",
                "Synthesis assembles the board-ready brief and roadmap.",
            ],
            "priority_lenses": ["growth", "risk", "capital", "regulation", "execution"],
            "confidence_score": calculate_confidence(query=state["query"], context=context, evidence_bonus=1),
            "citations": build_citations(context, limit=3),
        }
