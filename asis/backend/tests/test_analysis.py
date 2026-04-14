from __future__ import annotations

import pytest

from conftest import register_user


def _parse_sse_events(raw: str) -> list[tuple[str, str]]:
    events: list[tuple[str, str]] = []
    for chunk in raw.split("\n\n"):
        if not chunk.strip():
            continue
        event_name = ""
        data = ""
        for line in chunk.splitlines():
            if line.startswith("event:"):
                event_name = line.replace("event:", "", 1).strip()
            elif line.startswith("data:"):
                data = line.replace("data:", "", 1).strip()
        if event_name:
            events.append((event_name, data))
    return events


@pytest.mark.anyio
async def test_analysis_lifecycle_and_report_generation(client):
    headers = await register_user(client)
    created = await client.post(
        "/api/v1/analysis",
        headers=headers,
        json={
            "query": "Should Acme Financial enter the Indian fintech market in 2026 with a phased launch model?",
            "company_context": {
                "company_name": "Acme Financial",
                "sector": "Fintech",
                "geography": "India",
                "annual_revenue": "$850M",
                "employees": "4200",
            },
            "run_baseline": True,
        },
    )
    assert created.status_code == 201, created.text
    analysis_id = created.json()["analysis"]["id"]

    detail = await client.get(f"/api/v1/analysis/{analysis_id}", headers=headers)
    assert detail.status_code == 200
    analysis = detail.json()["analysis"]
    assert analysis["status"] == "completed"
    assert analysis["pipeline_version"] == "4.0.0"
    assert analysis["overall_confidence"] != 85
    assert analysis["strategic_brief"]["overall_confidence"] == analysis["overall_confidence"]
    assert analysis["strategic_brief"]["verification"]["overall_verification_score"] == analysis["overall_confidence"]
    assert len(analysis["strategic_brief"]["financial_analysis"]["bottom_up_revenue_model"]["sector_build"]) >= 3
    assert len(analysis["strategic_brief"]["financial_analysis"]["scenario_analysis"]["scenarios"]) == 3
    assert len(analysis["strategic_brief"]["market_analysis"]["capability_fit_matrix"]["rows"]) >= 5
    assert len(analysis["strategic_brief"]["market_analysis"]["strategic_pathways"]["options"]) >= 3
    assert len(analysis["strategic_brief"]["risk_analysis"]["execution_realism"]["items"]) >= 4
    assert analysis["strategic_brief"]["quality_report"]["financial_grounding_score"] > 0
    assert analysis["strategic_brief"]["quality_report"]["execution_specificity_score"] > 0

    reports = await client.get("/api/v1/reports", headers=headers)
    assert reports.status_code == 200
    assert len(reports.json()["reports"]) == 1
    report_id = reports.json()["reports"][0]["id"]

    evaluation = await client.get(f"/api/v1/reports/{report_id}/evaluation", headers=headers)
    assert evaluation.status_code == 200
    assert evaluation.json()["delta"] >= 0


@pytest.mark.anyio
async def test_sse_replays_pipeline_history(client):
    headers = await register_user(client, email="events@example.com")
    created = await client.post(
        "/api/v1/analysis",
        headers=headers,
        json={
            "query": "Should Contoso Consulting expand its managed services offer in the UK over the next 24 months?",
            "company_context": {"company_name": "Contoso Consulting", "sector": "Professional Services", "geography": "UK"},
        },
    )
    analysis_id = created.json()["analysis"]["id"]

    async with client.stream("GET", f"/api/v1/analysis/{analysis_id}/events", headers=headers) as response:
        assert response.status_code == 200
        text = "".join([chunk async for chunk in response.aiter_text()])
    parsed = _parse_sse_events(text)
    event_names = [name for name, _ in parsed]
    assert "agent_start" in event_names
    assert "agent_complete" in event_names
    assert "agent_collaboration" in event_names
    assert "framework_complete" in event_names
    assert "decision_reached" in event_names
    assert "analysis_complete" in event_names
    assert all(payload for _, payload in parsed)


@pytest.mark.anyio
async def test_confidence_scores_vary_across_queries(client):
    headers = await register_user(client, email="confidence@example.com")
    payloads = [
        {"query": "Should Alpha Bank enter the Indian fintech market in 2026?", "company_context": {"company_name": "Alpha Bank", "sector": "Fintech", "geography": "India", "annual_revenue": "$900M"}},
        {"query": "Should Beta Advisory restructure its UK consulting business to improve margin resilience?", "company_context": {"company_name": "Beta Advisory", "sector": "Professional Services", "geography": "UK", "employees": "2100"}},
        {"query": "Should Gamma SaaS acquire a regional AI startup in Europe?", "company_context": {"company_name": "Gamma SaaS", "sector": "Technology", "geography": "Europe"}},
        {"query": "Should Delta Holdings invest in a new digital operating model?", "company_context": {"company_name": "Delta Holdings"}},
        {"query": "What should we do next year?", "company_context": {}},
    ]

    scores = []
    grades = []
    for payload in payloads:
        created = await client.post("/api/v1/analysis", headers=headers, json=payload)
        analysis_id = created.json()["analysis"]["id"]
        detail = await client.get(f"/api/v1/analysis/{analysis_id}", headers=headers)
        analysis = detail.json()["analysis"]
        scores.append(analysis["overall_confidence"])
        grades.append(analysis["strategic_brief"]["quality_report"]["overall_grade"])

    assert len(set(scores)) == len(scores)
    assert 85 not in scores
    assert len(set(grades)) >= 2


