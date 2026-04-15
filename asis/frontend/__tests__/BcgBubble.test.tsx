/**
 * BcgBubble — component tests
 *
 * Validates:
 *   1. Data-insufficiency fallback renders when business_units is empty
 *   2. Chart renders when valid data is provided
 *   3. Data-insufficiency fallback renders when no value fields are present
 */
import { render, screen } from "@testing-library/react";
import React from "react";

import { BcgBubble } from "../components/charts/BcgBubble";

// recharts uses ResizeObserver; mock it for jsdom
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("BcgBubble", () => {
  it("shows insufficiency notice when business_units is empty", () => {
    render(<BcgBubble structuredData={{ business_units: [] }} />);
    expect(screen.getByText(/BCG Matrix — Insufficient Data/i)).toBeInTheDocument();
  });

  it("shows insufficiency notice when units have no market share or growth data", () => {
    render(
      <BcgBubble
        structuredData={{ business_units: [{ name: "Unit A", category: "star" }] }}
      />
    );
    expect(screen.getByText(/BCG Matrix — Insufficient Data/i)).toBeInTheDocument();
  });

  it("renders chart when valid data provided", () => {
    const data = {
      business_units: [
        {
          name: "Unit A",
          category: "star",
          relative_market_share: 1.5,
          market_growth_rate: 18,
          revenue_usd_mn: 120,
        },
      ],
    };
    const { container } = render(<BcgBubble structuredData={data} />);
    // recharts renders an SVG element when data is present
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.queryByText(/Insufficient Data/i)).not.toBeInTheDocument();
  });
});
