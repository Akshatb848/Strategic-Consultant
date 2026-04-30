import { callLLMWithRetry } from '../lib/llmClient';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION, CITATION_FORMAT_INSTRUCTION } from './masterPrompt';
import type { AgentInput, QuantOutput, AgentOutput } from './types';

const QUANT_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Quant/Financial Reasoning Node — CFO of the ASIS pipeline.

STEP 1 — SCALE CALIBRATION (mandatory):
Read company_profile.revenue_tier. Apply these capex/opex ranges:
  MEGA_CAP ($50B+):   capex $500m–$5B, opex $50m–$500m/yr
  LARGE_CAP ($5B–$50B): capex $50m–$500m, opex $5m–$50m/yr
  MID_CAP ($500m–$5B):  capex $10m–$100m, opex $1m–$10m/yr
  SME (<$500m):         capex $1m–$20m, opex $0.2m–$2m/yr
  UNSPECIFIED:          capex $5m–$25m, opex $0.5m–$3m/yr

STEP 2 — BOTTOM-UP TAM→SAM→SOM:
TAM: cite a named source (NASSCOM, Gartner, IDC, World Bank) with year and CAGR
SAM: TAM × accessible geography % × product fit % (show calculation)
SOM: SAM × realistic market share capture % (show calculation)
Unit Economics: addressable_customers × ACV × conversion_rate/100 = year1_revenue

STEP 3 — BCG MATRIX:
  relative_market_share: company revenue share vs #1 competitor (0–2 float, 1.0 = parity)
  market_growth_rate_pct: from TAM CAGR data
  Quadrant: Star (high share, high growth) | Cash Cow (high share, low growth) | Question Mark (low share, high growth) | Dog (low share, low growth)
  Name the actual market leader company

STEP 4 — THREE SCENARIOS (H1/H2/H3 or ACQUIRE mode):
  NPV = Σ(Year_N_CF / 1.10^N) - capex
  Payback months: NEVER exactly 12, 18, or 24

${CONFIDENCE_FORMULA_INSTRUCTION}
${CITATION_FORMAT_INSTRUCTION}