@pytest.mark.anyio
async def test_decision_language_tracks_query_type(client):
    headers = await register_user(client, email="decision-language@example.com")
    cases = [
        (
            {
                "query": "Should Alpha Bank enter the Indian fintech market in 2026?",
                "company_context": {"company_name": "Alpha Bank", "sector": "Fintech", "geography": "India"},
            },
            ("enter", "market-entry"),
        ),
        (
            {
                "query": "Should Beta Advisory restructure its UK consulting business to improve margin resilience?",
                "company_context": {"company_name": "Beta Advisory", "sector": "Professional Services", "geography": "UK"},
            },
            ("restructure", "restructuring"),
        ),
        (
            {
                "query": "Should Gamma SaaS acquire a regional AI startup in Europe?",
                "company_context": {"company_name": "Gamma SaaS", "sector": "Technology", "geography": "Europe"},
            },
            ("acquisition", "acquire"),
        ),
    ]

    statements = []
    for payload, expected_terms in cases:
        created = await client.post("/api/v1/analysis", headers=headers, json=payload)
        analysis_id = created.json()["analysis"]["id"]
        detail = await client.get(f"/api/v1/analysis/{analysis_id}", headers=headers)
        brief = detail.json()["analysis"]["strategic_brief"]
        statement = brief["decision_statement"].lower()
        statements.append(statement)
        assert any(term in statement for term in expected_terms), statement

    assert len(set(statements)) == len(statements)


@pytest.mark.anyio
async def test_analysis_completes_when_memory_persistence_fails(client, monkeypatch):
    from asis.backend.memory.store import memory_store

    def fail_remember_analysis(*args, **kwargs):
        raise RuntimeError("memory unavailable")

    monkeypatch.setattr(memory_store, "remember_analysis", fail_remember_analysis)

    headers = await register_user(client, email="memory-fail@example.com")
    created = await client.post(
        "/api/v1/analysis",
        headers=headers,
        json={
            "query": "Should Northwind Software launch a managed AI platform in Germany in 2027?",
            "company_context": {
                "company_name": "Northwind Software",
                "sector": "Enterprise Software",
                "geography": "Germany",
            },
        },
    )
    assert created.status_code == 201, created.text
    analysis_id = created.json()["analysis"]["id"]

    detail = await client.get(f"/api/v1/analysis/{analysis_id}", headers=headers)
    assert detail.status_code == 200, detail.text
    analysis = detail.json()["analysis"]
    assert analysis["status"] == "completed"
    assert analysis["report_id"]

    reports = await client.get("/api/v1/reports", headers=headers)
    assert reports.status_code == 200, reports.text
    assert len(reports.json()["reports"]) == 1


@pytest.mark.anyio
async def test_v4_report_endpoints_and_pdf_generation(client, monkeypatch):
    from asis.backend.api.routes import reports as reports_routes

    headers = await register_user(client, email="reports@example.com")
    created = await client.post(
        "/api/v1/analysis",
        headers=headers,
        json={
            "query": "Should Fabrikam Health launch a digital diagnostics platform in Singapore over the next 18 months?",
            "company_context": {
                "company_name": "Fabrikam Health",
                "sector": "Healthcare Technology",
                "geography": "Singapore",
            },
        },
    )
    assert created.status_code == 201, created.text
    analysis_id = created.json()["analysis"]["id"]

    frameworks = await client.get(f"/api/v1/reports/{analysis_id}/frameworks", headers=headers)
    assert frameworks.status_code == 200, frameworks.text
    framework_outputs = frameworks.json()["framework_outputs"]
    assert set(framework_outputs.keys()) == {
        "ansoff",
        "balanced_scorecard",
        "bcg_matrix",
        "blue_ocean",
        "mckinsey_7s",
        "pestle",
        "porters_five_forces",
        "swot",
    }

    collaboration = await client.get(f"/api/v1/reports/{analysis_id}/collaboration", headers=headers)
    assert collaboration.status_code == 200, collaboration.text
    assert len(collaboration.json()["agent_collaboration_trace"]) >= 5

    decision = await client.get(f"/api/v1/reports/{analysis_id}/decision", headers=headers)
    assert decision.status_code == 200, decision.text
    assert decision.json()["decision_statement"].startswith(("PROCEED", "CONDITIONAL PROCEED", "DO NOT PROCEED"))

    current_settings = reports_routes.get_settings()
    monkeypatch.setattr(current_settings, "frontend_internal_url", "http://frontend:3000", raising=False)
    captured_request: dict[str, object] = {}

    class MockPdfResponse:
        status_code = 200
        content = b"%PDF-1.4\n% ASIS test PDF\n"
        headers = {"Content-Disposition": 'attachment; filename="ASIS_Fabrikam_20260413.pdf"'}
        text = "%PDF-1.4"

    def fake_post(url: str, *args, **kwargs):
        captured_request["url"] = url
        captured_request["json"] = kwargs.get("json")
        return MockPdfResponse()

    monkeypatch.setattr(reports_routes.httpx, "post", fake_post)

    pdf_response = await client.post(f"/api/v1/reports/{analysis_id}/pdf", headers=headers)
    assert pdf_response.status_code == 200, pdf_response.text
    assert pdf_response.content.startswith(b"%PDF-1.4")
    assert "ASIS_Fabrikam_20260413.pdf" in pdf_response.headers.get("content-disposition", "")
    assert captured_request["url"] == f"http://frontend:3000/api/pdf/{analysis_id}"

    payload = captured_request["json"]
    assert isinstance(payload, dict)
    assert payload["analysis_id"] == analysis_id
    assert payload["brief"]["decision_statement"].startswith(("PROCEED", "CONDITIONAL PROCEED", "DO NOT PROCEED"))

    pdf_status = await client.get(f"/api/v1/reports/{analysis_id}/pdf/status", headers=headers)
    assert pdf_status.status_code == 200, pdf_status.text
    assert pdf_status.json() == {"status": "ready", "progress": 100, "error": None}
