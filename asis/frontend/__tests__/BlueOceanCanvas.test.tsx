/**
 * BlueOceanCanvas — component tests
 *
 * Validates:
 *   1. Fallback renders when factors are missing
 *   2. Fallback renders when company_curve has no values
 *   3. Chart and ERRC grid render with valid data
 */
import { render, screen } from "@testing-library/react";
import React from "react";

import { BlueOceanCanvas } from "../components/charts/BlueOceanCanvas";

// recharts uses ResizeObserver; mock it for jsdom with non-zero dimensions
// so ResponsiveContainer reports a real size and renders the SVG chart
global.ResizeObserver = class {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    this.callback(
      [{ contentRect: { width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0 } as DOMRectReadOnly, target, borderBoxSize: [], contentBoxSize: [], devicePixelContentBoxSize: [] }],
      this
    );
  }
  unobserve() {}
  disconnect() {}
};

const VALID_DATA = {
  factors: ["Price", "Quality", "Service", "Innovation"],
  company_curve: { Price: 4, Quality: 8, Service: 7, Innovation: 9 },
  competitor_curves: {
    "Competitor A": { Price: 7, Quality: 6, Service: 5, Innovation: 4 },
  },
  eliminate: ["Legacy support"],
  reduce: ["Price premium"],
  raise: ["Digital experience"],
  create: ["AI advisor"],
};

describe("BlueOceanCanvas", () => {
  it("shows insufficiency notice when factors array is empty", () => {
    render(<BlueOceanCanvas structuredData={{ factors: [], company_curve: {} }} />);
    expect(screen.getByText(/Blue Ocean Canvas — Insufficient Data/i)).toBeInTheDocument();
  });

  it("shows insufficiency notice when only one factor provided", () => {
    render(
      <BlueOceanCanvas
        structuredData={{ factors: ["Price"], company_curve: { Price: 5 } }}
      />
    );
    expect(screen.getByText(/Blue Ocean Canvas — Insufficient Data/i)).toBeInTheDocument();
  });

  it("shows insufficiency notice when company_curve has no values", () => {
    render(
      <BlueOceanCanvas
        structuredData={{ factors: ["Price", "Quality"], company_curve: {} }}
      />
    );
    expect(screen.getByText(/Blue Ocean Canvas — Insufficient Data/i)).toBeInTheDocument();
  });

  it("renders chart and ERRC grid with valid data", () => {
    const { container } = render(<BlueOceanCanvas structuredData={VALID_DATA} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText(/Eliminate/i)).toBeInTheDocument();
    expect(screen.getByText(/Create/i)).toBeInTheDocument();
    expect(screen.queryByText(/Insufficient Data/i)).not.toBeInTheDocument();
  });
});