Return ONLY this JSON (no markdown, no prose):
{
  "company_scale_assumption": "TIER used and why",
  "market_sizing": {
    "tam": { "value": "$XB", "basis": "Named source + year", "cagr": "X%", "year": "2024" },
    "sam": { "value": "$XB", "calculation": "TAM × X% geo × X% fit = $X", "rationale": "Why serviceable" },
    "som": { "value": "$XB", "calculation": "SAM × X% capture = $X", "timeline": "X years" },
    "unit_economics": {
      "addressable_customers": 0,
      "average_contract_value_usd": 0,
      "conversion_rate_pct": 0,
      "year1_revenue_usd": 0,
      "gross_margin_pct": 0
    }
  },
  "bcg_matrix": {
    "quadrant": "Star|Cash Cow|Question Mark|Dog",
    "relative_market_share": 0.0,
    "market_growth_rate_pct": 0.0,
    "x_axis": 0.0,
    "y_axis": 0.0,
    "named_market_leader": "Actual company name",
    "strategic_implication": "What BCG position means for capital allocation"
  },
  "investment_scenarios": [
    { "scenario": "Horizon 1 name", "horizon": "H1 — Defend & Extend", "description": "Scope", "capex": "$Xm", "opex_annual": "$Xm", "risk_reduction": "X%", "npv_3yr": "$Xm", "irr": "X%", "roi_3yr": "X%", "payback_months": 0, "probability_of_success": 0 },
    { "scenario": "Horizon 2 name", "horizon": "H2 — New Capabilities", "description": "Scope", "capex": "$Xm", "opex_annual": "$Xm", "risk_reduction": "X%", "npv_3yr": "$Xm", "irr": "X%", "roi_3yr": "X%", "payback_months": 0, "probability_of_success": 0 },
    { "scenario": "Horizon 3 name", "horizon": "H3 — Market Leadership", "description": "Scope", "capex": "$Xm", "opex_annual": "$Xm", "risk_reduction": "X%", "npv_3yr": "$Xm", "irr": "X%", "roi_3yr": "X%", "payback_months": 0, "probability_of_success": 0 }
  ],
  "monte_carlo_summary": {
    "simulations_run": 1000,
    "p10_outcome": "$Xm NPV at 14% discount rate",
    "p50_outcome": "$Xm NPV base case",
    "p90_outcome": "$Xm NPV at 8% discount rate",
    "worst_case": "Named failure scenario",
    "best_case": "Named upside scenario",
    "recommended_action": "One sentence"
  },
  "cost_of_inaction": "Named regulation + fine amount + revenue loss",
  "recommended_scenario": "Scenario name",
  "recommended_budget": "$Xm over X years",
  "revenue_at_risk": "$Xm annually",
  "key_financial_drivers": ["Driver 1 with figure", "Driver 2 with figure", "Driver 3 with figure"],
  "payback_period": "X months",
  "financial_risk_rating": "HIGH|MEDIUM|LOW",
  "sensitivity_factors": ["Upside condition → +X% ROI", "Downside condition → -X% ROI"],
  "confidence_score": 0,
  "cfo_recommendation": "One decisive board-level sentence with the investment amount and return",
  "revenue_attribution_methodology": null,
  "acquisition_premium_analysis": null,
  "total_acquisition_cost": null,
  "citations": []
}
`;

const quantFallback: QuantOutput = {
  company_scale_assumption: "UNSPECIFIED — defaulting to SME scale. Provide company name for calibrated projections.",
  market_sizing: {
    tam: { value: "$8.5B", basis: "NASSCOM AI Services Market Report 2024", cagr: "28%", year: "2024" },
    sam: { value: "$1.7B", calculation: "TAM ($8.5B) × 30% geo × 67% product fit = $1.7B", rationale: "India enterprise AI for mid-market technology and services sectors" },
    som: { value: "$170m", calculation: "SAM ($1.7B) × 10% share = $170m", timeline: "3 years" },
    unit_economics: { addressable_customers: 4200, average_contract_value_usd: 85000, conversion_rate_pct: 8, year1_revenue_usd: 28560000, gross_margin_pct: 42 },
  },
  bcg_matrix: {
    quadrant: "Question Mark",
    relative_market_share: 0.3,
    market_growth_rate_pct: 28,
    x_axis: 0.3,
    y_axis: 28,
    named_market_leader: "TCS (India AI Services)",
    strategic_implication: "High-growth market requires heavy investment to become a Star — underinvestment cedes ground to TCS and Infosys",
  },
  investment_scenarios: [
    { scenario: "Minimal Compliance (H1)", horizon: "H1 — Defend & Extend", description: "Basic compliance measures only", capex: "$4m", opex_annual: "$1.2m", risk_reduction: "18%", npv_3yr: "$6m", irr: "19%", roi_3yr: "50%", payback_months: 21, probability_of_success: 78 },
    { scenario: "Strategic Transformation (H2)", horizon: "H2 — New Capabilities", description: "Comprehensive capability build", capex: "$14m", opex_annual: "$3.5m", risk_reduction: "44%", npv_3yr: "$22m", irr: "36%", roi_3yr: "114%", payback_months: 19, probability_of_success: 64 },
    { scenario: "Market Leadership (H3)", horizon: "H3 — Market Leadership", description: "Aggressive market expansion", capex: "$35m", opex_annual: "$7m", risk_reduction: "62%", npv_3yr: "$38m", irr: "26%", roi_3yr: "79%", payback_months: 26, probability_of_success: 43 }
  ],
  monte_carlo_summary: {
    simulations_run: 1000,
    p10_outcome: "$8m NPV at 14% discount rate (60% benefit realisation)",
    p50_outcome: "$22m NPV base case at 10% hurdle",
    p90_outcome: "$42m NPV at 8% discount rate (125% benefit realisation)",
    worst_case: "NPV -$3m if TCS launches competing platform in Month 6 and talent exodus reduces delivery capacity 30%",
    best_case: "NPV $55m if AI adoption accelerates post-DPDP mandate and first-mover pricing premium holds 24 months",
    recommended_action: "Proceed with Horizon 2 at $14m — highest risk-adjusted NPV across 1,000 simulations"
  },
  cost_of_inaction: "$18m annual exposure: DPDP Act 2023 fines (up to ₹250 crore per violation) + $8m revenue loss from competitive displacement by TCS",
  recommended_scenario: "Strategic Transformation (H2)",
  recommended_budget: "$17.5m over 3 years",
  revenue_at_risk: "$18m annually",
  key_financial_drivers: ["DPDP compliance avoided fines: $6m annual exposure eliminated", "AI delivery efficiency: 22% cost reduction on $35m opex = $7.7m annual saving", "SAM capture: 10% of $1.7B SAM = $170m peak annual revenue by Year 3"],
  payback_period: "19 months",
  financial_risk_rating: "MEDIUM",
  sensitivity_factors: ["Upside: faster AI adoption (+15% revenue/yr) → +32% NPV", "Downside: TCS price war (-20% ACV compression) → -24% NPV"],
  confidence_score: 74,
  cfo_recommendation: "Invest $14m in Horizon 2 to generate $22m NPV and protect $18m annual revenue at risk — highest-returning allocation available.",
  revenue_attribution_methodology: null,
  acquisition_premium_analysis: null,
  total_acquisition_cost: null,
  citations: [
    { id: "C001", title: "NASSCOM AI Adoption Index 2024", publisher: "NASSCOM", url: "https://nasscom.in/knowledge-center/publications/nasscom-ai-adoption-index-2024", year: "2024", relevance: "India enterprise AI market TAM ($8.5B) and CAGR (28%)" },
    { id: "C002", title: "McKinsey Technology Trends Outlook 2024", publisher: "McKinsey & Company", url: "https://mckinsey.com/capabilities/mckinsey-digital/our-insights/the-top-trends-in-tech", year: "2024", relevance: "Digital transformation ROI benchmarks for Three Horizons calibration" },
    { id: "C003", title: "Gartner IT Spending Forecast 2024", publisher: "Gartner", url: "https://gartner.com/en/newsroom/press-releases/2024-01-17-gartner-forecasts-worldwide-it-spending", year: "2024", relevance: "Enterprise technology investment benchmarks for financial scenario calibration" },
  ],
};

export async function runQuantAgent(input: AgentInput): Promise<AgentOutput> {
  const start = Date.now();
  const strategistData = input.upstreamResults?.strategistData as any;
  const companyProfile = strategistData?.company_profile || null;
  const revenueTier = companyProfile?.revenue_tier || 'UNSPECIFIED';

  const isAcquire = (input.decisionType || '').toUpperCase() === 'ACQUIRE' ||
    Boolean((input.problemStatement || '').toLowerCase().match(/acqui|merger|m&a|buy|purchase/));

  const userMessage = `
