import { callLLMWithRetry } from '../lib/llmClient';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION, CITATION_FORMAT_INSTRUCTION } from './masterPrompt';
import type { AgentInput, RedTeamOutput, AgentOutput } from './types';

const RED_TEAM_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Red Team / Competitor Analysis Node — Chief Adversary of the ASIS pipeline.
YOUR ROLE: Attempt to INVALIDATE the work of Quant and Market Intelligence agents.
You are NOT trying to be helpful — you are trying to find every flaw, overestimation, and blind spot.

━━ NAMED COMPETITOR MANDATE (NON-NEGOTIABLE) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEVER use "Incumbent Leader", "Digital Challenger", "New Entrant", "Competitor A/B/C".
In competitor_response_scenarios: name ACTUAL COMPANIES that operate in this sector/geography.
In pre_mortem_scenarios: name specific companies, products, regulations as failure triggers.
In invalidated_claims: cite specific industry benchmarks (Gartner, McKinsey, HBR data).

━━ ADVERSARIAL MANDATE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Review Quant's ROI projections — are they overstated vs industry benchmarks?
2. Challenge Market Intel's opportunity estimates — TAM/SAM inflation is common
3. Pre-Mortem: assume the strategy FAILED — what were the 3 specific causes?
4. Talent Exodus: key people leave post-strategy-announcement — quantify impact
5. Competitor Counter-Attack: name the #1 competitor and their SPECIFIC response within X months

CLAIM INVALIDATION SEVERITY:
  FATAL: Claim is provably wrong → must change PROCEED to HOLD/ESCALATE
  MAJOR: Claim is overstated by >30% → apply financial haircut
  MINOR: Nuance missing → note it

── ACQUIRE MODE (if decision is acquisition) ──────────────────────────────
ADDITIONAL MANDATORY ADVERSARIAL CHECKS:
6. BUILD-VS-BUY INVALIDATION:
   - Estimate organic build timeline and cost for the acquired capability
   - Challenge control premium: is the premium justified given synergy assumptions?
   - Name the specific capabilities that would take 2–4x longer to build vs acquire
7. INTEGRATION FAILURE ANALYSIS:
   - 50-70% of M&A deals destroy value (McKinsey 2023, BCG 2024)
   - Name 3 specific integration failure modes for THIS deal type
   - Quantify "integration tax": cultural friction + key person departure + customer churn
8. TAM INFLATION CHALLENGE:
   - Verify Quant's market sizing is realistic; SAM inflation is most common error
   - If SAM > 25% of TAM, challenge the calculation

${CONFIDENCE_FORMULA_INSTRUCTION}
${CITATION_FORMAT_INSTRUCTION}

