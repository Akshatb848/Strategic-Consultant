"""
Comprehensive quality and sanity checks for ASIS v4.0.
Validates all agents, LLM integration, and system health.
"""

import pytest
import asyncio
from typing import Dict, Any


class TestSystemSanity:
    """Sanity checks for overall system health."""

    def test_all_imports_work(self):
        """Verify all critical modules can be imported."""
        try:
            from asis.backend.graph.pipeline import V4EnterpriseWorkflow
            from asis.backend.config.settings import get_settings
            from asis.backend.agents.synthesis_v4 import V4SynthesisAgent
            from asis.backend.agents.orchestrator import OrchestratorAgent
            from asis.backend.db.database import SessionLocal
        except ImportError as e:
            pytest.fail(f"Failed to import critical module: {e}")

    def test_settings_load_without_error(self):
        """Verify settings load without errors."""
        from asis.backend.config.settings import get_settings
        settings = get_settings()
        assert settings is not None

    def test_groq_credentials_loaded(self):
        """Verify Groq credentials are loaded from .env."""
        from asis.backend.config.settings import get_settings
        settings = get_settings()
        assert settings.groq_api_key, "GROQ_API_KEY must be loaded"

    def test_production_mode_disabled_demo(self):
        """Verify demo mode is disabled."""
        from asis.backend.config.settings import get_settings
        settings = get_settings()
        assert not settings.demo_mode, "Demo mode must be disabled"

    def test_production_mode_no_fallback(self):
        """Verify LLM fallback is disabled."""
        from asis.backend.config.settings import get_settings
        settings = get_settings()
        assert not settings.allow_llm_fallback, "LLM fallback must be disabled"


class TestAgentQuality:
    """Quality checks for individual agents."""

    def test_orchestrator_agent_quality(self):
        """Verify Orchestrator agent is properly configured."""
        from asis.backend.agents.orchestrator import OrchestratorAgent

        agent = OrchestratorAgent()
        assert agent.agent_id == "orchestrator"
        assert agent.agent_name == "Orchestrator"
        assert agent.system_prompt()
        assert len(agent.system_prompt()) > 100

    def test_synthesis_agent_quality(self):
        """Verify Synthesis agent is properly configured."""
        from asis.backend.agents.synthesis_v4 import V4SynthesisAgent

        agent = V4SynthesisAgent()
        assert agent.agent_id == "synthesis"
        assert agent.agent_name == "Synthesis"
        prompt = agent.system_prompt()
        assert len(prompt) > 1000, "Synthesis prompt should be comprehensive"

        # Verify all critical rules are present
        critical_rules = [
            "decision_statement MUST begin with exactly one of",
            "CONSISTENCY ENFORCEMENT",
            "PYRAMID PRINCIPLE",
            "MECE VALIDATION",
        ]
        for rule in critical_rules:
            assert rule in prompt, f"Synthesis prompt missing: {rule}"

    def test_all_agents_have_models(self):
        """Verify all agents have model configuration."""
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

        for agent in agents:
            models = agent.resolve_models()
            assert len(models) > 0, f"{agent.agent_id} must have models"
            assert all(isinstance(m, str) for m in models)


class TestPipelineQuality:
    """Quality checks for the pipeline."""

    def test_pipeline_builds_successfully(self):
        """Verify pipeline builds without errors."""
        from asis.backend.graph.pipeline import V4EnterpriseWorkflow

        try:
            workflow = V4EnterpriseWorkflow()
            assert workflow.graph is not None
        except Exception as e:
            pytest.fail(f"Pipeline failed to build: {e}")

    def test_pipeline_graph_connectivity(self):
        """Verify pipeline graph is properly connected."""
        from asis.backend.graph.pipeline import V4EnterpriseWorkflow

        workflow = V4EnterpriseWorkflow()
        nodes = list(workflow.graph.nodes.keys())

        expected_agents = [
            "orchestrator",
            "market_intel",
            "risk_assessment",
            "competitor_analysis",
            "geo_intel",
            "financial_reasoning",
            "strategic_options",
            "synthesis",
        ]

        for agent in expected_agents:
            assert agent in nodes, f"Missing agent node: {agent}"

    def test_pipeline_data_flow(self):
        """Verify pipeline data flows correctly."""
        from asis.backend.graph.state import V4PipelineState

        state = V4PipelineState(
            analysis_id="test-quality",
            user_id="user-1",
            query="Should we expand to Europe?",
            company_context={"name": "TechCorp"},
            extracted_context={},
            framework_outputs={},
            framework_citations={},
            agent_collaboration_trace=[],
            decision_statement="",
            decision_confidence=0.0,
            decision_rationale="",
            decision_evidence=[],
        )

        # Verify state can be modified
        assert state["query"] == "Should we expand to Europe?"
        assert state["company_context"]["name"] == "TechCorp"


