#!/usr/bin/env python
"""Validation script for ASIS v4.0 production fixes."""

import json
from asis.backend.agents.synthesis_v4 import V4SynthesisAgent
from asis.backend.agents.financial_reasoning import FinancialReasoningAgent


def test_fix_1_large_investment_logic():
    """Fix #1: Verify large-capital investment logic is present and functional."""
    agent = V4SynthesisAgent()

    # Mock profile with large investment
    profile = {
        "decision_type": "acquire",
        "context": {
            "investment_range_usd_mn": {"min": 1000, "max": 2000, "mid": 1500}
        }
    }

    # Check that the scale function exists
    assert hasattr(agent, '_roadmap_investment_scale'), "Missing _roadmap_investment_scale method"

    scale = agent._roadmap_investment_scale(profile)
    assert scale > 1.0, f"Scale should be > 1.0 for large investments, got {scale}"
    assert scale == 1500 / 20.0, f"Scale calculation incorrect: expected {1500/20.0}, got {scale}"

    print("✓ Fix #1: Large investment logic working")


def test_fix_2_consistency_enforcement():
    """Fix #2: Verify narrative consistency enforcement is present."""
    agent = V4SynthesisAgent()

    # Check method exists
    assert hasattr(agent, '_enforce_decision_narrative_consistency'), \
        "Missing _enforce_decision_narrative_consistency method"

    # Check static helper exists
    assert hasattr(agent, '_text_contradicts_decision'), \
        "Missing _text_contradicts_decision method"

    # Test contradiction detection
    assert agent._text_contradicts_decision(
        "We recommend against proceeding", is_reject=False
    ), "Should detect 'do not proceed' as contradiction for PROCEED decision"

    assert agent._text_contradicts_decision(
        "We recommend proceeding", is_reject=True
    ), "Should detect 'proceed' as contradiction for DO NOT PROCEED decision"

    print("✓ Fix #2: Consistency enforcement working")


def test_fix_3_template_differentiation():
    """Fix #3: Verify differentiation requirement is in the user prompt."""
    agent = V4SynthesisAgent()

    state = {
        "query": "Should TechCorp enter the German market?",
        "extracted_context": {
            "company_name": "TechCorp",
            "geography": "Germany"
        }
    }

    scaffold = agent.local_result(state)
    prompt = agent._live_user_prompt(state, scaffold)

    assert "differentiation_requirement" in prompt, \
        "Missing differentiation_requirement in user prompt"

    # Verify it contains the required fields
    assert "TechCorp" in prompt, "Company name should be in differentiation requirement"
    assert "Germany" in prompt or "target market" in prompt, \
        "Geography should be in differentiation requirement"

    print("✓ Fix #3: Template differentiation working")


def test_fix_4_typescript_fields():
    """Fix #4: Verify TypeScript API file has required fields."""
    import os
    api_file = "asis/frontend/lib/api.ts"

    if not os.path.exists(api_file):
        api_file = "c:/Users/aksha/OneDrive/Documents/Strategic-Consultant/asis/frontend/lib/api.ts"

    with open(api_file, 'r') as f:
        content = f.read()

    assert "total_cost_usd" in content, "Missing total_cost_usd field in Analysis interface"
    assert '"cancelled"' in content, "Missing 'cancelled' status in Analysis interface"

    print("✓ Fix #4: TypeScript fields present")


def test_fix_6_roadmap_scaling():
    """Fix #6: Verify roadmap investment scaling is functional."""
    agent = V4SynthesisAgent()

    profile = {
        "decision_type": "enter",
        "context": {
            "investment_range_usd_mn": {"min": 1000, "max": 2000, "mid": 1500}
        }
    }

    roadmap = agent._implementation_roadmap(profile)
    scaled_roadmap = agent._scale_roadmap_investments(profile, roadmap)

    # Check that investment amounts are scaled up
    assert len(scaled_roadmap) == len(roadmap), "Roadmap length should not change"

    original_first = roadmap[0].get("estimated_investment_usd", 0)
    scaled_first = scaled_roadmap[0].get("estimated_investment_usd", 0)

    # For large investments, scaled values should be much larger
    assert scaled_first > original_first, \
        f"Scaled investment {scaled_first} should be > original {original_first}"

    print("✓ Fix #6: Roadmap investment scaling working")


def test_fix_7_system_prompt():
    """Fix #7: Verify system prompt has complete rule #1."""
    agent = V4SynthesisAgent()
    prompt = agent.system_prompt()

    assert "decision_statement MUST begin with exactly one of" in prompt, \
        "System prompt missing complete rule #1"

    assert "PROCEED — " in prompt, "Missing PROCEED example"
    assert "CONDITIONAL PROCEED — " in prompt, "Missing CONDITIONAL PROCEED example"
    assert "DO NOT PROCEED — " in prompt, "Missing DO NOT PROCEED example"

    print("✓ Fix #7: System prompt rule #1 complete")


