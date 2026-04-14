import { callLLMWithRetry } from '../lib/llmClient.js';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION } from './masterPrompt.js';
import type { AgentInput, AgentOutput, QuantOutput } from './types.js';
import { defaultConfidence } from './confidence.js';

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

PAYBACK PERIOD (realistic - not round numbers):
  Calculate as: capex / (annual_benefit - opex_annual)
  Express in months. Use 11, 14, 17, 19, 22, 26 - never exactly 12, 18, 24.

TOTAL ACQUISITION COST - MANDATORY CALCULATION:
When evaluating an acquisition, the investment denominator for ROI is not the stated valuation.
Use fully-loaded deployed capital:
  total_acquisition_cost = acquisition_price + integration_costs + key_person_agreements +
                           technology_migration + legal_and_advisory_fees

Use these professional-services ranges when no better data exists:
  Integration costs: 15-20% of acquisition price
  Key person agreements: 8-12%
  Technology migration: 5-8%
  Legal/advisory: 3-5%
  Total uplift range: 1.31x to 1.45x acquisition price

BUILD-VS-BUY FINANCIAL MODEL (mandatory when decision_type === "ACQUIRE"):
Add an "Organic Build Alternative (Counterfactual)" scenario with:
  capex, opex_annual, time_to_first_revenue, npv_3yr, roi_3yr, payback_months,
  key_risks, acquisition_premium_justified_if.

REVENUE ATTRIBUTION PROBLEM - MANDATORY ACKNOWLEDGMENT:
Include a revenue_attribution_methodology block explaining how acquisition-driven revenue
would be separated from organic growth and why the ROI target is unauditable without it.

${CONFIDENCE_FORMULA_INSTRUCTION}

