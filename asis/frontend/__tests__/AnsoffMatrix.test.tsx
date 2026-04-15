/**
 * AnsoffMatrix — component tests
 *
 * Validates:
 *   1. All four quadrants render
 *   2. Recommended quadrant is highlighted
 *   3. Empty structuredData renders without crash
 */
import { render, screen } from "@testing-library/react";
import React from "react";

import { AnsoffMatrix } from "../components/charts/AnsoffMatrix";

describe("AnsoffMatrix", () => {
  it("renders all four quadrant labels", () => {
    render(<AnsoffMatrix structuredData={{}} />);
    expect(screen.getByText(/Existing Product \/ Existing Market/i)).toBeInTheDocument();
    expect(screen.getByText(/New Product \/ Existing Market/i)).toBeInTheDocument();
    expect(screen.getByText(/Existing Product \/ New Market/i)).toBeInTheDocument();
    expect(screen.getByText(/New Product \/ New Market/i)).toBeInTheDocument();
  });

  it("highlights the recommended quadrant", () => {
    const data = {
      recommended_quadrant: "market_development",
      market_development: {
        feasibility: 0.8,
        risk: 0.4,
        rationale: "Strong export opportunity",
        initiatives: ["Launch in UK", "Partner with local firm"],
      },
    };
    render(<AnsoffMatrix structuredData={data} />);
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.getByText("Strong export opportunity")).toBeInTheDocument();
    expect(screen.getByText("Launch in UK")).toBeInTheDocument();
  });

  it("renders without crash when structuredData is empty", () => {
    const { container } = render(<AnsoffMatrix structuredData={{}} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("does not show Recommended badge when no recommended_quadrant is set", () => {
    render(<AnsoffMatrix structuredData={{}} />);
    expect(screen.queryByText("Recommended")).not.toBeInTheDocument();
  });
});
