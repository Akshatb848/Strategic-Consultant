from __future__ import annotations

from asis.backend.agents.geo_intel import GeoIntelAgent
from asis.backend.schemas.v4 import GeoIntelOutput


def test_geo_intel_run_populates_schema_and_pestle_fields():
    agent = GeoIntelAgent()
    result = agent.run(
        {
            "query": "Should Acme Financial enter the Indian fintech market with a partner-led launch?",
            "company_context": {"company_name": "Acme Financial", "sector": "Fintech", "geography": "India"},
            "extracted_context": {
                "company_name": "Acme Financial",
                "sector": "Fintech",
                "geography": "India",
                "decision_type": "market entry",
            },
        }
    )

    parsed = GeoIntelOutput.model_validate(
        {field: result.data[field] for field in GeoIntelOutput.model_fields if field in result.data}
    )

    assert 0 <= parsed.political_risk_score <= 10
    assert parsed.trade_barriers
    assert parsed.regulatory_outlook
    assert parsed.cage_distance_analysis["administrative"]
    assert parsed.fdi_sentiment
    assert "pestle" in parsed.framework_outputs
    pestle = parsed.framework_outputs["pestle"].structured_data
    assert pestle["political"]["factors"]
    assert pestle["legal"]["factors"]
    assert result.tools_called and len(result.tools_called) == 2
