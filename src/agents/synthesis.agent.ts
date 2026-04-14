import { callLLMWithRetry } from '../lib/llmClient.js';
import { MASTER_CONSULTANT_PERSONA } from './masterPrompt.js';
import type {
  AgentInput,
  AgentOutput,
  DecisionRecommendation,
  QuantOutput,
  RedTeamOutput,
  StrategicOption,
  SynthesisOutput,
} from './types.js';
import { countInvalidations } from './confidence.js';

const SYNTHESIS_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Synthesis Node - Managing Partner and report assembler of the ASIS pipeline.
YOUR ROLE: Integrate outputs from all upstream agents into a single board-ready recommendation.

THIS IS NOT A SUMMARY. IT IS AN INTEGRATION.
Do not repeat each agent output. Resolve tensions between them into a single board narrative.

CONFIDENCE - MANDATORY RULE:
The overall_confidence field must be read from the CoVe agent's calculated value passed in upstream context.
You do not calculate it. You do not estimate it. You do not default it.
If CoVe is unavailable due to system error, use 68 as a conservative fallback.
Never use 85 as a default.

INVALIDATION RESPONSE PROTOCOL:
1. Receive the Red Team invalidated_claims array.
2. For each FATAL invalidation:
   - downgrade PROCEED to HOLD if there is 1 fatal invalidation
   - downgrade PROCEED to ESCALATE if there are 2 or more fatal invalidations
   - downgrade HOLD to ESCALATE if any fatal invalidation exists
3. For each MAJOR invalidation:
   - include the risk-adjusted range in the recommendation and executive summary
4. For ACQUIRE decision types:
   - include a three_options array covering Full Acquisition, Strategic Minority Investment, and Organic Build
   - state clearly why the recommended option wins after evaluating organic build versus acquisition

BOARD NARRATIVE STANDARD:
- Name the organisation
- Name the decision
- Include a specific financial figure
- Create urgency
- Be decisive

Return ONLY valid JSON matching the SynthesisOutput schema with fields:
executive_summary, board_narrative, strategic_imperatives, roadmap, balanced_scorecard,
competitive_benchmarks, success_metrics, decision_recommendation, risk_adjusted_recommendation,
overall_confidence, frameworks_applied, dissertation_contribution, red_team_response,
three_options, build_vs_buy_verdict.
`;

function normalizeRecommendation(value: unknown): DecisionRecommendation {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'PROCEED' || normalized === 'HOLD' || normalized === 'ESCALATE' || normalized === 'REJECT') {
    return normalized;
  }
  return 'HOLD';
}

function parseMoneyToUsdMillions(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = raw.replace(/,/g, '');

  const dollarRange = value.match(/\$([\d.]+)\s*[-–]\s*\$?([\d.]+)\s*(m|mn|million|bn|billion)?/i);
  if (dollarRange) {
    const min = Number(dollarRange[1]);
    const max = Number(dollarRange[2]);
    const unit = (dollarRange[3] || 'm').toLowerCase();
    const multiplier = unit.startsWith('b') ? 1000 : 1;
    return ((min + max) / 2) * multiplier;
  }

  const rupeeCroreRange = value.match(/₹\s*([\d.]+)\s*[-–]\s*([\d.]+)\s*crore/i);
  if (rupeeCroreRange) {
    const min = Number(rupeeCroreRange[1]);
    const max = Number(rupeeCroreRange[2]);
    return ((min + max) / 2) * 0.12;
  }

  const money = value.match(/\$([\d.]+)\s*(m|mn|million|bn|billion)?/i);
  if (money) {
    const amount = Number(money[1]);
    const unit = (money[2] || 'm').toLowerCase();
    return amount * (unit.startsWith('b') ? 1000 : 1);
  }

  const rupeeCrore = value.match(/₹\s*([\d.]+)\s*crore/i);
  if (rupeeCrore) {
    return Number(rupeeCrore[1]) * 0.12;
  }

  return null;
}

function parsePercent(raw: string | number | undefined): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (!raw) return null;
  const match = String(raw).match(/-?[\d.]+/);
  return match ? Number(match[0]) : null;
}

function formatUsdMillions(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}B`;
  }
  return `$${value.toFixed(value >= 10 ? 0 : 1)}M`;
}

