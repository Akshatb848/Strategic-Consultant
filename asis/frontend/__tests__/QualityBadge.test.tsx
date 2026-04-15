/**
 * QualityBadge — component tests
 *
 * Validates:
 *   1. Overall grade is displayed
 *   2. Passed/total checks count is rendered
 *   3. Quality flags are listed when present
 *   4. No flags section when quality_flags is empty
 *   5. Score sub-sections render (Context, Financial, Execution)
 */
import { render, screen } from "@testing-library/react";
import React from "react";

import { QualityBadge } from "../components/QualityBadge";

const MOCK_QUALITY: Parameters<typeof QualityBadge>[0]["quality"] = {
  overall_grade: "B",
  checks: [
    { id: "decision_prefix", description: "Decision prefix", level: "BLOCK", passed: true },
    { id: "citation_density", description: "Citation density", level: "BLOCK", passed: true },
    { id: "framework_completeness", description: "Framework completeness", level: "BLOCK", passed: true },
    { id: "collaboration_trace", description: "Collaboration trace", level: "BLOCK", passed: true },
    { id: "context_specificity", description: "Context specificity", level: "WARN", passed: false },
    { id: "decision_length", description: "Decision length", level: "WARN", passed: true },
  ],
  quality_flags: ["Strategic question is underspecified."],
  mece_score: 0.72,
  citation_density_score: 0.85,
  internal_consistency_score: 0.78,
  context_specificity_score: 0.55,
  financial_grounding_score: 0.68,
  execution_specificity_score: 0.61,
  retry_count: 0,
};

describe("QualityBadge", () => {
  it("displays the overall grade", () => {
    render(<QualityBadge quality={MOCK_QUALITY} />);
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("displays checks passed count", () => {
    render(<QualityBadge quality={MOCK_QUALITY} />);
    // 5 of 6 checks passed
    expect(screen.getByText("5/6")).toBeInTheDocument();
  });

  it("renders quality flags when present", () => {
    render(<QualityBadge quality={MOCK_QUALITY} />);
    expect(screen.getByText("Strategic question is underspecified.")).toBeInTheDocument();
  });

  it("does not render flags section when quality_flags is empty", () => {
    render(<QualityBadge quality={{ ...MOCK_QUALITY, quality_flags: [] }} />);
    expect(
      screen.queryByText("Strategic question is underspecified.")
    ).not.toBeInTheDocument();
  });

  it("renders Context, Financial, and Execution sub-scores", () => {
    render(<QualityBadge quality={MOCK_QUALITY} />);
    expect(screen.getByText("Context")).toBeInTheDocument();
    expect(screen.getByText("Financial")).toBeInTheDocument();
    expect(screen.getByText("Execution")).toBeInTheDocument();
  });
});
