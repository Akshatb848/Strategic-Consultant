from __future__ import annotations

from asis.backend.agents.llm_proxy import LiteLLMProxy
from asis.backend.config.settings import get_settings
from asis.backend.db.database import _normalize_database_url


def test_asyncpg_database_url_is_normalized_to_sync_driver(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@host/db")
    get_settings.cache_clear()
    assert _normalize_database_url(get_settings().database_url) == "postgresql+psycopg://user:pass@host/db"


def test_agent_model_profiles_expose_open_model_fallbacks(monkeypatch):
    monkeypatch.setenv("LITELLM_PROXY_URL", "http://litellm:4000")
    monkeypatch.setenv("LITELLM_MASTER_KEY", "test-master-key")
    monkeypatch.setenv("LITELLM_MODEL_GEMINI_PRO", "gemini-2.5-pro")
    monkeypatch.setenv("LITELLM_MODEL_PHI_REASONING", "phi-4-reasoning")
    get_settings.cache_clear()
    profiles = get_settings().agent_model_profiles
    assert profiles["quant"].primary == "gemini-2.5-pro"
    assert "phi-4-reasoning" in profiles["quant"].fallbacks
    assert profiles["synthesis"].open_source == "qwen-strategy"


def test_litellm_proxy_can_extract_fenced_json():
    payload = LiteLLMProxy._extract_json_payload("```json\n{\"answer\": \"ok\"}\n```")
    assert payload == {"answer": "ok"}