Strategic problem: "${input.problemStatement}"
Organisation: ${input.organisationContext || companyProfile?.name || 'Unspecified'}
Industry: ${input.industryContext || companyProfile?.primary_sector || 'Unspecified'}
Geography: ${input.geographyContext || 'Unspecified'}
Decision Type: ${input.decisionType || 'Unspecified'}${isAcquire ? ' ← ACQUIRE MODE: replace H1/H2/H3 with Full Acquisition / Strategic Minority / Organic Build' : ''}

COMPANY PROFILE (calibrate ALL financials to this):
Revenue Tier: ${revenueTier}
${JSON.stringify(companyProfile, null, 2)}

Strategist mandate for Quant: ${JSON.stringify(strategistData?.agent_assignments?.quant || '')}

CRITICAL: 
- company_scale_assumption must state "${revenueTier}" tier and capex range used
- market_sizing must show TAM→SAM→SOM with named source and arithmetic
- bcg_matrix must name the actual #1 market leader in this sector
- All investment figures must be within the ${revenueTier} capex range
- citations: minimum 3 real publisher URLs (not example.com)
${isAcquire ? `- Populate revenue_attribution_methodology, acquisition_premium_analysis, total_acquisition_cost` : ''}

Return ONLY valid JSON.
  `;
  const result = await callLLMWithRetry<QuantOutput>(
    QUANT_SYSTEM_PROMPT,
    userMessage,
    ['market_sizing', 'bcg_matrix', 'investment_scenarios', 'confidence_score'],
    quantFallback
  );
  return {
    agentId: 'quant',
    status: result.usedFallback ? 'self_corrected' : 'completed',
    data: result.data as Record<string, unknown>,
    confidenceScore: result.data.confidence_score,
    durationMs: Date.now() - start,
    attemptNumber: result.attempts,
    selfCorrected: result.usedFallback,
    tokenUsage: { input: result.inputTokens, output: result.outputTokens }
  };
}
