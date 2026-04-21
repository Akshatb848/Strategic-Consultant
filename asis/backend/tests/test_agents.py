from __future__ import annotations

import json

import pytest

from asis.backend.agents.llm_proxy import llm_proxy
from asis.backend.agents.market_intel import MarketIntelAgent
from asis.backend.agents.strategic_options import StrategicOptionsAgent
from asis.backend.agents.synthesis_v4 import V4SynthesisAgent
from asis.backend.config.settings import get_settings


def _clear_settings_cache() -> None:
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _reset_settings_cache_fixture():
    _clear_settings_cache()
    yield
    _clear_settings_cache()


def test_llm_proxy_uses_direct_groq_when_proxy_is_absent(monkeypatch):
    monkeypatch.setenv("ASIS_DEMO_MODE", "false")
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("ALLOW_LLM_FALLBACK", "false")
    monkeypatch.setenv("GROQ_API_KEY", "test-groq-key")
    monkeypatch.delenv("LITELLM_PROXY_URL", raising=False)
    monkeypatch.delenv("LITELLM_MASTER_KEY", raising=False)
    _clear_settings_cache()

    captured: dict[str, object] = {}

    class MockResponse(dict):
        usage = {"prompt_tokens": 15, "completion_tokens": 22}

    def fake_completion(**kwargs):
        captured.update(kwargs)
        return MockResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "confidence_score": 0.81,
                                    "citations": [],
                                }
                            )
                        }
                    }
                ]
            }
        )

    monkeypatch.setattr("asis.backend.agents.llm_proxy.completion", fake_completion)

    payload = llm_proxy.generate_json(
        system_prompt="system",
        user_prompt="user",
        models=["claude-sonnet-4-5"],
        agent_id="market_intel",
        analysis_id="analysis-123",
    )

    assert payload is not None
    assert captured["api_key"] == "test-groq-key"
    assert captured["api_base"] == "https://api.groq.com/openai/v1"
    assert captured["model"] == "llama-3.3-70b-versatile"
    assert payload["_token_usage"]["provider_mode"] == "groq_direct"


def test_live_agent_output_is_repaired_against_scaffold(monkeypatch):
    monkeypatch.setenv("ASIS_DEMO_MODE", "false")
    monkeypatch.setenv("ALLOW_LLM_FALLBACK", "false")
    monkeypatch.setenv("GROQ_API_KEY", "test-groq-key")
    _clear_settings_cache()

    def fake_generate_json(**_kwargs):
        return {
            "recommended_option": "Live partner-led route",
            "mckinsey_7s_fit_score": 74,
            "confidence_score": 81,
            "framework_outputs": {
                "ansoff": {
                    "structured_data": {
                        "recommended_quadrant": "market_development",
                    }
                }
            },
        }

    monkeypatch.setattr("asis.backend.agents.base.llm_proxy.generate_json", fake_generate_json)

    result = StrategicOptionsAgent().run(
        {
            "query": "Should Apex Advisory enter the Indian market in 2027 through a phased partnership model?",
            "extracted_context": {
                "company_name": "Apex Advisory",
                "sector": "Consulting",
                "geography": "India",
            },
        }
    )

    assert result.used_fallback is False
    assert result.confidence_score == 0.81
    assert result.data["recommended_option"] == "Live partner-led route"
    assert "strategic_options" in result.data
    assert "framework_outputs" in result.data
    assert set(result.data["framework_outputs"].keys()) == {"ansoff", "mckinsey_7s", "blue_ocean"}
    assert result.data["framework_outputs"]["ansoff"]["structured_data"]["recommended_quadrant"] == "market_development"
    assert result.data["framework_outputs"]["mckinsey_7s"]["structured_data"]["alignment_score"] > 0


def test_agents_fail_fast_without_live_provider_when_fallback_disabled(monkeypatch):
    monkeypatch.setenv("ASIS_DEMO_MODE", "false")
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("ALLOW_LLM_FALLBACK", "false")
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("LITELLM_PROXY_URL", raising=False)
    monkeypatch.delenv("LITELLM_MASTER_KEY", raising=False)
    _clear_settings_cache()

    with pytest.raises(RuntimeError, match="live model output"):
        MarketIntelAgent().run(
            {
                "query": "Should Apex Advisory enter the Indian market in 2027?",
                "extracted_context": {
                    "company_name": "Apex Advisory",
                    "sector": "Consulting",
                    "geography": "India",
                },
            }
        )

    with pytest.raises(RuntimeError, match="live synthesis output"):
        V4SynthesisAgent()._generate(
            {
                "analysis_id": "analysis-xyz",
                "query": "Should Apex Advisory enter the Indian market in 2027?",
                "company_context": {
                    "company_name": "Apex Advisory",
                    "sector": "Consulting",
                    "geography": "India",
                },
                "extracted_context": {
                    "company_name": "Apex Advisory",
                    "sector": "Consulting",
                    "geography": "India",
                },
            }
        )