def test_fix_11_pathway_fit_scores():
    """Fix #11: Verify pathway fit scores are on 0-100 scale."""
    agent = V4SynthesisAgent()

    # Create a test scenario
    state = {
        "query": "Should TechCorp acquire StartupX?",
        "extracted_context": {
            "company_name": "TechCorp",
            "geography": "US",
            "decision_type": "acquire"
        }
    }

    scaffold = agent.local_result(state)
    market_analysis = scaffold.get("market_analysis", {})
    pathways = market_analysis.get("strategic_pathways", {})
    options = pathways.get("options", [])

    for option in options:
        fit_score = option.get("fit_score")
        assert fit_score is not None, f"Missing fit_score in option {option.get('name')}"
        # Fit scores should be 0-100, not 0-1
        assert 0 <= fit_score <= 100, \
            f"Fit score {fit_score} for {option.get('name')} out of 0-100 range"
        # If it's supposed to be on 0-100 scale, it should be > 1 for good options
        if "fit_score" in str(option).lower():
            assert fit_score > 1, f"Fit score {fit_score} looks like decimal scale, should be 0-100"

    print("✓ Fix #11: Pathway fit scores on 0-100 scale")


def test_fix_12_context_compression():
    """Fix #12: Verify agent output compression is implemented."""
    agent = V4SynthesisAgent()

    assert hasattr(agent, '_compress_agent_output'), \
        "Missing _compress_agent_output method"

    # Test compression with a large output
    large_output = {
        "field1": "value1",
        "field2": ["item"] * 100,  # Large list
        "citations": list(range(50)),  # Many citations
        "nested": {"key" + str(i): f"value_{i}" for i in range(100)}
    }

    compressed = agent._compress_agent_output(large_output)

    # Compressed should be a dict
    assert isinstance(compressed, dict), "Compressed output should be a dict"

    # Long lists should be truncated
    if "field2" in compressed and isinstance(compressed["field2"], list):
        assert len(compressed["field2"]) <= 3, "Long lists should be truncated to 3 items"

    # Citations should be truncated
    if "citations" in compressed and isinstance(compressed["citations"], list):
        assert len(compressed["citations"]) <= 3, "Citations should be truncated to 3 items"

    print("✓ Fix #12: Context compression working")


def test_financial_reasoning_investment_scaling():
    """Test Fix #1 Change 2: Financial reasoning investment scaling."""
    agent = FinancialReasoningAgent()

    state = {
        "query": "Should TechCorp make a $1.5B investment?",
        "extracted_context": {
            "company_name": "TechCorp",
            "sector": "Technology",
            "geography": "US",
            "investment_range_usd_mn": {"min": 1000, "max": 2000, "mid": 1500}
        }
    }

    result = agent.local_result(state)
    projections = result.get("financial_projections", {})

    # For large investments, projections should be scaled
    year_1_revenue = projections.get("year_1", {}).get("revenue", 0)
    year_3_revenue = projections.get("year_3", {}).get("revenue", 0)

    # Expected scale for $1.5B investment: 1500 / 150 = 10x
    # So year-1 revenue should be around 12M * 10 = 120M
    expected_year_1_scaled = 12_000_000 * (1500 / 150)

    # Allow some flexibility in the calculation
    assert abs(year_1_revenue - expected_year_1_scaled) / expected_year_1_scaled < 0.2, \
        f"Year 1 revenue {year_1_revenue} not properly scaled (expected ~{expected_year_1_scaled})"

    print("✓ Financial reasoning investment scaling working")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("ASIS v4.0 Production Fixes Validation")
    print("="*60 + "\n")

    tests = [
        ("Fix #1: Large Investment Logic", test_fix_1_large_investment_logic),
        ("Fix #2: Consistency Enforcement", test_fix_2_consistency_enforcement),
        ("Fix #3: Template Differentiation", test_fix_3_template_differentiation),
        ("Fix #4: TypeScript Fields", test_fix_4_typescript_fields),
        ("Fix #6: Roadmap Scaling", test_fix_6_roadmap_scaling),
        ("Fix #7: System Prompt", test_fix_7_system_prompt),
        ("Fix #11: Pathway Fit Scores", test_fix_11_pathway_fit_scores),
        ("Fix #12: Context Compression", test_fix_12_context_compression),
        ("Financial Reasoning Scaling", test_financial_reasoning_investment_scaling),
    ]

    passed = 0
    failed = 0

    for test_name, test_func in tests:
        try:
            print(f"Testing {test_name}...", end=" ")
            test_func()
            passed += 1
        except AssertionError as e:
            print(f"✗ FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ ERROR: {e}")
            failed += 1

    print("\n" + "="*60)
    print(f"Results: {passed} passed, {failed} failed")
    print("="*60 + "\n")

    exit(0 if failed == 0 else 1)
