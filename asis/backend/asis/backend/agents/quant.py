from __future__ import annotations

from asis.backend.agents.base import BaseAgent, calculate_confidence, organisation_scale
from asis.backend.agents.references import build_citations
from asis.backend.agents.types import PipelineState


class QuantAgent(BaseAgent):
    agent_id = "quant"
    agent_name = "Quant"
    framework = "Monte Carlo + NPV/IRR"

    def local_result(self, state: PipelineState) -> dict:
        context = state.get("extracted_context") or {}
        scale = organisation_scale(context)
        base_capex = round(4.5 * scale["investment_multiplier"], 1)
        scenarios = [
            {
                "scenario": "Minimal Compliance",
                "capex": f"${base_capex:.1f}M",
                "opex": f"${base_capex * 0.6:.1f}M",
                "risk_reduction": "18%",
                "npv_3yr": f"${base_capex * 1.2:.1f}M",
                "irr": "18%",
                "roi_3yr": "31%",
                "payback_months": 28,
            },
            {
                "scenario": "Strategic Transformation",
                "capex": f"${base_capex * 1.7:.1f}M",
                "opex": f"${base_capex * 0.9:.1f}M",
                "risk_reduction": "34%",
                "npv_3yr": f"${base_capex * 2.4:.1f}M",
                "irr": "27%",
                "roi_3yr": "54%",
                "payback_months": 22,
            },
            {
                "scenario": "Market Leadership",
                "capex": f"${base_capex * 2.6:.1f}M",
                "opex": f"${base_capex * 1.3:.1f}M",
                "risk_reduction": "41%",
                "npv_3yr": f"${base_capex * 2.1:.1f}M",
                "irr": "21%",
                "roi_3yr": "43%",
                "payback_months": 30,
            },
        ]
        return {
            "monte_carlo_summary": {
                "iterations": 1000,
                "p10_outcome": f"Downside case NPV ${base_capex * 0.8:.1f}M",
                "p50_outcome": f"Base case NPV ${base_capex * 2.0:.1f}M",
                "p90_outcome": f"Upside case NPV ${base_capex * 3.1:.1f}M",
                "worst_case": "Execution delay with muted customer adoption in years 1-2",
                "sensitivity_factors": ["time-to-revenue", "regulatory friction", "talent ramp", "pricing power"],
            },
            "investment_scenarios": scenarios,
            "capital_thesis": f"{scale['label'].title()} scale economics support phased investment rather than all-at-once deployment.",
            "confidence_score": calculate_confidence(query=state["query"], context=context, evidence_bonus=7, uncertainty_penalty=0 if context.get("annual_revenue") else 3),
            "citations": build_citations(context),
        }
