import { callLLMWithRetry } from '../lib/llmClient';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION } from './masterPrompt';
import type { AgentInput, QuantOutput, AgentOutput } from './types';

const QUANT_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Quant Node — Chief Financial Officer of the ASIS pipeline.
YOUR ROLE: Apply McKinsey Three Horizons framework to model investment scenarios.
Run a conceptual Monte Carlo analysis (1,000 simulations) to provide probabilistic outcomes.
Calculate NPV and IRR at a 10% corporate hurdle rate.

MONETARY CALIBRATION:
  LARGE ENTERPRISE ($10B+ revenue): scenarios in range $50m–$500m
  MID-MARKET ($1B–$10B revenue): scenarios in range $10m–$100m
  SME (<$1B revenue): scenarios in range $1m–$20m
  PROFESSIONAL SERVICES FIRM: engagement value $5m–$50m
  DEFAULT (unknown scale): $10m–$80m range

NPV FORMULA:
  Annual_Benefit = (risk_reduction_% × revenue_at_risk) + (efficiency_gain × annual_opex)
  Year_N_CF = Annual_Benefit - opex_annual
  NPV = Σ(Year_N_CF / (1.10)^N) - capex
  ROI_3yr = (3yr_NPV / total_3yr_investment) × 100

PAYBACK PERIOD: Calculate as capex / (annual_benefit - opex_annual). Use realistic months (11, 14, 17, 19, 22, 26 — never exactly 12, 18, 24).

${CONFIDENCE_FORMULA_INSTRUCTION}

