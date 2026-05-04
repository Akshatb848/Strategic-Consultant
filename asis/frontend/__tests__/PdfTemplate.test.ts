import { buildPdfHtml } from "@/lib/pdf/template";
import type { StrategicBriefV4 } from "@/lib/api";

function testBrief(): StrategicBriefV4 {
  const citation = {
    title: "Technology Trends Outlook",
    source: "McKinsey & Company",
    url: "https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/the-top-trends-in-tech",
    published_at: "2026-01-01",
    excerpt: "AI and data ecosystems require measurable adoption and governance.",
  };
  const frameworkOutput = (name: string, structured_data: Record<string, unknown>) => ({
    framework_name: name,
    agent_author: "synthesis",
    structured_data,
    narrative: `${name} provides a decision-specific finding for the Bain AI platform strategy.`,
    citations: [citation, citation, citation, citation, citation],
    confidence_score: 0.76,
    exhibit_number: 1,
    exhibit_title: "The framework identifies where proprietary AI platforms can create defensible advantage.",
    implication: "The report must show the strategic implication rather than a generic framework label.",
    recommended_action: "Fund the platform through gated investment tranches.",
    risk_of_inaction: "Competitors can copy generic AI tooling without a proprietary data moat.",
  });

  return {
    decision_statement: "CONDITIONAL PROCEED - invest through gated AI platform tranches.",
    decision_confidence: 0.74,
    decision_rationale: "The investment is attractive only if data rights, adoption, and margin uplift are proven.",
    decision_evidence: ["Named competitors require a differentiated proprietary data layer."],
    framework_outputs: {
      pestle: frameworkOutput("pestle", {
        political: { score: 7, factors: ["EU AI Act"], implication: "Governance matters." },
        economic: { score: 7, factors: ["AI services demand"], implication: "Demand is material." },
        social: { score: 6, factors: ["Trust"], implication: "Trust matters." },
        technological: { score: 8, factors: ["AI workflow"], implication: "Platform depth matters." },
        legal: { score: 6, factors: ["Data rights"], implication: "Rights are gating." },
        environmental: { score: 5, factors: ["Data center footprint"], implication: "Efficiency matters." },
      }),
      swot: frameworkOutput("swot", { strengths: ["Premium advisory access"], weaknesses: ["Data moat incomplete"], opportunities: ["AI workflow IP"], threats: ["McKinsey and BCG response"] }),
      porters_five_forces: frameworkOutput("porters_five_forces", {
        competitive_rivalry: { score: 8, finding: "McKinsey & Company and Boston Consulting Group can respond quickly." },
        threat_of_new_entrants: { score: 5, finding: "Entry barriers depend on data rights." },
        threat_of_substitutes: { score: 5, finding: "Software vendors can substitute parts of delivery." },
        bargaining_power_buyers: { score: 7, finding: "Enterprise buyers demand proof." },
        bargaining_power_suppliers: { score: 4, finding: "Hyperscalers remain important." },
      }),
      ansoff: frameworkOutput("ansoff", { recommended_quadrant: "Product development" }),
      bcg_matrix: frameworkOutput("bcg_matrix", { business_units: [{ name: "AI-enabled M&A platform", quadrant: "Question mark", relative_market_share: 0.8, market_growth_rate: 18, recommended_action: "Fund through gates" }] }),
      mckinsey_7s: frameworkOutput("mckinsey_7s", {
        strategy: { score: 6, current_state: "Platform strategy exists but data rights remain incomplete.", desired_state: "Gated proprietary platform strategy.", gap: "Data moat proof is still required." },
        structure: { score: 6, current_state: "Separate teams own data and M&A delivery.", desired_state: "Integrated AI platform operating model.", gap: "Decision rights must be clarified." },
        systems: { score: 6, current_state: "Reusable workflow systems are partial.", desired_state: "Measured adoption and margin systems.", gap: "Controls are not yet end-to-end." },
        staff: { score: 6, current_state: "AI product talent is limited.", desired_state: "Dedicated AI product and governance bench.", gap: "Hiring and retention are gating." },
        style: { score: 6, current_state: "Partner-led model favors bespoke delivery.", desired_state: "Product-led repeatability with partner accountability.", gap: "Operating cadence must change." },
        skills: { score: 6, current_state: "Consulting skills are strong but platform skills are uneven.", desired_state: "AI workflow product skills at scale.", gap: "Product management depth is required." },
        shared_values: { score: 7, current_state: "Client impact values are strong.", desired_state: "Client impact plus reusable IP discipline.", gap: "Reusable IP must be culturally accepted." },
      }),
      blue_ocean: frameworkOutput("blue_ocean", { eliminate: ["Generic AI demos"], reduce: ["Bespoke manual delivery"], raise: ["Data rights"], create: ["Proprietary M&A workflow intelligence"] }),
      balanced_scorecard: frameworkOutput("balanced_scorecard", {}),
    },
    executive_summary: {
      headline: "CONDITIONAL PROCEED - invest through gated AI platform tranches.",
      key_argument_1: "The AI platform requires proprietary data rights.",
      key_argument_2: "Named competitors can copy generic tooling.",
      key_argument_3: "Financial returns require adoption and margin proof.",
      critical_risk: "The moat may not materialize.",
      next_step: "Validate lighthouse clients and data rights.",
    },
    section_action_titles: {},
    so_what_callouts: {},
    agent_collaboration_trace: [],
    exhibit_registry: [],
    implementation_roadmap: [],
    quality_report: { overall_grade: "B", checks: [], quality_flags: [], mece_score: 0.8, citation_density_score: 1, internal_consistency_score: 0.78, context_specificity_score: 0.9, financial_grounding_score: 0.8, execution_specificity_score: 0.8, retry_count: 0 },
    mece_score: 0.8,
    internal_consistency_score: 0.78,
    balanced_scorecard: { financial: { objectives: [], measures: [], targets: [], initiatives: [] }, customer: { objectives: [], measures: [], targets: [], initiatives: [] }, internal_process: { objectives: [], measures: [], targets: [], initiatives: [] }, learning_and_growth: { objectives: [], measures: [], targets: [], initiatives: [] } },
    report_metadata: { analysis_id: "test", company_name: "Bain & Company", query: "Should Bain invest in AI platforms?", generated_at: "2026-05-05T00:00:00Z", asis_version: "4.0.0", confidentiality_level: "STRICTLY CONFIDENTIAL", disclaimer: "Test" },
    board_narrative: "Board narrative",
    recommendation: "CONDITIONAL PROCEED",
    overall_confidence: 0.74,
    frameworks_applied: [],
    context: {},
    market_analysis: { market_sizing: { tam: "$10B", sam: "$2B", som: "$300M" } },
    financial_analysis: {
      bottom_up_revenue_model: {
        sector_build: [{ sector: "AI-enabled M&A platform", target_clients: 28, average_contract_value_usd_mn: 8, win_rate: 0.32, account_expansion_multiplier: 2.6, scale_multiplier: 1, year_3_revenue_usd_mn: 186.4, formula_basis: "target_clients x win_rate x ACV x expansion x scale", source_or_assumption: "Model assumption" }],
      },
      scenario_analysis: {
        scenarios: [{ name: "Base", revenue_year_3_usd_mn: 515.8, ebitda_margin_pct: 17.6, roi_multiple: 1.08, irr_pct: 14.9, payback_months: 27, investment_basis: "$625M midpoint", formula_basis: "ROI formula", source_or_assumption: "Model assumption", payback_basis: "stage-one tranche" }],
      },
    },
    risk_analysis: {},
    red_team: { invalidated_claims: [{ severity: "MAJOR", original_claim: "The moat is durable.", challenge: "Competitors can copy generic AI tooling.", required_evidence: "Data-rights proof." }] },
    verification: {},
    roadmap: [],
    citations: [citation],
    evidence_contract: { source_roles: [{ source: "McKinsey & Company", roles: ["competitor", "sector"], url: citation.url }], numeric_assumptions: [{ metric: "Base ROI", value: 1.08, formula: "ROI formula" }] },
    export_validation: { checks: [{ id: "scenario_duplicate_guard", description: "Scenario ladders must be prompt specific.", level: "BLOCK", passed: true, notes: null }] },
  };
}

describe("PDF template", () => {
  it("renders auditable framework, red-team, and financial evidence", () => {
    const html = buildPdfHtml({ brief: testBrief(), appendix: {}, theme: "mckinsey" });

    expect(html).toContain("Current state");
    expect(html).toContain("Platform strategy exists but data rights remain incomplete");
    expect(html).toContain("target_clients x win_rate x ACV x expansion x scale");
    expect(html).toContain("$625M midpoint");
    expect(html).toContain("0 fatal; 1 major");
    expect(html).toContain("Export validation and evidence contract");
  });
});
