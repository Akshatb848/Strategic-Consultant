from __future__ import annotations

from asis.backend.agents.strategic_options import StrategicOptionsAgent
from asis.backend.schemas.v4 import StrategicOptionsOutput


def test_strategic_options_run_populates_frameworks_and_recommendation():
    agent = StrategicOptionsAgent()
    result = agent.run(
        {
            "query": "Should Acme Financial enter the Indian fintech market with a phased partnership strategy?",
            "company_context": {"company_name": "Acme Financial", "sector": "Fintech", "geography": "India"},
            "extracted_context": {
                "company_name": "Acme Financial",
                "sector": "Fintech",
                "geography": "India",
                "decision_type": "market entry",
            },
            "market_intel_output": {
                "market_size_summary": {"headline": "Demand is large and growing in target digital-payment segments."}
            },
        }
    )

    parsed = StrategicOptionsOutput.model_validate(
        {field: result.data[field] for field in StrategicOptionsOutput.model_fields if field in result.data}
    )

    assert parsed.ansoff_quadrant in {
        "market_penetration",
        "market_development",
        "product_development",
        "diversification",
    }
    assert parsed.recommended_option
    assert parsed.option_rationale
    assert parsed.mckinsey_7s_fit_score > 0
    assert set(parsed.framework_outputs.keys()) >= {"ansoff", "mckinsey_7s", "blue_ocean"}
    assert parsed.framework_outputs["ansoff"].structured_data["recommended_quadrant"] in {
        "market_penetration",
        "market_development",
        "product_development",
        "diversification",
    }
