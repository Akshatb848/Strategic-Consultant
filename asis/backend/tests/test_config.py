from __future__ import annotations

from asis.backend.agents.llm_proxy import LiteLLMProxy
from asis.backend.config.settings import get_settings
from asis.backend.db.database import _normalize_database_url


def test_asyncpg_database_url_is_normalized_to_sync_driver(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@host/db")
    get_settings.cache_clear()
    assert _normalize_database_url(get_settings().database_url) == "postgresql+psycopg://user:pass@host/db"


def test_live_llm_modes_are_opt_in(monkeypatch):
    monkeypatch.delenv("ASIS_DEMO_MODE", raising=False)
    monkeypatch.delenv("ALLOW_LLM_FALLBACK", raising=False)
    monkeypatch.setenv("NODE_ENV", "development")
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    get_settings.cache_clear()

    settings = get_settings()

    assert settings.demo_mode is False
    assert settings.allow_llm_fallback is False


def test_litellm_ssl_verify_accepts_bool_or_bundle_path(monkeypatch):
    monkeypatch.setenv("LITELLM_SSL_VERIFY", "false")
    get_settings.cache_clear()
    assert get_settings().litellm_ssl_verify is False

    monkeypatch.setenv("LITELLM_SSL_VERIFY", "C:/corp/ca-bundle.pem")
    get_settings.cache_clear()
    assert get_settings().litellm_ssl_verify == "C:/corp/ca-bundle.pem"


def test_openrouter_free_model_defaults_are_configured(monkeypatch):
    monkeypatch.delenv("OPENROUTER_MODEL_PRIMARY", raising=False)
    monkeypatch.delenv("OPENROUTER_MODEL_FAST", raising=False)
    monkeypatch.delenv("OPENROUTER_MODEL_REASONING", raising=False)
    monkeypatch.delenv("OPENROUTER_MODEL_FALLBACK", raising=False)
    get_settings.cache_clear()

    settings = get_settings()

    assert settings.openrouter_api_base == "https://openrouter.ai/api/v1"
    assert settings.openrouter_model_primary == "nvidia/nemotron-3-super-120b-a12b:free"
    assert settings.openrouter_model_fast == "google/gemma-4-31b-it:free"
    assert settings.openrouter_model_reasoning == "nvidia/nemotron-3-ultra-550b-a55b:free"
    assert settings.openrouter_model_fallback == "openrouter/free"


def test_agent_model_profiles_expose_open_model_fallbacks(monkeypatch):
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
