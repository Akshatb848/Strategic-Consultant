from __future__ import annotations

import json

import pytest

from asis.backend.agents.llm_proxy import llm_proxy
from asis.backend.agents.financial_reasoning import FinancialReasoningAgent
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


def test_synthesis_retries_with_compact_repair_prompt(monkeypatch):
    monkeypatch.setenv("ASIS_DEMO_MODE", "false")
    monkeypatch.setenv("ALLOW_LLM_FALLBACK", "false")
    monkeypatch.setenv("GROQ_API_KEY", "test-groq-key")
    _clear_settings_cache()

    prompts: list[str] = []
    responses = [
        None,
        {
            "decision_statement": "PROCEED — enter through a phased partnership route with milestone gates.",
            "executive_summary": {
                "headline": "placeholder",
                "key_argument_1": "Demand and controls support phased expansion.",
                "key_argument_2": "Capital discipline remains intact through staged investment.",
                "key_argument_3": "Partner leverage reduces execution friction.",
                "critical_risk": "Execution discipline must stay ahead of growth.",
                "next_step": "Validate the first-wave partner roster.",
            },
            "board_narrative": "A compact retry prompt produced a valid live narrative patch.",
            "recommendation": "PROCEED",
            "overall_confidence": 0.78,
        },
    ]

    def fake_generate_json(**kwargs):
        prompts.append(str(kwargs["user_prompt"]))
        return responses.pop(0)

    monkeypatch.setattr("asis.backend.agents.synthesis_v4.llm_proxy.generate_json", fake_generate_json)

    result = V4SynthesisAgent().run(
        {
            "analysis_id": "analysis-retry",
            "query": "Should Bain & Company expand AI governance services across India and Europe by 2027?",
            "company_context": {
                "company_name": "Bain & Company",
                "sector": "Consulting",
                "geography": "India and Europe",
                "decision_type": "expand",
            },
            "extracted_context": {
                "company_name": "Bain & Company",
                "sector": "Consulting",
                "geography": "India and Europe",
                "decision_type": "expand",
            },
            "market_intel_output": {},
            "risk_assessment_output": {},
            "competitor_analysis_output": {},
            "geo_intel_output": {},
            "financial_reasoning_output": {},
            "strategic_options_output": {},
            "framework_outputs": {},
            "agent_collaboration_trace": [],
            "quality_failures": [],
            "quality_retry_count": 0,
        }
    )

    assert result.used_fallback is False
    assert result.data["board_narrative"] == "A compact retry prompt produced a valid live narrative patch."
    assert len(prompts) == 2
    assert len(prompts[1]) < len(prompts[0])
    assert "required_fields" in prompts[1]


def test_large_investment_uses_benchmark_scenario_math_and_scaled_roadmap():
    query = "Should Acme Capital make a $1.5 billion acquisition of MittelTech in Germany over 5 years?"
    context = {
        "company_name": "Acme Capital",
        "sector": "Technology",
        "geography": "Germany",
        "decision_type": "acquire",
    }
    financial = FinancialReasoningAgent().local_result({"query": query, "extracted_context": context})
    assert financial["financial_projections"]["year_3"]["revenue"] >= 250_000_000

    brief = V4SynthesisAgent().local_result(
        {
            "analysis_id": "large-investment",
            "query": query,
            "extracted_context": context,
            "financial_reasoning_output": financial,
        }
    )
    scenarios = brief["financial_analysis"]["scenario_analysis"]["scenarios"]
    base = next(item for item in scenarios if item["name"] == "Base")
    assert 16 <= base["irr_pct"] <= 22
    assert base["payback_months"] < 120
    assert base["roi_multiple"] > 0.8
    assert "Large-capital deal" in base["investment_basis"]
    assert brief["implementation_roadmap"][0]["estimated_investment_usd"] >= 10_000_000
    assert all(option["fit_score"] >= 10 for option in brief["market_analysis"]["strategic_pathways"]["options"])


def test_synthesis_resets_generated_narrative_that_contradicts_decision():
    agent = V4SynthesisAgent()
    scaffold = agent.local_result(
        {
            "analysis_id": "contradiction-guard",
            "query": "Should Acme Advisory enter Germany through a partner-led model?",
            "extracted_context": {
                "company_name": "Acme Advisory",
                "sector": "Consulting",
                "geography": "Germany",
                "decision_type": "enter",
            },
        }
    )
    generated = {
        "decision_statement": "CONDITIONAL PROCEED — enter Germany only after partner and regulatory gates are met.",
        "board_narrative": "We recommend against this move and do not proceed under the current plan.",
        "recommendation": "Do not proceed.",
        "executive_summary": {
            **scaffold["executive_summary"],
            "key_argument_1": "The board should not proceed because the case is invalid.",
        },
    }

    merged = agent._merge_generated_brief(scaffold, generated)
    assert "do not proceed" not in merged["board_narrative"].lower()
    assert "recommend against" not in merged["board_narrative"].lower()
    assert merged["executive_summary"]["headline"] == merged["decision_statement"]
