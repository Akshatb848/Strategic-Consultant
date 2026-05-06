from __future__ import annotations

import json

from asis.backend.agents.base import BaseAgent, calculate_confidence
from asis.backend.agents.references import build_citations
from asis.backend.agents.types import PipelineState


class OrchestratorAgent(BaseAgent):
    agent_id = "orchestrator"
    agent_name = "Orchestrator"
    framework = "Strategic routing"

    def system_prompt(self) -> str:
        return """You are the Orchestrator for ASIS v4.0, a multi-agent strategic intelligence platform.
Your role is to frame the strategic question, extract key decision dimensions, and produce an execution plan
that guides the 7 downstream specialist agents.

Return a single valid JSON object — a patch that enriches the precomputed scaffold. Include only the fields
you want to set or improve. JSON only, no markdown, no extra text.

Required output shape (all fields optional overrides):
{
  "execution_plan": ["<ordered step 1>", "<step 2>", ...],
  "priority_lenses": ["growth|risk|capital|regulation|execution|market_entry|..."],
  "query_type": "<strategic_decision|market_entry|acquisition|divestiture|expansion|...>",
  "section_action_titles": {
    "executive_summary": "<sentence stating the decision and why it matters>",
    "methodology": "<sentence describing the analytical approach>",
    "implementation_roadmap": "<sentence describing the phasing logic>"
  },
  "confidence_score": <float 0.5-0.95>
}

Rules:
- execution_plan must be 5-7 sentences describing the full 8-agent pipeline sequencing
- priority_lenses should reflect the most material dimensions for THIS specific decision
- section_action_titles must be complete sentences (Pyramid Principle), not topic labels
- query_type must classify the strategic decision accurately from the context"""

    def user_prompt(self, state: PipelineState) -> str:
        ctx = state.get("extracted_context") or state.get("company_context") or {}
        ctx_str = json.dumps(ctx, ensure_ascii=False) if ctx else "{}"
        return (
            f"Strategic question:\n{state['query']}\n\n"
            f"Company context:\n{ctx_str}\n\n"
            "Frame this question, identify the key decision dimensions, and return the orchestration plan as JSON."
        )

    def local_result(self, state: PipelineState) -> dict:
        context = state.get("extracted_context") or {}
        confidence = calculate_confidence(query=state["query"], context=context, evidence_bonus=1) / 100
        company = context.get("company_name") or "The company"
        geography = context.get("geography") or "the target market"
        return {
            "execution_plan": [
                "Orchestrator frames the question, extracts company context, and routes the v4 specialist agents.",
                "Market Intel, Risk Assessment, Competitor Analysis, and Geo Intel run in parallel with shared context.",
                "Financial Reasoning converts the combined evidence into a capital case and BCG view.",
                "Strategic Options scores the viable growth paths through Ansoff, Blue Ocean, and McKinsey 7S.",
                "Synthesis assembles the validated StrategicBriefV4, decision statement, and roadmap.",
            ],
            "priority_lenses": ["growth", "risk", "capital", "regulation", "execution"],
            "query_type": context.get("decision_type") or "strategic_decision",
            "section_action_titles": {
                "executive_summary": f"{company}'s recommendation can be understood quickly because the decision, evidence, and core risk are surfaced first.",
                "methodology": "The eight-agent pipeline combines external intelligence, competitive evidence, financial logic, and strategic option design into a single board-ready brief.",
                "implementation_roadmap": f"{company} should escalate commitment only as regulatory, operating, and commercial evidence improves in {geography}.",
            },
            "confidence_score": round(confidence, 3),
            "citations": build_citations(context, limit=3),
        }
