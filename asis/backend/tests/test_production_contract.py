from __future__ import annotations

import pytest

from asis.backend.config.settings import get_settings
from asis.backend.evidence import retrieve_live_evidence
from asis.backend.evidence.live import EvidenceProviderError


def test_live_evidence_provider_fails_closed_without_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("TAVILY_API_KEY", "")
    get_settings.cache_clear()
    try:
        with pytest.raises(EvidenceProviderError, match="LIVE_EVIDENCE_PROVIDER_UNAVAILABLE"):
            retrieve_live_evidence(query="test decision", context={})
    finally:
        get_settings.cache_clear()


def test_production_defaults_disable_demo_fallback_and_repair(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("ASIS_DEMO_MODE", raising=False)
    monkeypatch.delenv("ALLOW_LLM_FALLBACK", raising=False)
    monkeypatch.delenv("ALLOW_DETERMINISTIC_REPAIR", raising=False)
    monkeypatch.setenv("REQUIRE_LIVE_EVIDENCE", "true")
    monkeypatch.setenv("ASIS_REQUIRED_LLM_PROVIDER", "openrouter")
    get_settings.cache_clear()
    try:
        settings = get_settings()
        assert settings.demo_mode is False
        assert settings.allow_llm_fallback is False
        assert settings.allow_deterministic_repair is False
        assert settings.require_live_evidence is True
        assert settings.required_llm_provider == "openrouter"
    finally:
        get_settings.cache_clear()