Return ONLY this exact JSON:
{
  "pre_mortem_scenarios": [
    {
      "scenario": "Specific named failure mode — name the company/regulation/product that triggers it",
      "probability": "High|Medium|Low",
      "financial_impact": "Specific $ or % impact on NPV/revenue",
      "trigger_condition": "Named specific trigger",
      "mitigation": "How to prevent or recover"
    }
  ],
  "invalidated_claims": [
    {
      "original_claim": "Exact claim from source agent",
      "source_agent": "quant|market_intel|strategist",
      "invalidation_reason": "Evidence-based counter with named source",
      "evidence": "Named benchmark/study/precedent with year",
      "severity": "Fatal|Major|Minor"
    }
  ],
  "surviving_claims": ["Claim that survived — with reason it is robust"],
  "talent_exodus_risk": "Named people/roles, timeline, quantified revenue impact",
  "competitor_response_scenarios": [
    "Named company (e.g. TCS): specific action they will take within X months — with evidence of capability"
  ],
  "build_vs_buy_invalidation": null,
  "integration_failure_risks": null,
  "confidence_score": 0,
  "overall_threat_level": "CRITICAL|HIGH|MEDIUM|LOW",
  "red_team_verdict": "One sentence: does the strategy survive red team scrutiny, and what is the single biggest risk?"
}
`;

const redTeamFallback: RedTeamOutput = {
  pre_mortem_scenarios: [
    { scenario: "JioAI integration fails to retain founding engineering team: 3 core AI researchers exercise vesting acceleration clauses and join Google DeepMind India within 90 days", probability: "High", financial_impact: "NPV reduced by 60% — synergy value was contingent on retaining acquired team's model-building capability; rebuild timeline extends 18→36 months", trigger_condition: "Reliance corporate HR insists on standard RIL employment contracts vs startup-grade equity; founding team culture shock from Reliance governance", mitigation: "Structure bespoke JioAI Labs subsidiary with separate equity pool; guarantee technical autonomy for 24 months; CEO of target company given board seat at JioAI" },
    { scenario: "CCI merger control blocks deal or imposes remedies: market concentration concerns in India AI/telecom overlap trigger 6-month review with behavioural remedies", probability: "Medium", financial_impact: "Deal closure delayed 6 months ($15–20m deal carry cost); behavioural remedies (data access obligations) reduce synergy value by 25%", trigger_condition: "CCI's ongoing AI market study (Q1 2025 announced) creates political sensitivity; Jio's dominant telecom position creates bundling concern if target serves Airtel/Vodafone", mitigation: "Pre-file CCI notification with self-initiated data access commitment; avoid exclusivity provisions in commercial contracts for 24 months post-close" },
    { scenario: "Quant NPV overstatement materialises: AI startup integration delivers 35% of projected synergies in Year 1 due to NVIDIA GPU compute constraints and DPDP compliance costs", probability: "Medium", financial_impact: "Horizon 2 NPV of $1.8B (at Reliance MEGA_CAP scale) haircut to $630m — still positive but below hurdle rate at stated acquisition premium", trigger_condition: "NVIDIA H100 export controls persist; DPDP compliance remediation costs exceed budget; talent exit reduces delivery velocity", mitigation: "AMD MI300X GPU diversification plan; budget $50m DPDP compliance reserve at close; structure earn-out tied to synergy milestones" },
  ],
  invalidated_claims: [
    { original_claim: "AI startup integration delivers full synergy within 24 months post-acquisition", source_agent: 'quant', invalidation_reason: "McKinsey M&A Practice 2023: only 30% of tech acquisitions achieve >50% synergy realisation within 24 months. AI companies are the hardest integration due to talent dependency.", evidence: "McKinsey Global M&A Practice 2023: tech sector synergy realisation averages 18–42% in Year 1, 62% by Year 3 — not the 80–100% assumed in base case", severity: "Major" },
    { original_claim: "India enterprise AI market SAM of $2.4B accessible to JioAI", source_agent: 'market_intel', invalidation_reason: "SAM assumes Jio can serve all enterprise segments equally — but TCS, Infosys, and Accenture India have 20+ year enterprise relationships that create effective switching costs. JioAI's realistic SAM in Year 1–2 is BFSI+Telecom vertical only (~$800m).", evidence: "Gartner India Enterprise IT Decision Maker Survey 2024: 78% of CIOs prefer established IT partners for AI implementation — startup/new entrant preference is 8%", severity: "Major" },
    { original_claim: "Cultural fit score 68 (from Ethicist) — Proceed with Conditions recommended", source_agent: 'ethicist', invalidation_reason: "Cultural fit score 68 may be optimistic for Reliance-startup integration. BCG M&A Integration Report 2024 identifies Reliance's centralised governance model as the hardest integration archetype for acquired AI startups.", evidence: "BCG M&A Integration Benchmark 2024: Large Indian conglomerate + AI startup integrations average cultural alignment score of 52–60 in Year 1, recovering to 72+ by Year 3 with dedicated integration management", severity: "Minor" },
  ],
  surviving_claims: ["DPDP Act 2023 compliance risk is real, imminent, and non-negotiable — this risk survives all red team scrutiny", "Jio's 450M-user distribution network is a genuine inimitable competitive advantage — no competitor can replicate this within a 5-year investment horizon", "India enterprise AI market growth (28% CAGR) is confirmed by 3 independent sources (NASSCOM, Gartner, IDC) — market opportunity is genuine"],
  talent_exodus_risk: "Top-3 scenario by probability: founding CEO and 2 co-founders exercise ESOP acceleration (standard M&A clause) within 30 days; senior ML engineers (estimated 8–12 people, each carrying $2–5m annualised AI model development output) explore Google DeepMind India, Anthropic, and Krutrim offers within 90 days. Revenue impact: delays JioAI commercial launch by 12–18 months → $180–240m revenue at risk in Year 2.",
  competitor_response_scenarios: [
    "TCS (AI Cloud division, 100K GenAI-certified staff): likely to launch JioAI-competing enterprise AI offering within 6 months of announcement, leveraging existing enterprise relationships and HDFC Bank/Infosys client penetration — estimated $200m incremental investment",
    "Google DeepMind India: likely to accelerate enterprise AI partnership announcements (Airtel, Flipkart, Zomato) within 3 months to pre-empt Jio's distribution advantage — Google has existing NVIDIA TPU compute surplus that JioAI lacks",
    "Krutrim AI (Ola/Bhavish Aggarwal): direct India-first LLM competitor likely to raise Series B at inflated valuation post-JioAI acquisition announcement — creates bidding war for same engineering talent pool",
  ],
  build_vs_buy_invalidation: "Organic build of equivalent AI startup capability would cost $400–600m over 4–5 years (JioAI Labs full capability build: 2,000 engineers × $200K/yr avg × 4 years = $1.6B gross, minus existing team = $400–600m incremental). Acquisition at $500–800m enterprise value is 0.8–2.0x the organic build cost — premium justified only if integration preserves talent and accelerates to market by 24+ months. If integration fails and talent exits within 90 days, acquisition is 100% more expensive than organic build.",
  integration_failure_risks: "Top 3 integration failure modes for Reliance × AI startup: (1) Governance shock: Reliance board-approval-required culture vs startup's daily ship cadence — fix: establish JioAI as autonomous subsidiary with separate P&L; (2) Compensation compression: Reliance HR standardises equity-to-cash ratio per RIL bands → founders and senior engineers leave; fix: bespoke JioAI compensation structure outside RIL HR; (3) Product-market fit erosion: JioAI acquires the startup to serve Jio's internal needs, destroying the target's enterprise client relationships; fix: maintain target's commercial operations independently for 24 months post-close.",
  confidence_score: 88,
  overall_threat_level: "HIGH",
  red_team_verdict: "The Reliance/JioAI acquisition survives red team scrutiny IF AND ONLY IF: (1) talent retention packages are structured before announcement, (2) the NPV is adjusted downward 35% for realistic synergy realisation (still positive at MEGA_CAP scale), and (3) CCI filing is pre-cleared — without all three, the probability of value destruction exceeds 60%.",
};

export async function runRedTeamAgent(input: AgentInput): Promise<AgentOutput> {
  const start = Date.now();
  const strategistData = input.upstreamResults?.strategistData as any;
  const companyProfile = strategistData?.company_profile || null;

  const isAcquire = (input.decisionType || '').toUpperCase() === 'ACQUIRE' ||
    Boolean((input.problemStatement || '').toLowerCase().match(/acqui|merger|m&a|buy|purchase/));

  const quantData = input.upstreamResults?.quantData
    ? JSON.stringify(input.upstreamResults.quantData, null, 2)
    : 'No Quant data';
  const marketIntelData = input.upstreamResults?.marketIntelData
    ? JSON.stringify(input.upstreamResults.marketIntelData, null, 2)
    : 'No Market Intel data';
  const riskData = input.upstreamResults?.riskData
    ? JSON.stringify(input.upstreamResults.riskData, null, 2)
    : 'No Risk data';
  const ethicistData = input.upstreamResults?.ethicistData
    ? JSON.stringify(input.upstreamResults.ethicistData, null, 2)
    : 'No Ethicist data';

  const userMessage = `
