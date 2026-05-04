from __future__ import annotations

import pytest

from conftest import register_user
from asis.backend.db import database as db_state
from asis.backend.db import models


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


@pytest.mark.anyio
async def test_pdf_export_blocks_generic_enterprise_report_before_frontend_render(client, monkeypatch):
    headers = await register_user(client, email="pdf-blocked@example.com")
    created = await client.post(
        "/api/v1/analysis",
        headers=headers,
        json={
            "query": (
                "Should Bain & Company allocate $400M-$850M over the next 4-6 years to "
                "differentiate its M&A and technology services from competitors like "
                "McKinsey & Company and Boston Consulting Group through proprietary AI "
                "platforms and data ecosystems across the US and Europe?"
            ),
            "company_context": {
                "company_name": "Bain & Company",
                "sector": "Technology Consulting",
                "geography": "United States and Europe",
                "decision_type": "invest",
            },
        },
    )
    assert created.status_code == 201, created.text
    analysis_id = created.json()["analysis"]["id"]

    with db_state.session_scope() as db:
        report = db.query(models.Report).filter(models.Report.analysis_id == analysis_id).one()
        brief = dict(report.strategic_brief)
        scenarios = [
            {"name": "Conservative", "revenue_year_3_usd_mn": 22.5, "ebitda_margin_pct": 13.6, "roi_multiple": 1.32, "irr_pct": 21.8, "payback_months": 37},
            {"name": "Base", "revenue_year_3_usd_mn": 32.0, "ebitda_margin_pct": 17.6, "roi_multiple": 1.82, "irr_pct": 31.0, "payback_months": 31},
            {"name": "Aggressive", "revenue_year_3_usd_mn": 40.6, "ebitda_margin_pct": 22.6, "roi_multiple": 2.42, "irr_pct": 39.4, "payback_months": 25},
        ]
        for row in scenarios:
            row["formula_basis"] = "generic scaffold"
            row["source_or_assumption"] = "generic scaffold"
            row["investment_basis"] = "generic scaffold"
            row["payback_basis"] = "generic scaffold"
        brief["financial_analysis"]["scenario_analysis"]["scenarios"] = scenarios
        brief["evidence_contract"] = {}
        brief["red_team"]["invalidated_claims"] = []
        report.strategic_brief = brief

    def fail_if_called(*args, **kwargs):
        raise AssertionError("PDF renderer must not be called when export quality gate blocks")

    monkeypatch.setattr("asis.backend.api.routes.reports.httpx.post", fail_if_called)

    pdf_response = await client.post(f"/api/v1/reports/{analysis_id}/pdf", headers=headers)
    assert pdf_response.status_code == 422
    payload = pdf_response.json()["detail"]
    assert payload["code"] == "REPORT_QUALITY_BLOCKED"
    failed_ids = {check["id"] for check in payload["checks"]}
    assert "scenario_duplicate_guard" in failed_ids
    assert "numeric_evidence_contract" in failed_ids

    pdf_status = await client.get(f"/api/v1/reports/{analysis_id}/pdf/status", headers=headers)
    assert pdf_status.status_code == 200
    assert pdf_status.json()["status"] == "blocked"
