/**
 * SwotMatrix — component tests
 *
 * Validates:
 *   1. All four SWOT sections render
 *   2. SWOT items are displayed
 *   3. SWOT implication block renders when present
 *   4. Renders without crash on empty data
 */
import { render, screen } from "@testing-library/react";
import React from "react";

import { SwotMatrix } from "../components/charts/SwotMatrix";

describe("SwotMatrix", () => {
  it("renders all four SWOT section headings", () => {
    render(<SwotMatrix structuredData={{}} />);
    expect(screen.getByText("Strengths")).toBeInTheDocument();
    expect(screen.getByText("Weaknesses")).toBeInTheDocument();
    expect(screen.getByText("Opportunities")).toBeInTheDocument();
    expect(screen.getByText("Threats")).toBeInTheDocument();
  });

  it("renders SWOT items in the correct section", () => {
    const data = {
      strengths: [
        { point: "Strong brand recognition", source_agent: "market_intel" },
      ],
      weaknesses: [
        { point: "Limited distribution network", source_agent: "competitor_analysis" },
      ],
      opportunities: [],
      threats: [],
    };
    render(<SwotMatrix structuredData={data} />);
    expect(screen.getByText("Strong brand recognition")).toBeInTheDocument();
    expect(screen.getByText("Limited distribution network")).toBeInTheDocument();
    expect(screen.getByText("market_intel")).toBeInTheDocument();
  });

  it("renders the SWOT implication block when present", () => {
    const data = {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: [],
      swot_implication: "Overall position is strong but execution risk is high.",
    };
    render(<SwotMatrix structuredData={data} />);
    expect(
      screen.getByText("Overall position is strong but execution risk is high.")
    ).toBeInTheDocument();
  });

  it("does not render implication block when absent", () => {
    render(<SwotMatrix structuredData={{}} />);
    expect(
      screen.queryByText(/Overall position/i)
    ).not.toBeInTheDocument();
  });
});
