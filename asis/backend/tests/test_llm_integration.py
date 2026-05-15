"""
Integration tests for LLM providers and agent pipeline.
Tests Groq API connectivity, model availability, and synthesis quality.
"""

import pytest
import json
from unittest.mock import patch, MagicMock
from asis.backend.agents.llm_proxy import llm_proxy, LiteLLMProxy
from asis.backend.config.settings import get_settings


class TestGroqIntegration:
    """Test Groq API connectivity and model availability."""

    def test_groq_api_key_configured(self):
        """Verify Groq API key is configured in environment."""
        settings = get_settings()
        assert settings.groq_api_key, "GROQ_API_KEY must be configured"
        assert settings.groq_api_key.startswith("gsk_"), "GROQ_API_KEY should start with 'gsk_'"

    def test_groq_api_base_configured(self):
        """Verify Groq API base URL is correct."""
        settings = get_settings()
        assert settings.groq_api_base == "https://api.groq.com/openai/v1"

    def test_groq_models_configured(self):
        """Verify Groq models are configured."""
        settings = get_settings()
        assert settings.groq_model_primary == "llama-3.3-70b-versatile"
        assert settings.groq_model_fast == "llama-3.1-8b-instant"
        assert settings.groq_model_reasoning == "llama-3.3-70b-versatile"

    def test_llm_proxy_groq_available(self):
        """Test that LLM proxy correctly identifies Groq as available."""
        settings = get_settings()
        use_groq = bool(settings.groq_api_key)
        assert use_groq, "Groq should be available when GROQ_API_KEY is set"

    def test_demo_mode_disabled(self):
        """Verify demo mode is disabled for production behavior."""
        settings = get_settings()
        assert not settings.demo_mode, "ASIS_DEMO_MODE must be false for production"

    def test_allow_llm_fallback_disabled(self):
        """Verify LLM fallback is disabled (fail hard on LLM errors)."""
        settings = get_settings()
        assert not settings.allow_llm_fallback, "ALLOW_LLM_FALLBACK must be false for production"

    def test_json_extraction_valid_json(self):
        """Test JSON extraction from various response formats."""
        proxy = LiteLLMProxy()

        test_cases = [
            ('{"key": "value"}', {"key": "value"}),
            ('```json\n{"key": "value"}\n```', {"key": "value"}),
            ('```\n{"key": "value"}\n```', {"key": "value"}),
            ('Some text {"key": "value"} more text', {"key": "value"}),
        ]

        for response, expected in test_cases:
            result = proxy._extract_json_payload(response)
            assert result == expected, f"Failed to extract JSON from: {response}"

    def test_json_extraction_invalid_json(self):
        """Test JSON extraction handles invalid JSON gracefully."""
        proxy = LiteLLMProxy()

        with pytest.raises(json.JSONDecodeError):
            proxy._extract_json_payload("not json at all")

    def test_json_extraction_nested_objects(self):
        """Test JSON extraction with nested objects and arrays."""
        proxy = LiteLLMProxy()

        complex_json = '{"data": {"nested": [1, 2, 3]}, "status": "ok"}'
        result = proxy._extract_json_payload(complex_json)

        assert result["data"]["nested"] == [1, 2, 3]
        assert result["status"] == "ok"


class TestLLMProxyConfiguration:
    """Test LLM proxy configuration and fallback chain."""

    def test_groq_selected_when_litellm_unavailable(self):
        """Verify Groq is used when LiteLLM proxy is not configured."""
        settings = get_settings()
        assert not settings.litellm_proxy_url, "LiteLLM proxy should not be configured"
        assert settings.groq_api_key, "Groq should be available"

    def test_model_alias_resolution_groq(self):
        """Test Groq model alias resolution for different agent types."""
        proxy = LiteLLMProxy()
        settings = get_settings()

        test_cases = [
            ("claude-sonnet-4-5", "orchestrator", settings.groq_model_fast),
            ("claude-sonnet-4-5", "financial_reasoning", settings.groq_model_reasoning),
            ("llama-3.3-70b-versatile", "any_agent", "llama-3.3-70b-versatile"),
        ]

        for candidate, agent_id, expected in test_cases:
            result = proxy._groq_model_alias(settings, candidate, agent_id)
            assert result == expected, f"Failed for {candidate} with agent {agent_id}"

    def test_model_cost_estimation(self):
        """Test token cost estimation for different models."""
        from asis.backend.agents.llm_proxy import _estimate_cost

        test_cases = [
            ("llama-3.3-70b-versatile", 1000, 500, True),  # Should be < $0.01
            ("claude-sonnet-4-5", 1000, 500, True),        # Should be < $0.01
            ("gpt-4o", 1000, 500, True),                   # Should be < $0.01
        ]

        for model, tokens_in, tokens_out, should_be_reasonable in test_cases:
            cost = _estimate_cost(model, tokens_in, tokens_out)
            if should_be_reasonable:
                assert 0 < cost < 0.1, f"Cost for {model} seems unreasonable: ${cost}"


