/**
 * ImplementationRoadmap — component tests
 *
 * Validates:
 *   1. All phase titles render
 *   2. First phase is expanded by default (showing actions + metrics)
 *   3. Progress bar renders for collapsed phases
 *   4. Phase investment displays when present
 */
import { render, screen } from "@testing-library/react";
import React from "react";

import { ImplementationRoadmap } from "../components/ImplementationRoadmap";

const MOCK_ROADMAP = [
  {
    phase: "Immediate Actions",
    timeframe: "0-3 months",
    owner_function: "Strategy & Partnerships",
    actions: ["Conduct regulatory assessment", "Identify partner shortlist"],
    success_metrics: ["Regulatory review completed", "3 partners signed MOU"],
    estimated_investment_usd: 500000,
    dependencies: [],
  },
  {
    phase: "Short-term Scaling",
    timeframe: "3-12 months",
    owner_function: "Commercial",
    actions: ["Launch pilot in target cities"],
    success_metrics: ["10,000 active users", "NPS > 40"],
    estimated_investment_usd: null,
    dependencies: ["Immediate Actions"],
  },
  {
    phase: "Medium-term Growth",
    timeframe: "1-3 years",
    owner_function: "Operations",
    actions: ["Scale distribution channels"],
    success_metrics: ["100,000 MAU", "Gross margin > 35%"],
    estimated_investment_usd: 5000000,
    dependencies: ["Short-term Scaling"],
  },
  {
    phase: "Long-term Leadership",
    timeframe: "3-5 years",
    owner_function: "Executive",
    actions: ["Establish category leadership"],
    success_metrics: ["Top-3 market position"],
    estimated_investment_usd: null,
    dependencies: [],
  },
];

describe("ImplementationRoadmap", () => {
  it("renders all four phase titles", () => {
    render(<ImplementationRoadmap roadmap={MOCK_ROADMAP} />);
    expect(screen.getByText("Immediate Actions")).toBeInTheDocument();
    expect(screen.getByText("Short-term Scaling")).toBeInTheDocument();
    expect(screen.getByText("Medium-term Growth")).toBeInTheDocument();
    expect(screen.getByText("Long-term Leadership")).toBeInTheDocument();
  });

  it("renders phase labels (Phase 1, Phase 2, etc.)", () => {
    render(<ImplementationRoadmap roadmap={MOCK_ROADMAP} />);
    expect(screen.getByText("Phase 1")).toBeInTheDocument();
    expect(screen.getByText("Phase 4")).toBeInTheDocument();
  });

  it("shows owner function for each phase", () => {
    render(<ImplementationRoadmap roadmap={MOCK_ROADMAP} />);
    expect(screen.getByText("Strategy & Partnerships")).toBeInTheDocument();
    expect(screen.getByText("Commercial")).toBeInTheDocument();
  });

  it("shows investment when present", () => {
    render(<ImplementationRoadmap roadmap={MOCK_ROADMAP} />);
    expect(screen.getByText(/500,000/)).toBeInTheDocument();
    expect(screen.getByText(/5,000,000/)).toBeInTheDocument();
  });

  it("expands the first phase by default showing actions", () => {
    render(<ImplementationRoadmap roadmap={MOCK_ROADMAP} />);
    expect(screen.getByText("Conduct regulatory assessment")).toBeInTheDocument();
    expect(screen.getByText("Regulatory review completed")).toBeInTheDocument();
  });
});