function formatProbability(raw: number | string | undefined): string {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const lower = Math.max(5, Math.round(raw - 5));
    const upper = Math.min(95, Math.round(raw + 5));
    return `${lower}-${upper}%`;
  }
  if (!raw) return '40-50%';
  return String(raw);
}

function getScenarioByName(quantData: QuantOutput | undefined, keywords: string[]): any | undefined {
  return quantData?.investment_scenarios?.find((scenario) =>
    keywords.some((keyword) => scenario.scenario.toLowerCase().includes(keyword.toLowerCase()))
  );
}

function buildStrategicOptions(
  quantData: QuantOutput | undefined,
  redTeamData: RedTeamOutput | undefined
): { options: StrategicOption[]; verdict: string } {
  const counts = countInvalidations(redTeamData?.invalidated_claims);

  const acquisition = getScenarioByName(quantData, ['full acquisition', 'acquisition']) || {
    scenario: 'Full Acquisition',
    total_deployed_capital: '$68M',
    npv_3yr: '$48M',
    payback_months: 26,
    probability_of_success: 42,
    description: 'Acquire target capability outright and integrate into the existing practice model.',
  };
  const minority = getScenarioByName(quantData, ['minority', 'investment']) || {
    scenario: 'Strategic Minority Investment',
    capex: '$10M initial investment',
    npv_3yr: '$18M',
    payback_months: 17,
    probability_of_success: 61,
    description: 'Take a minority stake, secure commercial rights, and preserve a later call option.',
  };
  const organic = getScenarioByName(quantData, ['organic build', 'counterfactual']) || {
    scenario: 'Organic Build Alternative (Counterfactual)',
    capex: '$3.6M platform build cost',
    npv_3yr: '$12M',
    payback_months: 22,
    probability_of_success: 47,
    description: 'Hire and build internally without paying an acquisition premium.',
  };

  const acquisitionBase = parseMoneyToUsdMillions(acquisition.npv_3yr) ?? 48;
  const minorityBase = parseMoneyToUsdMillions(minority.npv_3yr) ?? 18;
  const organicBase = parseMoneyToUsdMillions(organic.npv_3yr) ?? 12;

  const acquisitionRiskAdjusted = acquisitionBase * (counts.fatal > 0 ? 0.55 : counts.major >= 2 ? 0.68 : 0.8);
  const minorityRiskAdjusted = minorityBase * 0.88;
  const organicRiskAdjusted = organicBase * 0.82;

  const options: StrategicOption[] = [
    {
      option: 'A',
      label: 'Full Acquisition',
      description: acquisition.description || 'Acquire the target capability outright.',
      total_cost:
        acquisition.total_deployed_capital || acquisition.capex || acquisition.stated_acquisition_price || '$68M',
      timeline_to_value: acquisition.time_to_first_revenue || '18-24 months post-close',
      npv_3yr_base: formatUsdMillions(acquisitionBase),
      npv_3yr_risk_adjusted: formatUsdMillions(acquisitionRiskAdjusted),
      probability_of_achieving_roi_target: formatProbability(acquisition.probability_of_success),
      key_condition:
        acquisition.acquisition_premium_justified_if?.[0] ||
        'Key-person retention and client-transfer assumptions must hold pre-close.',
      recommended: false,
    },
    {
      option: 'B',
      label: 'Strategic Minority Investment',
      description:
        minority.description ||
        'Take a minority stake, secure governance rights, and preserve the option to acquire later.',
      total_cost: minority.total_deployed_capital || minority.capex || '$10M',
      timeline_to_value: minority.time_to_first_revenue || '6-12 months',
      npv_3yr_base: formatUsdMillions(minorityBase),
      npv_3yr_risk_adjusted: formatUsdMillions(minorityRiskAdjusted),
      probability_of_achieving_roi_target: formatProbability(minority.probability_of_success),
      key_condition:
        minority.acquisition_premium_justified_if?.[0] ||
        'Board seat, commercial rights, and a call option must be secured on day one.',
      recommended: false,
    },
    {
      option: 'C',
      label: 'Organic Build',
      description:
        organic.description ||
        'Build the capability internally through focused hiring and a staged product-and-service rollout.',
      total_cost: organic.total_deployed_capital || organic.capex || '₹30-50 crore over 3 years (~$3.6-6M)',
      timeline_to_value: organic.time_to_first_revenue || '12-18 months',
      npv_3yr_base: formatUsdMillions(organicBase),
      npv_3yr_risk_adjusted: formatUsdMillions(organicRiskAdjusted),
      probability_of_achieving_roi_target: formatProbability(organic.probability_of_success),
      key_condition:
        organic.acquisition_premium_justified_if?.[0] ||
        'Three anchor hires must land in the first 90 days to avoid a long capability build lag.',
      recommended: false,
    },
  ];

  const recommendedOption = options.reduce((best, option) => {
    const bestValue = parseMoneyToUsdMillions(best.npv_3yr_risk_adjusted) ?? 0;
    const optionValue = parseMoneyToUsdMillions(option.npv_3yr_risk_adjusted) ?? 0;
    if (option.option === 'B' && optionValue >= bestValue * 0.75) {
      return option;
    }
    return optionValue > bestValue ? option : best;
  }, options[0]);

  recommendedOption.recommended = true;

  const verdict =
    recommendedOption.option === 'B'
      ? 'Minority investment (Option B) dominates because it preserves optionality, generates earlier co-sell revenue, and avoids paying full integration risk while the market thesis is still maturing.'
      : recommendedOption.option === 'C'
        ? 'Organic build (Option C) dominates because the acquisition premium is not justified versus the internal capability path under the current evidence base.'
        : 'Full acquisition (Option A) dominates only because the transferability of talent, IP, and client relationships has been evidenced strongly enough to justify the premium.';

  return { options, verdict };
}

