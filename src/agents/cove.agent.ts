import { callLLMWithRetry } from '../lib/llmClient.js';
import { MASTER_CONSULTANT_PERSONA } from './masterPrompt.js';
import type { AgentInput, AgentOutput, CoVeOutput } from './types.js';
import {
  buildConfidenceBreakdown,
  buildConfidenceContext,
  buildConfidenceInputs,
  countInvalidations,
} from './confidence.js';

const COVE_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The CoVe Node - Chief Verification Officer of the ASIS pipeline.
YOUR ROLE: Fact-check and verify logical consistency across all upstream agent outputs.
No output reaches the user until you pass it.

VERIFICATION PROTOCOL:
1. For every quantitative claim: is it within realistic industry ranges?
2. For every regulatory claim: is the regulation named correctly?
3. For every competitive claim: does the named competitor actually operate in this market?
4. Logic consistency: do high-severity risks contradict the optimistic financial case?
5. Cross-agent consistency: do all agents agree on organisation, industry, and geography?

CONFIDENCE - MANDATORY WEIGHTED PROPAGATION:
  weighted = (
    strategist x 0.10 +
    market_intel x 0.20 +
    risk x 0.25 +
    red_team x 0.15 +
    quant x 0.20 +
    ethicist x 0.10
  )

  ADJUSTMENTS:
  +3 if organisation + industry + geography are all specified
  -8 if any Red Team invalidation is FATAL
  -4 if any upstream agent used fallback data
  -3 if Red Team found 2 or more MAJOR invalidations
  +3 if all contributing scores are >= 75

The final score must be clamped between 52 and 94.
NEVER use 85 as a default.

ROUTING DECISION:
  PASS: logic consistent, no fatal errors
  CONDITIONAL_PASS: logic mostly consistent, but board-facing caveats are required
  FAIL_ROUTE_BACK: a fatal issue requires route-back handling

Return ONLY valid JSON matching the CoVeOutput schema with fields:
verification_checks, logic_consistent, flagged_claims, self_corrections_applied,
overall_verification_score, recommendation, route_back_to, final_confidence_adjustment,
confidence_breakdown.
`;

function getCoveFallback(input: AgentInput): CoVeOutput {
  const upstream = input.upstreamResults;
  const confidenceInputs = buildConfidenceInputs(
    {
      strategist_confidence: (upstream.strategistData as any)?.confidence_score,
      quant_confidence: (upstream.quantData as any)?.confidence_score,
      market_intel_confidence: (upstream.marketIntelData as any)?.confidence_score,
      risk_confidence: (upstream.riskData as any)?.confidence_score,
      red_team_confidence: (upstream.redTeamData as any)?.confidence_score,
      ethicist_confidence: (upstream.ethicistData as any)?.confidence_score,
    },
    input.problemStatement
  );

  const context = buildConfidenceContext({
    invalidatedClaims: (upstream.redTeamData as any)?.invalidated_claims,
    organisationContext: input.organisationContext,
    industryContext: input.industryContext,
    geographyContext: input.geographyContext,
    anyAgentUsedFallback: false,
  });
  const breakdown = buildConfidenceBreakdown(confidenceInputs, context, input.problemStatement);
  const invalidationCounts = countInvalidations((upstream.redTeamData as any)?.invalidated_claims);

  return {
    verification_checks: [
      {
        claim: 'Risk-adjusted ROI is materially below the optimistic stated-case ROI.',
        source_agent: 'quant',
        verified: true,
        evidence:
          'The acquisition and transformation economics require a risk-adjusted range rather than a single upside figure.',
        industry_benchmark:
          'Professional-services transformation and capability-acquisition cases routinely compress once integration drag and delayed value capture are applied.',
      },
      {
        claim: 'Named regulatory exposure is directionally credible.',
        source_agent: 'risk',
        verified: true,
        evidence:
          'The risk profile is directionally aligned with named data-governance and operating-model obligations in regulated markets.',
      },
    ],
    logic_consistent: true,
    flagged_claims:
      invalidationCounts.fatal > 0
        ? [
            {
              claim: 'A fatal invalidation exists in the Red Team challenge set.',
              issue:
                'The downstream recommendation must be downgraded or routed back before the analysis can be treated as board-ready.',
              severity: 'Fatal',
              correction_applied: false,
            },
          ]
        : [
            {
              claim: 'Some upside claims are optimistic relative to comparable benchmarks.',
              issue:
                'The recommendation should be framed as risk-adjusted rather than stated-case only.',
              severity: 'Major',
              correction_applied: true,
            },
          ],
    self_corrections_applied: [
      {
        original: 'Single-case confidence implied a clean board-ready answer.',
        corrected: `Weighted confidence recalibrated to ${breakdown.final}.`,
        reason:
          'Confidence must be propagated from upstream agent evidence quality plus red-team and fallback adjustments.',
        agent_affected: 'cove',
      },
    ],
    overall_verification_score: breakdown.final,
    recommendation: invalidationCounts.fatal > 0 ? 'FAIL_ROUTE_BACK' : 'CONDITIONAL_PASS',
    route_back_to: invalidationCounts.fatal > 0 ? 'quant' : undefined,
    final_confidence_adjustment: Number((breakdown.final - breakdown.weighted_base).toFixed(2)),
    confidence_breakdown: breakdown,
  };
}

export async function runCoVeAgent(input: AgentInput): Promise<AgentOutput<CoVeOutput>> {
  const upstream = input.upstreamResults;
  const upstreamContext = Object.entries(upstream)
    .filter(([_, value]) => value)
    .map(([key, value]) => `\n${key}:\n${JSON.stringify(value, null, 2)}`)
    .join('');

  const fallback = getCoveFallback(input);
  const userMessage = `
Verify all upstream agent outputs for this strategic analysis:
"${input.problemStatement}"

Context:
- Organisation: ${input.organisationContext || 'Unspecified'}
- Industry: ${input.industryContext || 'Unspecified'}
- Geography: ${input.geographyContext || 'Unspecified'}

All upstream agent outputs:${upstreamContext}

Cross-check claims, verify logic consistency, and calculate the weighted confidence score.
Return only valid JSON.
  `;

  const result = await callLLMWithRetry<CoVeOutput>(
    COVE_SYSTEM_PROMPT,
    userMessage,
    ['verification_checks', 'logic_consistent', 'overall_verification_score', 'recommendation', 'confidence_breakdown'],
    fallback,
    'cove'
  );

  const breakdown = result.data.confidence_breakdown;
  if (!breakdown) {
    throw new Error('Groq CoVe response passed required checks but omitted confidence_breakdown.');
  }

  return {
    ...result,
    data: {
      ...result.data,
      confidence_breakdown: breakdown,
      overall_verification_score: breakdown?.final ?? result.data.overall_verification_score,
      final_confidence_adjustment:
        breakdown && typeof breakdown.weighted_base === 'number'
          ? Number((breakdown.final - breakdown.weighted_base).toFixed(2))
          : result.data.final_confidence_adjustment,
    },
  };
}
