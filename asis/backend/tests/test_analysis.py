from __future__ import annotations

import pytest

from conftest import register_user


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
    assert "event: agent_start" in text
    assert "event: agent_complete" in text
    assert "event: agent_collaboration" in text
    assert "event: framework_complete" in text
    assert "event: decision_reached" in text
    assert "event: analysis_complete" in text


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
    for payload in payloads:
        created = await client.post("/api/v1/analysis", headers=headers, json=payload)
        analysis_id = created.json()["analysis"]["id"]
        detail = await client.get(f"/api/v1/analysis/{analysis_id}", headers=headers)
        scores.append(detail.json()["analysis"]["overall_confidence"])

    assert len(set(scores)) == len(scores)
    assert 85 not in scores


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