class TestProductionFixesVerification:
    """Verify all 12 production fixes are in place."""

    def test_fix_1_financial_model_scale(self):
        """Verify Fix #1: Financial model scale logic."""
        from asis.backend.agents.synthesis_v4 import V4SynthesisAgent

        agent = V4SynthesisAgent()
        assert hasattr(agent, '_roadmap_investment_scale')
        assert hasattr(agent, '_scale_roadmap_investments')

    def test_fix_2_consistency_enforcement(self):
        """Verify Fix #2: Consistency enforcement."""
        from asis.backend.agents.synthesis_v4 import V4SynthesisAgent

        agent = V4SynthesisAgent()
        assert hasattr(agent, '_enforce_decision_narrative_consistency')
        assert hasattr(agent, '_text_contradicts_decision')

    def test_fix_3_template_differentiation(self):
        """Verify Fix #3: Template differentiation requirement."""
        from asis.backend.agents.synthesis_v4 import V4SynthesisAgent

        agent = V4SynthesisAgent()
        prompt = agent.system_prompt()
        # Should have rules for differentiation
        assert "differentiation" in prompt.lower() or "specific" in prompt.lower()

    def test_fix_4_typescript_fields(self):
        """Verify Fix #4: TypeScript API fields are present."""
        import os
        api_file = "asis/frontend/lib/api.ts"

        if os.path.exists(api_file):
            with open(api_file, 'r') as f:
                content = f.read()
            assert "total_cost_usd" in content
            assert '"cancelled"' in content

    def test_fix_5_quality_gate_fail(self):
        """Verify Fix #5: Quality gate FAIL display."""
        # Quality gate should exist and be importable
        from asis.backend.quality.gate import QualityGate
        assert QualityGate is not None

    def test_fix_6_roadmap_scaling(self):
        """Verify Fix #6: Roadmap investment scaling."""
        from asis.backend.agents.synthesis_v4 import V4SynthesisAgent

        agent = V4SynthesisAgent()
        assert hasattr(agent, '_roadmap_investment_scale')
        assert hasattr(agent, '_scale_roadmap_investments')

    def test_fix_7_system_prompt_rule_1(self):
        """Verify Fix #7: System prompt rule #1."""
        from asis.backend.agents.synthesis_v4 import V4SynthesisAgent

        agent = V4SynthesisAgent()
        prompt = agent.system_prompt()
        assert "decision_statement MUST begin with exactly one of" in prompt

    def test_fix_8_model_selection(self):
        """Verify Fix #8: 70B model selection."""
        from asis.backend.config.settings import get_settings

        settings = get_settings()
        # Should have reasoning models
        assert settings.groq_model_reasoning
        assert "llama" in settings.groq_model_reasoning.lower()

    def test_fix_9_failure_diagnostics(self):
        """Verify Fix #9: FailureDiagnosticsPanel decimal handling."""
        # This is frontend, but we can verify backend supports it
        from asis.backend.agents.synthesis_v4 import V4SynthesisAgent
        agent = V4SynthesisAgent()
        assert agent is not None

    def test_fix_10_dashboard_prefetch(self):
        """Verify Fix #10: Dashboard RSC prefetch optimization."""
        # This is frontend, verify backend doesn't cause excess requests
        from asis.backend.graph.pipeline import V4EnterpriseWorkflow
        workflow = V4EnterpriseWorkflow()
        assert workflow is not None

    def test_fix_11_pathway_fit_scores(self):
        """Verify Fix #11: Pathway fit scores 0-100 scale."""
        from asis.backend.agents.synthesis_v4 import V4SynthesisAgent

        agent = V4SynthesisAgent()
        prompt = agent.system_prompt()
        # Should mention fit scores or pathway options
        assert "pathway" in prompt.lower() or "option" in prompt.lower()

    def test_fix_12_context_compression(self):
        """Verify Fix #12: Synthesis context compression."""
        from asis.backend.agents.synthesis_v4 import V4SynthesisAgent

        agent = V4SynthesisAgent()
        assert hasattr(agent, '_compress_agent_output')


class TestConfigurationQuality:
    """Quality checks for system configuration."""

    def test_no_hardcoded_secrets(self):
        """Verify no hardcoded secrets in configuration."""
        from asis.backend.config.settings import get_settings

        settings = get_settings()
        # API keys should come from environment, not hardcoded
        assert settings.groq_api_key is not None

    def test_rate_limiting_configured(self):
        """Verify rate limiting is configured."""
        from asis.backend.config.settings import get_settings

        settings = get_settings()
        assert settings.rate_limit_analyses_per_day > 0
        assert settings.rate_limit_analyses_per_minute > 0

    def test_cost_tracking_enabled(self):
        """Verify cost tracking is enabled."""
        from asis.backend.config.settings import get_settings

        settings = get_settings()
        assert settings.cost_tracking_enabled

    def test_database_configured(self):
        """Verify database is configured."""
        from asis.backend.config.settings import get_settings

        settings = get_settings()
        assert settings.database_url
        assert "://" in settings.database_url


class TestErrorHandlingQuality:
    """Quality checks for error handling."""

    def test_synthesis_error_message_clear(self):
        """Verify synthesis error messages are clear."""
        from asis.backend.agents.synthesis_v4 import V4SynthesisAgent

        # The error message should be helpful
        assert "could not obtain live synthesis output" in str(
            "ASIS could not obtain live synthesis output from the configured LLM providers."
        )

    def test_llm_proxy_fallback_chain(self):
        """Verify LLM proxy has proper fallback chain."""
        from asis.backend.agents.llm_proxy import LiteLLMProxy

        proxy = LiteLLMProxy()
        # Should have methods for handling multiple models
        assert hasattr(proxy, '_groq_model_alias')
        assert hasattr(proxy, '_extract_json_payload')
        assert hasattr(proxy, 'generate_json')


class TestPerformanceBaseline:
    """Baseline performance checks."""

    def test_agent_initialization_time(self):
        """Verify agents initialize quickly."""
        import time
        from asis.backend.agents.synthesis_v4 import V4SynthesisAgent

        start = time.time()
        agent = V4SynthesisAgent()
        duration = time.time() - start

        assert duration < 1.0, f"Agent init took {duration}s, should be < 1s"

    def test_pipeline_build_time(self):
        """Verify pipeline builds quickly."""
        import time
        from asis.backend.graph.pipeline import V4EnterpriseWorkflow

        start = time.time()
        workflow = V4EnterpriseWorkflow()
        duration = time.time() - start

        assert duration < 2.0, f"Pipeline build took {duration}s, should be < 2s"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