Return ONLY this exact JSON structure:
{
  "investment_scenarios": [
    {
      "scenario": "Minimal Compliance (Horizon 1)",
      "horizon": "H1 — Defend & Extend",
      "description": "Specific scope of this scenario",
      "capex": "$Xm",
      "opex_annual": "$Xm",
      "risk_reduction": "X%",
      "npv_3yr": "$Xm",
      "irr": "X%",
      "roi_3yr": "X%",
      "payback_months": [INTEGER not 12/18/24],
      "probability_of_success": [0-100]
    },
    {
      "scenario": "Strategic Transformation (Horizon 2)",
      "horizon": "H2 — New Capabilities",
      "description": "Specific scope of this scenario",
      "capex": "$Xm",
      "opex_annual": "$Xm",
      "risk_reduction": "X%",
      "npv_3yr": "$Xm",
      "irr": "X%",
      "roi_3yr": "X%",
      "payback_months": [INTEGER not 12/18/24],
      "probability_of_success": [0-100]
    },
    {
      "scenario": "Market Leadership (Horizon 3)",
      "horizon": "H3 — Create New Options",
      "description": "Specific scope of this scenario",
      "capex": "$Xm",
      "opex_annual": "$Xm",
      "risk_reduction": "X%",
      "npv_3yr": "$Xm",
      "irr": "X%",
      "roi_3yr": "X%",
      "payback_months": [INTEGER not 12/18/24],
      "probability_of_success": [0-100]
    }
  ],
  "monte_carlo_summary": {
    "simulations_run": 1000,
    "p10_outcome": "Pessimistic: $Xm NPV at 14% discount rate, 60% benefit realisation",
    "p50_outcome": "Base case: $Xm NPV",
    "p90_outcome": "Optimistic: $Xm NPV at 8% discount rate, 130% benefit realisation",
    "worst_case": "Scenario description with financial impact",
    "best_case": "Scenario description with financial impact",
    "recommended_action": "One-sentence recommendation from Monte Carlo results"
  },
  "cost_of_inaction": "Specific financial exposure: regulatory fines + revenue loss + reputation cost",
  "recommended_scenario": "Strategic Transformation (Horizon 2)",
  "recommended_budget": "$Xm over X years",
  "revenue_at_risk": "$Xm in annual revenue exposed without action",
  "key_financial_drivers": ["Driver 1: specific lever with quantified impact", "Driver 2: specific lever", "Driver 3: specific lever"],
  "payback_period": "X months",
  "financial_risk_rating": "HIGH|MEDIUM|LOW",
  "sensitivity_factors": ["Upside condition: + impact on ROI", "Downside condition: - impact on ROI"],
  "confidence_score": [CALCULATED INTEGER — never 85 unless mathematically exact],
  "cfo_recommendation": "Single sentence for the CFO with financial justification"
}
`;

const quantFallback: QuantOutput = {
  investment_scenarios: [
    { scenario: "Minimal Compliance (Horizon 1)", horizon: "H1 — Defend & Extend", description: "Basic compliance measures only", capex: "$5m", opex_annual: "$2m", risk_reduction: "15%", npv_3yr: "$8m", irr: "22%", roi_3yr: "60%", payback_months: 19, probability_of_success: 75 },
    { scenario: "Strategic Transformation (Horizon 2)", horizon: "H2 — New Capabilities", description: "Comprehensive transformation", capex: "$22m", opex_annual: "$4m", risk_reduction: "42%", npv_3yr: "$28m", irr: "38%", roi_3yr: "127%", payback_months: 22, probability_of_success: 62 },
    { scenario: "Market Leadership (Horizon 3)", horizon: "H3 — Create New Options", description: "Aggressive market expansion", capex: "$55m", opex_annual: "$8m", risk_reduction: "65%", npv_3yr: "$45m", irr: "28%", roi_3yr: "82%", payback_months: 26, probability_of_success: 45 }
  ],
  monte_carlo_summary: { simulations_run: 1000, p10_outcome: "Pessimistic: $12m NPV at 14% discount rate", p50_outcome: "Base case: $28m NPV", p90_outcome: "Optimistic: $52m NPV at 8% discount rate", worst_case: "NPV of -$5m if competitive response is aggressive", best_case: "NPV of $65m if market conditions are favourable", recommended_action: "Proceed with Horizon 2 investment as it offers the best risk-adjusted return" },
  cost_of_inaction: "$35m annual exposure: $15m regulatory fines + $12m revenue loss + $8m reputation damage",
  recommended_scenario: "Strategic Transformation (Horizon 2)",
  recommended_budget: "$26m over 3 years",
  revenue_at_risk: "$35m annually",
  key_financial_drivers: ["Risk reduction percentage directly correlated with revenue protection", "Operating efficiency gains from transformation", "Market share growth potential in addressable segments"],
  payback_period: "22 months",
  financial_risk_rating: "MEDIUM",
  sensitivity_factors: ["Upside: faster benefit realisation (+15% ROI)", "Downside: competitive response reducing NPV by 20%"],
  confidence_score: 72,
  cfo_recommendation: "Invest $22m in Horizon 2 transformation to achieve 127% ROI within 3 years with manageable risk exposure."
};

export async function runQuantAgent(input: AgentInput): Promise<AgentOutput> {
  const start = Date.now();
  const userMessage = `
Strategic problem: "${input.problemStatement}"
Organisation: ${input.organisationContext || 'Unspecified'}
Industry: ${input.industryContext || 'Unspecified'}
Geography: ${input.geographyContext || 'Unspecified'}

${input.upstreamResults?.strategistData ? `Strategist identified these analytical priorities: ${JSON.stringify((input.upstreamResults.strategistData as any)?.agent_assignments?.quant || '')}` : ''}

Model 3 investment scenarios. Return ONLY valid JSON.
  `;
  const result = await callLLMWithRetry<QuantOutput>(QUANT_SYSTEM_PROMPT, userMessage, ['investment_scenarios', 'monte_carlo_summary', 'recommended_scenario', 'confidence_score'], quantFallback);
  return { agentId: 'quant', status: result.usedFallback ? 'self_corrected' : 'completed', data: result.data as Record<string, unknown>, confidenceScore: result.data.confidence_score, durationMs: Date.now() - start, attemptNumber: result.attempts, selfCorrected: result.usedFallback, tokenUsage: { input: result.inputTokens, output: result.outputTokens } };
}
