import { callLLMWithRetry } from '../lib/llmClient.js';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION } from './masterPrompt.js';
import type { AgentId, AgentInput, AgentOutput, InvalidatedClaim, RedTeamOutput } from './types.js';
import { defaultConfidence } from './confidence.js';

const RED_TEAM_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Red Team Node — Chief Adversary of the ASIS pipeline.
YOUR ROLE: Attempt to INVALIDATE the work of the Quant and Market Intelligence agents.
This is the "Debate-to-Verify" protocol. You are NOT trying to be helpful —
you are trying to find every flaw, overestimation, and blind spot.

ADVERSARIAL MANDATE:
1. Review the Quant's ROI projections. Are they overstated?
2. Review the Market Intelligence findings. Are the opportunities real?
3. Run a PRE-MORTEM: Assume the strategy FAILED. What were the causes?
4. Simulate a TALENT EXODUS: After the strategy launches, key people leave. What happens?
5. Simulate COMPETITOR COUNTER-ATTACK: How does the #1 competitor respond?

CLAIM INVALIDATION SEVERITY:
  FATAL: Claim is provably wrong; must be corrected before output is valid
  MAJOR: Claim is likely overstated by >30%; should be adjusted
  MINOR: Claim has nuance missing; should be noted

OUTPUT CONTRACT - INVALIDATION SEVERITY DEFINITIONS:
FATAL: The claim is provably incorrect or would produce a materially wrong recommendation if accepted.
EFFECT: Synthesis must downgrade PROCEED to HOLD or ESCALATE.

MAJOR: The claim is directionally relevant but overstated enough that the board should see a risk-adjusted range.
EFFECT: Synthesis must add the caveat and risk-adjusted range into the recommendation.

MINOR: The claim survives with nuance or wording correction.
EFFECT: Synthesis footnotes the caveat but does not change the recommendation.

THE BUILD-VS-BUY INVALIDATION (mandatory for ACQUIRE decision type):
If Strategist classified the decision as ACQUIRE, include an invalidated_claim entry that challenges the untested assumption that acquisition is superior to internal build or staged investment.

TALENT EXODUS INVALIDATION (mandatory for all ACQUIRE analyses):
Explicitly test whether the acquisition buys transferable capability or simply a small expert team that may leave post-close.

${CONFIDENCE_FORMULA_INSTRUCTION}