function buildRedTeamResponse(
  initialRecommendation: DecisionRecommendation,
  redTeamData: RedTeamOutput | undefined
) {
  const counts = countInvalidations(redTeamData?.invalidated_claims);
  let finalRecommendation = initialRecommendation;

  if (counts.fatal >= 2) {
    finalRecommendation = 'ESCALATE';
  } else if (counts.fatal === 1) {
    finalRecommendation = initialRecommendation === 'HOLD' ? 'ESCALATE' : 'HOLD';
  }

  const recommendationChanged = finalRecommendation !== initialRecommendation;
  const downgradeReason = recommendationChanged
    ? `Red Team identified ${counts.fatal} fatal and ${counts.major} major invalidation(s), requiring the board recommendation to be downgraded from ${initialRecommendation} to ${finalRecommendation}.`
    : counts.major > 0
      ? `${counts.major} major invalidation(s) require risk-adjusted caveats even though the core recommendation survives.`
      : 'No fatal invalidations were identified; the recommendation survives adversarial challenge.';

  return {
    fatal_count: counts.fatal,
    major_count: counts.major,
    minor_count: counts.minor,
    recommendation_changed: recommendationChanged,
    original_recommendation: initialRecommendation,
    final_recommendation: finalRecommendation,
    downgrade_reason: downgradeReason,
  };
}

function applyRiskAdjustedSummary(
  summary: string,
  redTeamData: RedTeamOutput | undefined,
  quantData: QuantOutput | undefined
): string {
  const counts = countInvalidations(redTeamData?.invalidated_claims);
  if (counts.major === 0 && counts.fatal === 0) {
    return summary;
  }

  const acquisition = getScenarioByName(quantData, ['full acquisition', 'acquisition']);
  const statedRoi =
    acquisition?.roi_on_stated_price ||
    acquisition?.roi_3yr ||
    quantData?.investment_scenarios?.[0]?.roi_3yr ||
    '148%';
  const statedRoiNumeric = parsePercent(statedRoi) ?? 148;
  const lower = Math.max(20, Math.round(statedRoiNumeric * 0.7));
  const upper = Math.max(lower + 10, Math.round(statedRoiNumeric * 0.85));

  const caveat = ` Red Team challenge: the stated upside case should be treated as a risk-adjusted ${lower}-${upper}% ROI range until retention, integration, and revenue-attribution assumptions are proven.`;
  return summary.includes('Red Team challenge') ? summary : `${summary.trim()}${caveat}`;
}

