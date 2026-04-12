from __future__ import annotations

import pytest

from conftest import register_user


class _FakePdfResponse:
    def __init__(self) -> None:
        self.status_code = 200
        self.content = b"%PDF-1.7\n%mock strategic report\n"
        self.headers = {"Content-Disposition": 'attachment; filename="ASIS_mock.pdf"'}
        self.text = ""


@pytest.mark.anyio
async def test_v4_report_endpoints_and_pdf_generation(client, monkeypatch):
    headers = await register_user(client, email="pdf@example.com")

    created = await client.post(
        "/api/v1/analysis",
        headers=headers,
        json={
            "query": "Should Contoso Consulting expand into India with a strategic partner model?",
            "company_context": {
                "company_name": "Contoso Consulting",
                "sector": "Professional Services",
                "geography": "India",
                "decision_type": "market entry",
            },
        },
    )
    assert created.status_code == 201, created.text
    analysis_id = created.json()["analysis"]["id"]

    frameworks = await client.get(f"/api/v1/reports/{analysis_id}/frameworks", headers=headers)
    assert frameworks.status_code == 200
    assert set(frameworks.json()["framework_outputs"].keys()) >= {
        "pestle",
        "swot",
        "porters_five_forces",
        "ansoff",
        "bcg_matrix",
        "mckinsey_7s",
        "blue_ocean",
        "balanced_scorecard",
    }

    collaboration = await client.get(f"/api/v1/reports/{analysis_id}/collaboration", headers=headers)
    assert collaboration.status_code == 200
    assert len(collaboration.json()["agent_collaboration_trace"]) >= 5

    decision = await client.get(f"/api/v1/reports/{analysis_id}/decision", headers=headers)
    assert decision.status_code == 200
    assert decision.json()["decision_statement"].startswith(
        ("PROCEED", "CONDITIONAL PROCEED", "DO NOT PROCEED")
    )

    monkeypatch.setattr(
        "asis.backend.api.routes.reports.httpx.post",
        lambda *args, **kwargs: _FakePdfResponse(),
    )

    pdf_response = await client.post(f"/api/v1/reports/{analysis_id}/pdf", headers=headers)
    assert pdf_response.status_code == 200
    assert pdf_response.headers["content-type"].startswith("application/pdf")
    assert pdf_response.content.startswith(b"%PDF")

    pdf_status = await client.get(f"/api/v1/reports/{analysis_id}/pdf/status", headers=headers)
    assert pdf_status.status_code == 200
    assert pdf_status.json()["status"] == "ready"
    assert pdf_status.json()["progress"] == 100