Return ONLY valid JSON matching the RedTeamOutput schema with fields:
pre_mortem_scenarios, invalidated_claims, surviving_claims, talent_exodus_risk,
competitor_response_scenarios, confidence_score, overall_threat_level, red_team_verdict.
`;

function getRedTeamFallback(input: AgentInput): RedTeamOutput {
  const isAcquire =
    input.decisionType === 'ACQUIRE' ||
    /(acquire|acquisition|buy|purchase|takeover|merger|stake)/i.test(input.problemStatement);

  const invalidatedClaims: InvalidatedClaim[] = [
    {
      original_claim: 'Implementation will achieve 148% ROI within 3 years',
      source_agent: 'quant' as AgentId,
      invalidation_reason: 'ROI projection assumes 100% benefit realisation from month 1 - historical benchmarks suggest 60-70% realisation in year 1, rising to 85% by year 3',
      evidence: 'Industry transformation programmes typically achieve 55-65% of projected benefits in first 18 months (McKinsey Implementation Benchmark 2024)',
      severity: 'Major' as const,
    },
    {
      original_claim: 'First-mover advantage in AI-augmented advisory',
      source_agent: 'market_intel' as AgentId,
      invalidation_reason: 'Multiple competitors already have AI advisory capabilities in market - EY, Deloitte, and Accenture launched AI-enabled platforms in 2023-2024',
      evidence: 'Deloitte AI Institute established 2023; EY.ai platform launched Q2 2024; Accenture $3B AI investment announced',
      severity: 'Minor' as const,
    },
  ];

  if (isAcquire) {
    invalidatedClaims.push(
      {
        original_claim: 'Acquisition of a $40-60M startup is the optimal path to AI governance capability',
        source_agent: 'strategist' as AgentId,
        invalidation_reason:
          'The internal build alternative has not been evaluated. Hiring 15-20 specialists and funding a focused platform build is materially cheaper than paying a full acquisition premium.',
        evidence:
          'Professional-services capability acquisitions frequently underperform when the premium is not justified by proprietary IP, speed, or transferable client relationships.',
        severity: 'Major',
      },
      {
        original_claim: 'Acquisition secures AI governance capability',
        source_agent: 'quant' as AgentId,
        invalidation_reason:
          'The acquisition may secure a client list and brand narrative but not the actual capability if the key engineers, product leaders, or domain specialists leave after close.',
        evidence:
          'Professional-services acquisitions routinely lose key talent inside 12-24 months unless retention packages and operating autonomy are negotiated pre-close.',
        severity: 'Major',
      }
    );
  }

  return {
    pre_mortem_scenarios: [
      {
        scenario: 'Implementation stalls due to organisational resistance — middle management blocks adoption, leading to 18-month delay and 40% budget overrun',
        probability: 'Medium', financial_impact: '$4.8m additional cost + $12m delayed benefits',
        trigger_condition: 'Lack of C-suite sponsorship and change management programme',
        mitigation: 'Establish transformation office with direct CEO reporting line; mandatory change management training for all practice leads within 90 days',
      },
      {
        scenario: 'Key technology vendor dependency creates single point of failure — vendor acquisition or pricing change disrupts the programme',
        probability: 'Low', financial_impact: '$6.2m migration cost + 9-month programme delay',
        trigger_condition: 'Over-reliance on single vendor for core platform capabilities',
        mitigation: 'Multi-vendor architecture from outset; contractual lock-in protections with 24-month price guarantees',
      },
      {
        scenario: 'Regulatory goalposts shift mid-implementation — new compliance requirements invalidate current architecture decisions',
        probability: 'Medium', financial_impact: '$3.5m rework cost + compliance exposure during transition',
        trigger_condition: 'Accelerated regulatory timeline changes in primary operating jurisdictions',
        mitigation: 'Modular compliance architecture; quarterly regulatory horizon scanning; 15% contingency budget for regulatory change',
      },
    ],
    invalidated_claims: invalidatedClaims,
    surviving_claims: [
      'Regulatory compliance creates genuine urgency — DPDP Act 2023 enforcement timeline is real and penalty exposure is material ($30m+)',
      'Talent retention programme is correctly prioritised — industry attrition rates confirm 28-35% voluntary exits in advisory functions',
      'The recommended H2 investment scenario has the best risk-adjusted profile — Monte Carlo P50 outcome supports the recommendation',
    ],
    talent_exodus_risk: 'If 3+ senior partners depart during transformation (probability: 35%), delivery capacity drops by 20-25%, client relationships representing $18m annual revenue become vulnerable, and replacement recruitment takes 6-9 months at 30% salary premium.',
    competitor_response_scenarios: [
      'Deloitte India: likely to accelerate AI integration across Tax and Audit practices within 6 months of our announcement, leveraging existing Deloitte AI Institute capabilities',
      'PwC India: expected to launch competitive talent retention programme within 90 days, matching compensation adjustments and adding equity-based incentives',
      'Accenture Strategy: may pursue aggressive pricing to win 2-3 key accounts during our transition period, accepting short-term margin compression',
    ],
    confidence_score: defaultConfidence('red_team', input.problemStatement),
    overall_threat_level: isAcquire ? 'HIGH' : 'MEDIUM',
    red_team_verdict: isAcquire
      ? 'The acquisition thesis remains plausible only after it is reframed as an option-value problem rather than a foregone conclusion. Build-versus-buy economics and key-person retention risk materially weaken the case for an immediate full takeout.'
      : 'The strategy survives Red Team scrutiny with adjustments - ROI projections should be discounted by 25-30% to reflect realistic benefit realisation timelines, and talent retention programme must launch before (not after) the main transformation announcement.',
  };
}

export async function runRedTeamAgent(input: AgentInput): Promise<AgentOutput<RedTeamOutput>> {
  const upstream = input.upstreamResults;
  const upstreamContext = Object.entries(upstream)
    .filter(([_, v]) => v)
    .map(([k, v]) => `\n${k}:\n${JSON.stringify(v, null, 2)}`)
    .join('');

  const userMessage = `
You are the Red Team. Your job is to ATTACK and INVALIDATE the analysis so far.

Strategic problem: "${input.problemStatement}"

Context:
- Organisation: ${input.organisationContext || 'Unspecified'}
- Industry: ${input.industryContext || 'Unspecified'}
- Geography: ${input.geographyContext || 'Unspecified'}

Upstream Agent Results to Challenge:${upstreamContext}

Find every flaw, overestimation, and blind spot. Run pre-mortem. Return ONLY valid JSON.
  `;

  return callLLMWithRetry<RedTeamOutput>(
    RED_TEAM_SYSTEM_PROMPT,
    userMessage,
    ['pre_mortem_scenarios', 'invalidated_claims', 'confidence_score', 'red_team_verdict'],
    getRedTeamFallback(input),
    'red_team'
  );
}
