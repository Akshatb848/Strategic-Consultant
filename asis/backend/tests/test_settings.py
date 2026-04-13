from __future__ import annotations

from asis.backend.config.settings import get_settings


def test_active_v4_agent_profiles_cover_runtime_ids(monkeypatch):
    monkeypatch.setenv("AGENT_MODEL_RISK_ASSESSMENT", "risk-v4-model")
    monkeypatch.setenv("AGENT_MODEL_COMPETITOR_ANALYSIS", "competitor-v4-model")
    monkeypatch.setenv("AGENT_MODEL_GEO_INTEL", "geo-v4-model")
    monkeypatch.setenv("AGENT_MODEL_FINANCIAL_REASONING", "finance-v4-model")
    monkeypatch.setenv("AGENT_MODEL_STRATEGIC_OPTIONS", "options-v4-model")

    get_settings.cache_clear()
    settings = get_settings()
    profiles = settings.agent_model_profiles

    assert profiles["orchestrator"].primary
    assert profiles["market_intel"].primary
    assert profiles["risk_assessment"].primary == "risk-v4-model"
    assert profiles["competitor_analysis"].primary == "competitor-v4-model"
    assert profiles["geo_intel"].primary == "geo-v4-model"
    assert profiles["financial_reasoning"].primary == "finance-v4-model"
    assert profiles["strategic_options"].primary == "options-v4-model"
    assert profiles["synthesis"].primary

    get_settings.cache_clear()
