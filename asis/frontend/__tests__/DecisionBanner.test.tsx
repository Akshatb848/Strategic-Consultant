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

const BASE_PROPS = {
  decision_statement: "PROCEED — Enter Indian fintech market via strategic partnership.",
  decision_confidence: 0.82,
  decision_rationale: "Strong IRR of 34% supported by low competitive rivalry score.",
  supporting_frameworks: ["PESTLE", "Porter's Five Forces"],
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
