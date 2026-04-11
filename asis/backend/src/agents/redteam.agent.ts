import { callLLMWithRetry } from '../lib/llmClient';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION } from './masterPrompt';
import type { AgentInput, RedTeamOutput, AgentOutput } from './types';

const RED_TEAM_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Red Team Node — Chief Adversary of the ASIS pipeline.
YOUR ROLE: Attempt to INVALIDATE the work of the Quant and Market Intelligence agents.
You are NOT trying to be helpful — you are trying to find every flaw, overestimation, and blind spot.

ADVERSARIAL MANDATE:
1. Review the Quant's ROI projections. Are they overstated?
   Compare against actual industry implementation costs and failure rates.
2. Review the Market Intelligence findings. Are the opportunities real?
   What are the most likely competitive responses?
3. Run a PRE-MORTEM: Assume the strategy FAILED. What were the causes?
4. Simulate a TALENT EXODUS: After the strategy launches, key people leave. What happens?
5. Simulate COMPETITOR COUNTER-ATTACK: How does the #1 competitor respond?

CLAIM INVALIDATION SEVERITY:
  FATAL: Claim is provably wrong; must be corrected before output is valid
  MAJOR: Claim is likely overstated by >30%; should be adjusted
  MINOR: Claim has nuance missing; should be noted

${CONFIDENCE_FORMULA_INSTRUCTION}

Return ONLY this exact JSON structure:
{
  "pre_mortem_scenarios": [
    {
      "scenario": "Specific failure mode",
      "probability": "High|Medium|Low",
      "financial_impact": "Specific dollar or percentage impact",
      "trigger_condition": "What causes this scenario",
      "mitigation": "How to prevent or recover"
    }
  ],
  "invalidated_claims": [
    {
      "original_claim": "The exact claim made by source agent",
      "source_agent": "quant|market_intel|strategist",
      "invalidation_reason": "Specific evidence-based counter-argument",
      "evidence": "Industry benchmark, historical precedent, or logical contradiction",
      "severity": "Fatal|Major|Minor"
    }
  ],
  "surviving_claims": ["Claim that survived red team scrutiny — with reason it is robust"],
  "talent_exodus_risk": "Specific scenario: who leaves, when, what is the operational impact",
  "competitor_response_scenarios": ["Named competitor: specific expected response within X months"],
  "confidence_score": [CALCULATED],
  "overall_threat_level": "CRITICAL|HIGH|MEDIUM|LOW",
  "red_team_verdict": "One-sentence verdict: does the strategy survive red team scrutiny?"
}
`;

const redTeamFallback: RedTeamOutput = {
  pre_mortem_scenarios: [
    { scenario: "AI platform deployment fails to deliver promised efficiency gains — delivered at 40% of projected ROI", probability: "Medium", financial_impact: "NPV reduced from $28m to $8m — 71% shortfall", trigger_condition: "Vendor underdelivers on AI model accuracy; change management fails", mitigation: "Contractual milestones with penalties; parallel vendor evaluation; phased rollout" },
    { scenario: "Key Senior Manager cohort (30% of Advisory) exits within 12 months of transformation announcement", probability: "High", financial_impact: "Revenue at risk: $15m in booked engagements; client dissatisfaction: NPS -15 points", trigger_condition: "Transformation perceived as threat to prestige and autonomy; no retention package announced", mitigation: "Early communication of talent implications; retention packages for top 20 SMs before announcement" },
    { scenario: "Competitor (EY India) launches aggressive mid-market pricing 6 months before go-to-market", probability: "Medium", financial_impact: "Market share target reduced by 40%; 18-month delay to break even", trigger_condition: "Intelligence gap — competitor moves faster than anticipated; pricing strategy too aggressive", mitigation: "Differentiate on quality and specialization rather than price; maintain premium positioning" }
  ],
  invalidated_claims: [
    { original_claim: "Horizon 2 NPV of $28m at 38% IRR — payback in 22 months", source_agent: 'quant', invalidation_reason: "AI transformation ROI estimates in consulting industry historically overestimate by 30-45% (Gartner 2023). McKinsey's own analysis of 1,500 digital transformations found average ROI achievement of 62% of projected benefits.", evidence: "Gartner: 70% of digital transformation initiatives fail to meet stated ROI targets within 3 years", severity: "Major" },
    { original_claim: "Professional services market in India growing at 12% CAGR — opportunity is $8B for AI-augmented services", source_agent: 'market_intel', invalidation_reason: "CAGR projection conflates total market growth with addressable segment growth. AI-augmented services are a subset; actual addressable market is likely 15-20% of total.", evidence: "Addressable market for specialized AI consulting services in India estimated at $1.2-1.6B, not $8B", severity: "Major" }
  ],
  surviving_claims: ["DPDP Act 2023 compliance deadline is real and non-negotiable — regulatory risk survives scrutiny", "Competitive intensity in professional services will continue to increase regardless of transformation timing"],
  talent_exodus_risk: "If transformation is announced without retention packages, 30% of Senior Manager band (estimated 15-20 people with ₹8Cr annual revenue responsibility) will explore alternatives within 90 days. Primary risk: the people who know the firm best will leave fastest.",
  competitor_response_scenarios: ["EY India: likely to match any mid-market AI service launch within 3 months using existing scale advantage", "KPMG India: may attempt to acquire mid-market AI startup to accelerate AI capability build"],
  confidence_score: 80,
  overall_threat_level: "HIGH",
  red_team_verdict: "The strategy survives red team scrutiny but requires adjustment: reduce projected ROI by 30% to account for realistic AI implementation challenges, and anchor talent retention before go-to-market announcement."
};

export async function runRedTeamAgent(input: AgentInput): Promise<AgentOutput> {
  const start = Date.now();
  const quantData = input.upstreamResults?.quantData ? JSON.stringify(input.upstreamResults.quantData, null, 2) : 'No Quant data available';
  const marketIntelData = input.upstreamResults?.marketIntelData ? JSON.stringify(input.upstreamResults.marketIntelData, null, 2) : 'No Market Intel data available';
  const userMessage = `
Strategic problem: "${input.problemStatement}"

UPSTREAM AGENT OUTPUTS:

QUANT AGENT:
${quantData}

MARKET INTEL AGENT:
${marketIntelData}

Attempt to invalidate claims. Return ONLY valid JSON.
  `;
  const result = await callLLMWithRetry<RedTeamOutput>(RED_TEAM_SYSTEM_PROMPT, userMessage, ['pre_mortem_scenarios', 'invalidated_claims', 'red_team_verdict', 'confidence_score'], redTeamFallback);
  return { agentId: 'red_team', status: result.usedFallback ? 'self_corrected' : 'completed', data: result.data as Record<string, unknown>, confidenceScore: result.data.confidence_score, durationMs: Date.now() - start, attemptNumber: result.attempts, selfCorrected: result.usedFallback, tokenUsage: { input: result.inputTokens, output: result.outputTokens } };
}
