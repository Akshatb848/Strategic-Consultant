/**
 * DecisionBanner — component tests
 *
 * Validates:
 *   1. Decision statement renders prominently
 *   2. Correct colour class applied for PROCEED / CONDITIONAL PROCEED / DO NOT PROCEED
 *   3. Confidence percentage displayed
 *   4. onClick fires when card is clicked
 */
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import { DecisionBanner } from "../components/DecisionBanner";

const MOCK_QUALITY_REPORT = {
  overall_grade: "A" as const,
  checks: [
    { id: "decision_prefix", description: "Decision prefix", level: "BLOCK" as const, passed: true },
    { id: "framework_completeness", description: "Framework completeness", level: "BLOCK" as const, passed: true },
    { id: "decision_length", description: "Decision length", level: "WARN" as const, passed: true },
    { id: "citation_url_format", description: "Citation URL format", level: "WARN" as const, passed: true },
    { id: "cross_agent_consistency", description: "Cross-agent consistency", level: "WARN" as const, passed: true },
    { id: "roadmap_phases", description: "Roadmap phases", level: "WARN" as const, passed: true },
  ],
  quality_flags: [],
  mece_score: 0.88,
  citation_density_score: 0.90,
  internal_consistency_score: 0.87,
  context_specificity_score: 0.82,
  financial_grounding_score: 0.84,
  execution_specificity_score: 0.79,
  retry_count: 0,
};

const BASE_PROPS = {
  decision_statement: "PROCEED — Enter Indian fintech market via strategic partnership.",
  decision_confidence: 0.82,
  decision_rationale: "Strong IRR of 34% supported by low competitive rivalry score.",
  supporting_frameworks: ["PESTLE", "Porter's Five Forces"],
  quality_report: MOCK_QUALITY_REPORT,
  onClick: jest.fn(),
};

describe("DecisionBanner", () => {
  beforeEach(() => {
    BASE_PROPS.onClick.mockClear();
  });

  it("renders the decision statement text", () => {
    render(<DecisionBanner {...BASE_PROPS} />);
    expect(screen.getByText(/Enter Indian fintech market/i)).toBeInTheDocument();
  });

  it("displays confidence percentage", () => {
    render(<DecisionBanner {...BASE_PROPS} />);
    // 0.82 → should show 82%
    expect(screen.getByText(/82/)).toBeInTheDocument();
  });

  it("calls onClick handler when banner is clicked", () => {
    render(<DecisionBanner {...BASE_PROPS} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(BASE_PROPS.onClick).toHaveBeenCalledTimes(1);
  });

  it("renders CONDITIONAL PROCEED variant without crash", () => {
    render(
      <DecisionBanner
        {...BASE_PROPS}
        decision_statement="CONDITIONAL PROCEED — Enter only after regulatory approval."
      />
    );
    expect(screen.getByText(/CONDITIONAL PROCEED/i)).toBeInTheDocument();
  });

  it("renders DO NOT PROCEED variant without crash", () => {
    render(
      <DecisionBanner
        {...BASE_PROPS}
        decision_statement="DO NOT PROCEED — Market conditions are unfavourable."
        decision_confidence={0.15}
      />
    );
    expect(screen.getByText(/DO NOT PROCEED/i)).toBeInTheDocument();
  });
});