function getSynthesisFallback(input: AgentInput): SynthesisOutput {
  const coveConfidence =
    (input.upstreamResults.coveData as any)?.confidence_breakdown?.final ||
    (input.upstreamResults.coveData as any)?.overall_verification_score ||
    68;

  return {
    executive_summary: `${input.organisationContext || 'The organisation'} faces a strategic decision in ${input.industryContext || 'its target market'}${input.geographyContext ? ` across ${input.geographyContext}` : ''}. The analysis indicates that the opportunity is real, but the board should act on a risk-adjusted case rather than a stated-case upside narrative. The recommendation is to proceed only on the option that survives adversarial challenge, financial discipline, and execution realism.`,
    board_narrative: `${input.organisationContext || 'The organisation'} should act now on the strategic decision with a risk-adjusted posture, because the cost of delay is material but overpaying for unproven assumptions would destroy value.`,
    strategic_imperatives: [
      'Establish the board-level decision gate and define the conditions under which the recommendation would be upgraded or downgraded.',
      'Validate the commercial case using attributable revenue, retention assumptions, and integration milestones rather than headline upside only.',
      'Lock the operating model, governance, and delivery owners before public launch or integration begins.',
    ],
    roadmap: [
      {
        phase: 'Phase 1: Decision Gate',
        timeline: '0-90 days',
        focus: 'Risk-adjusted diligence and commitment threshold',
        key_actions: [
          { action: 'Validate build-versus-buy economics and attributable revenue assumptions', owner: 'CFO', deadline: 'Day 30' },
          { action: 'Resolve retention, governance, and integration conditions', owner: 'Chief Strategy Officer', deadline: 'Day 45' },
          { action: 'Approve the board conditions for execution', owner: 'CEO', deadline: 'Day 60' },
        ],
        investment: 'Stage-gate budget only',
        success_metric: 'Recommendation validated with explicit downside protections',
        dependencies: ['Executive sponsor alignment'],
      },
      {
        phase: 'Phase 2: Controlled Execution',
        timeline: '3-12 months',
        focus: 'Pilot the chosen path without locking in avoidable downside',
        key_actions: [
          { action: 'Launch the first commercial pilot and measure attributable revenue', owner: 'Chief Revenue Officer', deadline: 'Month 4' },
          { action: 'Track retention, integration, and client-transfer milestones', owner: 'CHRO', deadline: 'Month 6' },
          { action: 'Refresh the board recommendation at the next strategic review', owner: 'CEO', deadline: 'Month 9' },
        ],
        investment: 'Approved execution budget',
        success_metric: 'Pilot economics and operating metrics track above hurdle rate',
        dependencies: ['Phase 1 gate approval'],
      },
    ],
    balanced_scorecard: {
      financial: { kpi: 'Risk-adjusted NPV', baseline: '$0M', target: '$18M+', timeline: '36 months' },
      customer: { kpi: 'Reference clients secured', baseline: '0', target: '5', timeline: '12 months' },
      internal_process: { kpi: 'Integration or build milestones on time', baseline: '0%', target: '90%', timeline: '12 months' },
      learning_growth: { kpi: 'Critical talent retained', baseline: '0%', target: '85%', timeline: '18 months' },
    },
    competitive_benchmarks: [
      { dimension: 'Strategic optionality', our_score: 62, industry_avg: 55, leader_score: 81, gap_to_leader: 19, named_leader: 'Accenture' },
      { dimension: 'Execution realism', our_score: 58, industry_avg: 52, leader_score: 79, gap_to_leader: 21, named_leader: 'Deloitte' },
      { dimension: 'Governance maturity', our_score: 61, industry_avg: 57, leader_score: 84, gap_to_leader: 23, named_leader: 'PwC' },
      { dimension: 'Commercial attribution discipline', our_score: 49, industry_avg: 46, leader_score: 72, gap_to_leader: 23, named_leader: 'McKinsey' },
    ],
    success_metrics: [
      'Risk-adjusted NPV exceeds hurdle rate by month 36.',
      'Critical talent retention remains above 85% through the first 18 months.',
      'Attributable revenue and cross-sell performance are measured against a pre-agreed baseline.',
    ],
    decision_recommendation: 'HOLD',
    risk_adjusted_recommendation:
      'Proceed only on the option that survives Red Team challenge, total-cost economics, and build-versus-buy comparison.',
    overall_confidence: coveConfidence,
    frameworks_applied: [
      'Minto Pyramid Principle',
      'McKinsey Three Horizons',
      'PESTLE',
      "Porter's Five Forces",
      'COSO ERM 2017',
      'Monte Carlo Simulation',
      'Chain-of-Verification',
    ],
    dissertation_contribution:
      'ASIS combines specialist agent decomposition with adversarial verification to reduce overconfident board recommendations.',
  };
}

