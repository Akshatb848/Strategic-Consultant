from __future__ import annotations

import pytest

from conftest import register_user


@pytest.mark.anyio
async def test_v4_pipeline_generates_framework_brief_and_decision(client):
    headers = await register_user(client, email="pipeline-v4@example.com")

    created = await client.post(
        "/api/v1/analysis",
        headers=headers,
        json={
            "query": "Should Acme Financial enter the Indian fintech market in 2026 through a phased partnership strategy?",
            "company_context": {
                "company_name": "Acme Financial",
                "sector": "Fintech",
                "geography": "India",
                "decision_type": "market entry",
                "annual_revenue": "$850M",
                "employees": "4200",
            },
        },
    )
    assert created.status_code == 201, created.text

    analysis_id = created.json()["analysis"]["id"]
    detail = await client.get(f"/api/v1/analysis/{analysis_id}", headers=headers)
    assert detail.status_code == 200
    analysis = detail.json()["analysis"]
    brief = analysis["strategic_brief"]

    assert analysis["pipeline_version"] == "4.0.0"
    assert set(brief["framework_outputs"].keys()) >= {
        "pestle",
        "swot",
        "porters_five_forces",
        "ansoff",
        "bcg_matrix",
        "mckinsey_7s",
        "blue_ocean",
        "balanced_scorecard",
    }
    assert len(brief["agent_collaboration_trace"]) >= 5
    assert brief["decision_statement"].startswith(
        ("PROCEED", "CONDITIONAL PROCEED", "DO NOT PROCEED")
    )
    assert brief["decision_confidence"] > 0
    assert len(brief["implementation_roadmap"]) == 4
