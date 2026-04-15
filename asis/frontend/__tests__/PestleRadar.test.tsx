/**
 * PestleRadar — component tests
 *
 * Validates:
 *   1. Chart renders with valid PESTLE data
 *   2. Chart renders without crash on empty data (all scores default to 0)
 */
import { render } from "@testing-library/react";
import React from "react";

import { PestleRadar } from "../components/charts/PestleRadar";

// recharts uses ResizeObserver; mock it for jsdom
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("PestleRadar", () => {
  it("renders SVG chart with valid PESTLE data", () => {
    const data = {
      political: { score: 7, factors: ["Regulatory scrutiny"] },
      economic: { score: 8, factors: ["GDP growth"] },
      social: { score: 6, factors: ["Demographic trends"] },
      technological: { score: 9, factors: ["AI adoption"] },
      legal: { score: 5, factors: ["Data privacy laws"] },
      environmental: { score: 4, factors: ["ESG requirements"] },
    };
    const { container } = render(<PestleRadar structuredData={data} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders SVG chart without crash on empty structuredData", () => {
    const { container } = render(<PestleRadar structuredData={{}} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