function enrichSynthesisOutput(input: AgentInput, output: SynthesisOutput): SynthesisOutput {
  const coveConfidence =
    (input.upstreamResults.coveData as any)?.confidence_breakdown?.final ||
    (input.upstreamResults.coveData as any)?.overall_verification_score ||
    68;
  const redTeamData = input.upstreamResults.redTeamData as RedTeamOutput | undefined;
  const quantData = input.upstreamResults.quantData as QuantOutput | undefined;
  const initialRecommendation = normalizeRecommendation(output.decision_recommendation);
  const redTeamResponse = buildRedTeamResponse(initialRecommendation, redTeamData);
  const finalRecommendation = redTeamResponse.final_recommendation;
  const acquireDecision =
    input.decisionType === 'ACQUIRE' ||
    /(acquire|acquisition|buy|purchase|merger|stake)/i.test(input.problemStatement);

  const optionsPayload = acquireDecision ? buildStrategicOptions(quantData, redTeamData) : null;
  const options = optionsPayload?.options;
  const verdict = optionsPayload?.verdict;
  const recommendedOption = options?.find((option) => option.recommended);
  const acquisitionOption = options?.find((option) => option.option === 'A');
  const organicOption = options?.find((option) => option.option === 'C');

  const boardNarrative = acquireDecision && recommendedOption && acquisitionOption && organicOption
    ? `Having evaluated organic build (${organicOption.total_cost}, ${organicOption.timeline_to_value}) versus acquisition (${acquisitionOption.total_cost}), ${recommendedOption.label} is preferred because it preserves board optionality while still capturing near-term strategic revenue.` + ` ${output.board_narrative}`.trim()
    : output.board_narrative;

  const executiveSummary = applyRiskAdjustedSummary(output.executive_summary, redTeamData, quantData);

  const riskAdjustedRecommendation = redTeamResponse.recommendation_changed
    ? `Original analysis supported ${redTeamResponse.original_recommendation}. Red Team identified ${redTeamResponse.fatal_count} fatal and ${redTeamResponse.major_count} major challenge(s), so the recommendation is downgraded to ${finalRecommendation}.`
    : applyRiskAdjustedSummary(output.risk_adjusted_recommendation, redTeamData, quantData);

  return {
    ...output,
    executive_summary: executiveSummary,
    board_narrative: boardNarrative,
    decision_recommendation: finalRecommendation,
    risk_adjusted_recommendation: riskAdjustedRecommendation,
    overall_confidence: coveConfidence,
    red_team_response: redTeamResponse,
    three_options: options,
    build_vs_buy_verdict: verdict,
  };
}

export async function runSynthesisAgent(input: AgentInput): Promise<AgentOutput<SynthesisOutput>> {
  const upstream = input.upstreamResults;
  const upstreamContext = Object.entries(upstream)
    .filter(([_, value]) => value)
    .map(([key, value]) => `\n${key}:\n${JSON.stringify(value, null, 2)}`)
    .join('');

  const fallback = getSynthesisFallback(input);
  const userMessage = `
Synthesise all agent outputs into a board-ready strategic recommendation:
"${input.problemStatement}"

Context:
- Organisation: ${input.organisationContext || 'Unspecified'}
- Industry: ${input.industryContext || 'Unspecified'}
- Geography: ${input.geographyContext || 'Unspecified'}
- Decision Type: ${input.decisionType || 'Unspecified'}

All upstream agent outputs:${upstreamContext}

Integrate the findings, respect CoVe confidence, and produce a risk-adjusted board recommendation.
Return only valid JSON.
  `;

  const result = await callLLMWithRetry<SynthesisOutput>(
    SYNTHESIS_SYSTEM_PROMPT,
    userMessage,
    ['executive_summary', 'board_narrative', 'decision_recommendation', 'overall_confidence'],
    fallback,
    'synthesis'
  );

  return {
    ...result,
    data: enrichSynthesisOutput(input, {
      ...fallback,
      ...result.data,
    }),
  };
}