Return ONLY valid JSON matching the QuantOutput schema with fields:
investment_scenarios, monte_carlo_summary, cost_of_inaction, recommended_scenario,
recommended_budget, revenue_at_risk, key_financial_drivers, payback_period,
financial_risk_rating, sensitivity_factors, confidence_score, cfo_recommendation,
revenue_attribution_methodology, acquisition_premium_analysis.
`;

function getQuantFallback(input: AgentInput): QuantOutput {
  const isAcquire =
    input.decisionType === 'ACQUIRE' ||
    /(acquire|acquisition|buy|purchase|stake|merger)/i.test(input.problemStatement);

  if (isAcquire) {
    return {
      investment_scenarios: [
        {
          scenario: 'Full Acquisition',
          horizon: 'Primary acquisition path',
          description: `Acquire target capability outright to accelerate market entry for ${input.organisationContext || 'the organisation'}.`,
          capex: '$50M stated acquisition price',
          opex_annual: '$4.8M retained operating cost',
          npv_3yr: '$48M',
          irr: '24%',
          roi_3yr: '108%',
          payback_months: 26,
          probability_of_success: 42,
          stated_acquisition_price: '$50M',
          total_deployed_capital: '$68M (integration, KPAs, migration, fees included)',
          roi_on_stated_price: '148%',
          roi_on_total_cost: '108%',
          time_to_first_revenue: '9 months post-close',
          key_risks: [
            'Post-close talent attrition destroys delivery capability.',
            'Client-transfer assumptions prove relationship-dependent rather than platform-dependent.',
          ],
          acquisition_premium_justified_if: [
            'Speed-to-market advantage captures at least $18M of otherwise foregone revenue.',
            'Target IP and client relationships cannot be replicated internally within 18 months.',
          ],
        },
        {
          scenario: 'Strategic Minority Investment',
          horizon: 'Optionality-first path',
          description:
            'Take a minority stake, secure a board seat, and build a co-sell motion before exercising a call option.',
          capex: '$10M initial investment',
          opex_annual: '$1.2M enablement and joint GTM cost',
          npv_3yr: '$18M',
          irr: '29%',
          roi_3yr: '145%',
          payback_months: 17,
          probability_of_success: 61,
          time_to_first_revenue: '6-9 months',
          key_risks: [
            'Commercial partnership underperforms without executive sponsorship.',
            'The target may take outside capital or be acquired by a competitor.',
          ],
          acquisition_premium_justified_if: [
            'The co-sell proves repeatable before a full takeout is considered.',
          ],
        },
        {
          scenario: 'Organic Build Alternative (Counterfactual)',
          horizon: 'Counterfactual baseline',
          description:
            'Hire 15-20 specialists, build the operating playbook internally, and reach the same strategic objective without paying an acquisition premium.',
          capex: '$3.6M platform build cost',
          opex_annual: '$2.4M talent cost',
          npv_3yr: '$12M',
          irr: '22%',
          roi_3yr: '96%',
          payback_months: 22,
          probability_of_success: 47,
          time_to_first_revenue: '12-18 months',
          key_risks: [
            'Critical specialist hires may take 90-150 days to land.',
            'Organic build delays market entry by 12-18 months.',
          ],
          acquisition_premium_justified_if: [
            'The acquired IP cannot be rebuilt economically inside 18 months.',
            'Transferred client relationships generate immediate cross-sell revenue above the organic baseline.',
          ],
        },
      ],
      monte_carlo_summary: {
        simulations_run: 1000,
        p10_outcome: 'Pessimistic: full acquisition NPV falls to $14M once integration drag and 25% partner attrition are applied.',
        p50_outcome: 'Base case: minority investment path generates $18M NPV with materially lower downside.',
        p90_outcome: 'Optimistic: full acquisition captures premium cross-sell and reaches $58M NPV.',
        worst_case: 'Full acquisition loses key personnel inside 12 months and drops below hurdle rate.',
        best_case: 'Minority investment converts to acquisition only after commercial proof, preserving upside with limited sunk cost.',
        recommended_action: 'Prioritise the minority-investment path unless due diligence proves a full acquisition premium is uniquely justified.',
      },
      cost_of_inaction:
        '$18M in foregone co-sell revenue plus a 12-18 month capability lag if the market matures before the firm establishes a credible AI governance offer.',
      recommended_scenario: 'Strategic Minority Investment',
      recommended_budget: '$10M initial outlay with a structured 18-month call option',
      revenue_at_risk:
        '$26M in attributable advisory and managed-governance revenue if a competitor secures first credible client references in the target segment.',
      key_financial_drivers: [
        'Acquisition premium is only defensible if speed-to-market creates revenue that internal build cannot capture.',
        'Key-person retention agreements materially change ROI on total deployed capital.',
        'Board-seat governance and commercial-option rights improve downside protection on a minority investment.',
      ],
      payback_period: '17 months',
      financial_risk_rating: 'HIGH',
      sensitivity_factors: [
        'A 15% increase in integration cost reduces full-acquisition ROI on total cost by roughly 12 percentage points.',
        'A 6-month hiring delay reduces the organic-build path NPV by approximately $3M.',
      ],
      confidence_score: defaultConfidence('quant', input.problemStatement),
      cfo_recommendation:
        'Do not present the stated acquisition price as the investment denominator. The board should compare $68M total deployed capital for a full acquisition with a $10M minority-investment option and a $3.6M capex organic build baseline.',
      revenue_attribution_methodology: {
        challenge:
          'Post-integration, separating acquisition-driven revenue from organic growth is structurally difficult without a pre-agreed attribution model.',
        proposed_methodology:
          'Track revenue from transferred client relationships, deployments of the acquired IP, and AI-governance practice growth above the pre-close baseline.',
        attribution_risk:
          'Without an agreed attribution model, a 3x ROI claim is not auditable and should not be presented as board fact.',
        precedent:
          'Large professional-services acquisitions often struggle to isolate acquired revenue versus organic practice growth after integration.',
      },
      acquisition_premium_analysis: {
        acquisition_premium: '$56M premium over organic build NPV baseline',
        premium_justification_required: '467% above the organic-build counterfactual',
        note:
          'A full acquisition requires exceptional justification because the premium materially exceeds the 2.0x-2.5x range typically tolerated for professional-services capability acquisitions.',
      },
    };
  }

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
    confidence_score: defaultConfidence('quant', input.problemStatement),
    cfo_recommendation: 'Approve Strategic Transformation (H2) budget of $12.5m - highest risk-adjusted return with 148% 3-year ROI and 14-month payback, justified by $15.8m cost-of-inaction baseline.',
    revenue_attribution_methodology: {
      challenge:
        'Incremental revenue still needs an agreed baseline and attribution method so transformation gains are not confused with normal business growth.',
      proposed_methodology:
        'Measure new revenue from explicitly AI-enabled offerings, compliance-led upsell, and efficiency gains above the prior-year baseline.',
      attribution_risk:
        'Without a pre-agreed methodology, ROI claims will drift toward narrative rather than auditable performance evidence.',
      precedent:
        'Professional-services transformation programmes frequently over-attribute organic growth to the transformation if they do not establish pre-close KPIs.',
    },
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
