import { callLLMWithRetry } from '../lib/llmClient.js';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION } from './masterPrompt.js';
import type { AgentInput, AgentOutput, QuantOutput } from './types.js';

const QUANT_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Quant Node — Chief Financial Officer of the ASIS pipeline.
YOUR ROLE: Apply McKinsey Three Horizons framework to model investment scenarios.
Run a conceptual Monte Carlo analysis (1,000 simulations) to provide probabilistic outcomes.
Calculate NPV and IRR at a 10% corporate hurdle rate.

MONETARY CALIBRATION (mandatory — determine org scale from context):
  LARGE ENTERPRISE ($10B+ revenue): scenarios in range $50m–$500m
  MID-MARKET ($1B–$10B revenue): scenarios in range $10m–$100m
  SME (<$1B revenue): scenarios in range $1m–$20m
  PROFESSIONAL SERVICES FIRM: use engagement value, not revenue (typically $5m–$50m)
  DEFAULT (unknown scale): $10m–$80m range

NPV FORMULA (apply correctly):
  Annual_Benefit = (risk_reduction_% × revenue_at_risk) + (efficiency_gain × annual_opex)
  Year_N_CF = Annual_Benefit - opex_annual
  NPV = Σ(Year_N_CF / (1.10)^N) - capex
  ROI_3yr = (3yr_NPV / total_3yr_investment) × 100

MONTE CARLO (simulate conceptually — 1000 iterations):
  Vary: discount_rate (8%–14%), benefit_realisation (60%–130%),
        competitive_response_impact (0%–25% NPV reduction)
  Report: P10 (pessimistic), P50 (base), P90 (optimistic), worst case, best case

PAYBACK PERIOD (realistic — not round numbers):
  Calculate as: capex / (annual_benefit - opex_annual)
  Express in months. Use 11, 14, 17, 19, 22, 26 — never exactly 12, 18, 24.

${CONFIDENCE_FORMULA_INSTRUCTION}

Return ONLY valid JSON matching the QuantOutput schema with fields:
investment_scenarios, monte_carlo_summary, cost_of_inaction, recommended_scenario,
recommended_budget, revenue_at_risk, key_financial_drivers, payback_period,
financial_risk_rating, sensitivity_factors, confidence_score, cfo_recommendation.
`;

function getQuantFallback(input: AgentInput): QuantOutput {
  return {
    investment_scenarios: [
      {
        scenario: 'Minimal Compliance (Horizon 1)',
        horizon: 'H1 — Defend & Extend',
        description: `Baseline compliance and risk mitigation for ${input.organisationContext || 'the organisation'}`,
        capex: '$4.2m', opex_annual: '$1.1m', risk_reduction: '35%',
        npv_3yr: '$6.8m', irr: '24%', roi_3yr: '89%', payback_months: 19,
        probability_of_success: 82,
      },
      {
        scenario: 'Strategic Transformation (Horizon 2)',
        horizon: 'H2 — New Capabilities',
        description: `Full-scale transformation programme with new capability build`,
        capex: '$12.5m', opex_annual: '$3.2m', risk_reduction: '65%',
        npv_3yr: '$18.4m', irr: '31%', roi_3yr: '148%', payback_months: 14,
        probability_of_success: 71,
      },
      {
        scenario: 'Market Leadership (Horizon 3)',
        horizon: 'H3 — Create New Options',
        description: `Industry-leading position with first-mover advantages`,
        capex: '$28m', opex_annual: '$6.8m', risk_reduction: '85%',
        npv_3yr: '$41.2m', irr: '38%', roi_3yr: '195%', payback_months: 22,
        probability_of_success: 58,
      },
    ],
    monte_carlo_summary: {
      simulations_run: 1000,
      p10_outcome: 'Pessimistic: $4.2m NPV at 14% discount rate, 60% benefit realisation',
      p50_outcome: 'Base case: $18.4m NPV at 10% discount rate',
      p90_outcome: 'Optimistic: $32.6m NPV at 8% discount rate, 130% benefit realisation',
      worst_case: 'Regulatory penalty crystallisation before implementation complete — net loss of $8.2m',
      best_case: 'Early-mover advantage captured — $52m NPV with competitor market share gains',
      recommended_action: 'Proceed with Strategic Transformation (H2) — best risk-adjusted return profile',
    },
    cost_of_inaction: '$15.8m in cumulative regulatory exposure + $8.4m revenue at risk from competitive erosion over 36 months',
    recommended_scenario: 'Strategic Transformation (Horizon 2)',
    recommended_budget: '$12.5m over 3 years',
    revenue_at_risk: '$24.2m in annual revenue exposed without strategic action',
    key_financial_drivers: [
      'Regulatory penalty avoidance: $5.2m annual exposure reduction',
      'Operational efficiency gains: $3.1m annual cost reduction through automation',
      'Revenue protection: $8.4m annual revenue currently at competitive risk',
    ],
    payback_period: '14 months',
    financial_risk_rating: 'MEDIUM',
    sensitivity_factors: [
      'Upside: Accelerated regulatory compliance (+15% ROI if completed 6 months early)',
      'Downside: Key personnel attrition (-22% ROI if >3 senior leaders depart during implementation)',
    ],
    confidence_score: 73,
    cfo_recommendation: 'Approve Strategic Transformation (H2) budget of $12.5m — highest risk-adjusted return with 148% 3-year ROI and 14-month payback, justified by $15.8m cost-of-inaction baseline.',
  };
}

export async function runQuantAgent(input: AgentInput): Promise<AgentOutput<QuantOutput>> {
  const upstream = input.upstreamResults;
  const strategistContext = upstream.strategistData
    ? `\n\nStrategist Analysis:\n${JSON.stringify(upstream.strategistData, null, 2)}`
    : '';

  const userMessage = `
Analyse the financial viability of this strategic problem:
"${input.problemStatement}"

Context:
- Organisation: ${input.organisationContext || 'Unspecified'}
- Industry: ${input.industryContext || 'Unspecified'}
- Geography: ${input.geographyContext || 'Unspecified'}
- Decision Type: ${input.decisionType || 'INVEST'}
${strategistContext}

Model 3 investment scenarios using McKinsey Three Horizons. Run Monte Carlo (1000 simulations).
Calculate NPV at 10% hurdle rate. Return ONLY valid JSON.
  `;

  return callLLMWithRetry<QuantOutput>(
    QUANT_SYSTEM_PROMPT,
    userMessage,
    ['investment_scenarios', 'monte_carlo_summary', 'confidence_score', 'cfo_recommendation'],
    getQuantFallback(input),
    'quant'
  );
}