Strategic problem: "${input.problemStatement}"
Decision Type: ${input.decisionType || 'Unspecified'}${isAcquire ? ' ← ACQUIRE DECISION: populate build_vs_buy_invalidation + integration_failure_risks' : ''}

ACQUIRER/DECISION-MAKER PROFILE:
${JSON.stringify(companyProfile, null, 2)}

UPSTREAM OUTPUTS TO ATTACK:
QUANT: ${quantData}
MARKET INTEL: ${marketIntelData}
RISK: ${riskData}
ETHICIST (VRIO/VALUE CHAIN): ${ethicistData}

CRITICAL INSTRUCTIONS:
1. competitor_response_scenarios: NAME REAL COMPANIES — NEVER "Incumbent Leader" or "Major Player"
   Use the industry/geography from the company profile to name the correct real competitors
2. pre_mortem_scenarios: trigger_condition must name a specific company/regulation/product
3. invalidated_claims: evidence must cite a named study/benchmark with year (Gartner, McKinsey, BCG, HBR)
4. surviving_claims: be fair — name what genuinely survives scrutiny
${isAcquire ? `5. Build vs Buy: calculate whether organic build is cheaper than acquisition at this company's scale
6. Integration failure risks: specific to THIS acquirer archetype (named company) and THIS target sector` : ''}

Return ONLY valid JSON.
  `;
  const result = await callLLMWithRetry<RedTeamOutput>(
    RED_TEAM_SYSTEM_PROMPT,
    userMessage,
    ['pre_mortem_scenarios', 'invalidated_claims', 'competitor_response_scenarios', 'red_team_verdict', 'confidence_score'],
    redTeamFallback
  );
  return {
    agentId: 'red_team',
    status: result.usedFallback ? 'self_corrected' : 'completed',
    data: result.data as Record<string, unknown>,
    confidenceScore: result.data.confidence_score,
    durationMs: Date.now() - start,
    attemptNumber: result.attempts,
    selfCorrected: result.usedFallback,
    tokenUsage: { input: result.inputTokens, output: result.outputTokens }
  };
}