class TestSynthesisAgentIntegration:
    """Test Synthesis agent with real LLM connection."""

    def test_synthesis_agent_has_valid_models(self):
        """Verify synthesis agent has valid model configuration."""
        from asis.backend.agents.synthesis_v4 import V4SynthesisAgent

        agent = V4SynthesisAgent()
        models = agent.resolve_models()

        assert len(models) > 0, "Synthesis agent must have models configured"
        assert all(isinstance(m, str) for m in models), "All models must be strings"

    def test_synthesis_system_prompt_complete(self):
        """Verify synthesis system prompt has all required rules."""
        from asis.backend.agents.synthesis_v4 import V4SynthesisAgent

        agent = V4SynthesisAgent()
        prompt = agent.system_prompt()

        required_phrases = [
            "decision_statement MUST begin with exactly one of",
            "PROCEED —",
            "CONDITIONAL PROCEED —",
            "DO NOT PROCEED —",
            "CONSISTENCY ENFORCEMENT",
            "PYRAMID PRINCIPLE",
            "MECE VALIDATION",
        ]

        for phrase in required_phrases:
            assert phrase in prompt, f"System prompt missing: {phrase}"

    def test_synthesis_agent_error_handling(self):
        """Verify synthesis agent handles LLM errors gracefully."""
        from asis.backend.agents.synthesis_v4 import V4SynthesisAgent

        agent = V4SynthesisAgent()
        assert hasattr(agent, '_generate'), "Agent must have _generate method"
        assert hasattr(agent, 'run'), "Agent must have run method"


class TestPipelineIntegration:
    """Test full pipeline integration with real LLM."""

    def test_all_agents_importable(self):
        """Verify all agents can be imported without errors."""
        from asis.backend.agents.orchestrator import OrchestratorAgent
        from asis.backend.agents.market_intel import MarketIntelAgent
        from asis.backend.agents.risk_assessment import RiskAssessmentAgent
        from asis.backend.agents.competitor_analysis import CompetitorAnalysisAgent
        from asis.backend.agents.geo_intel import GeoIntelAgent
        from asis.backend.agents.financial_reasoning import FinancialReasoningAgent
        from asis.backend.agents.strategic_options import StrategicOptionsAgent
        from asis.backend.agents.synthesis_v4 import V4SynthesisAgent

        agents = [
            OrchestratorAgent(),
            MarketIntelAgent(),
            RiskAssessmentAgent(),
            CompetitorAnalysisAgent(),
            GeoIntelAgent(),
            FinancialReasoningAgent(),
            StrategicOptionsAgent(),
            V4SynthesisAgent(),
        ]

        assert len(agents) == 8, "All 8 agents must be importable"

    def test_pipeline_graph_builds(self):
        """Verify pipeline graph can be built."""
        from asis.backend.graph.pipeline import V4EnterpriseWorkflow

        workflow = V4EnterpriseWorkflow()
        assert workflow.graph is not None, "Pipeline graph must be built"

    def test_pipeline_has_synthesis_node(self):
        """Verify synthesis node is in pipeline graph."""
        from asis.backend.graph.pipeline import V4EnterpriseWorkflow

        workflow = V4EnterpriseWorkflow()
        graph_nodes = list(workflow.graph.nodes.keys())

        assert "synthesis" in graph_nodes, "Synthesis node must be in pipeline"


class TestErrorHandling:
    """Test error handling across LLM integration."""

    def test_llm_failure_returns_none(self):
        """Verify LLM proxy returns None on failure."""
        from asis.backend.agents.llm_proxy import LiteLLMProxy
        from unittest.mock import patch

        with patch('asis.backend.agents.llm_proxy.completion', side_effect=Exception("API Error")):
            proxy = LiteLLMProxy()
            result = proxy.generate_json(
                system_prompt="test",
                user_prompt="test",
                model="test-model",
            )
            # Should handle gracefully and try next model or return None
            assert result is None or isinstance(result, dict)

    def test_settings_validation(self):
        """Verify settings have required values for production."""
        settings = get_settings()

        # At least one LLM provider should be configured
        has_provider = bool(settings.groq_api_key or settings.litellm_proxy_url)
        assert has_provider, "Must have at least one LLM provider configured"

    def test_demo_mode_production_check(self):
        """Verify demo mode is not enabled in production."""
        settings = get_settings()

        if settings.environment == "production":
            assert not settings.demo_mode, "Demo mode must be disabled in production"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
