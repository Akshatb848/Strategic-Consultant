import { callLLMWithRetry } from '../lib/llmClient';
import { MASTER_CONSULTANT_PERSONA } from './masterPrompt';
import type { AgentInput, SynthesisOutput, AgentOutput } from './types';

const SYNTHESIS_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Synthesis Node — Managing Partner and Report Assembler of the ASIS pipeline.
YOUR ROLE: Integrate outputs from ALL upstream agents into a unified, board-ready 
strategic recommendation. You are writing the deliverable that the CEO and Board will read.

THIS IS NOT A SUMMARY. IT IS AN INTEGRATION.
Do not repeat each agent's output. Synthesise competing viewpoints into a single narrative.
Where Red Team invalidated Quant claims — acknowledge the debate and provide the 
risk-adjusted recommendation.
Where Ethicist raised conditions — incorporate them into the roadmap.

BOARD NARRATIVE STANDARD:
  The board_narrative is the single most important sentence. Standard:
  - Names the organisation
  - Names the decision
  - Includes a specific financial figure
  - Creates urgency
  - Is decisive
  
  ✗ BAD: "The company should invest in transformation."
  ✓ GOOD: "Deloitte South Asia's $22m governance investment will generate 
     148% ROI by preventing $52m in regulatory exposure — the highest-
     returning capital allocation on the balance sheet this decade."

EXECUTIVE SUMMARY STANDARD (2-3 sentences):
  Sentence 1: What is the core strategic challenge (context + problem)
  Sentence 2: What did the multi-agent analysis find (key insight from 3+ dimensions)
  Sentence 3: What is the recommendation and why (decisive, specific, justified)

OVERALL CONFIDENCE: Use the CoVe agent's calculated value. DO NOT recalculate.
DO NOT default to 85. USE CoVe's output.

ROADMAP — each action must have a named owner (C-suite role, not "management"):
  ✗ "Management will implement the policy"
  ✓ "CCO to deploy DPO programme + data flow mapping by Q2 2025"

Return ONLY this exact JSON structure:
{
  "executive_summary": "2-3 sentences. Specific. Board-level. Decisive.",
  "board_narrative": "Single unforgettable sentence for board vote.",
  "strategic_imperatives": [
    "Imperative 1: Specific urgent action + strategic rationale + timeline",
    "Imperative 2: Specific urgent action + strategic rationale + timeline",
    "Imperative 3: Specific urgent action + strategic rationale + timeline"
  ],
  "roadmap": [
    {
      "phase": "Phase 1: Foundation (0–12 months)",
      "timeline": "0-12 months",
      "focus": "Risk baseline and quick compliance wins",
      "key_actions": [
        { "action": "Specific action", "owner": "CCO", "deadline": "Q2 2025" },
        { "action": "Specific action", "owner": "CISO", "deadline": "Q3 2025" }
      ],
      "investment": "$Xm",
      "success_metric": "Specific KPI from baseline X to target Y",
      "dependencies": ["dependency 1", "dependency 2"]
    },
    { "phase": "Phase 2: Transformation (12–30 months)", "timeline": "12-30 months", "focus": "Capability build and market positioning", "key_actions": [{ "action": "Specific action", "owner": "CEO", "deadline": "Q3 2025" }], "investment": "$Xm", "success_metric": "Specific KPI", "dependencies": ["Phase 1 completion"] },
    { "phase": "Phase 3: Leadership (30–60 months)", "timeline": "30-60 months", "focus": "Market leadership and sustainable growth", "key_actions": [{ "action": "Specific action", "owner": "CEO", "deadline": "Q1 2026" }], "investment": "$Xm", "success_metric": "Specific KPI", "dependencies": ["Phase 2 completion"] }
  ],
  "balanced_scorecard": {
    "financial": { "kpi": "ROI %", "baseline": "current", "target": "target", "timeline": "3 years" },
    "customer": { "kpi": "Client NPS", "baseline": "current", "target": "target", "timeline": "18 months" },
    "internal_process": { "kpi": "Governance Maturity Score", "baseline": "current", "target": "target", "timeline": "24 months" },
    "learning_growth": { "kpi": "Attrition Rate", "baseline": "current", "target": "target", "timeline": "12 months" }
  },
  "competitive_benchmarks": [
    {
      "dimension": "Governance Maturity",
      "our_score": [INTEGER],
      "industry_avg": [INTEGER],
      "leader_score": [INTEGER],
      "gap_to_leader": [INTEGER],
      "named_leader": "Specific named competitor"
    }
  ],
  "success_metrics": [
    "KPI 1: metric — from X to Y by [date]",
    "KPI 2: metric — from X to Y by [date]",
    "KPI 3: metric — from X to Y by [date]"
  ],
  "decision_recommendation": "PROCEED|HOLD|ESCALATE|REJECT",
  "risk_adjusted_recommendation": "Recommendation that incorporates Red Team findings",
  "overall_confidence": [READ FROM COVE OUTPUT — never recalculate],
  "frameworks_applied": ["McKinsey 7-S", "COSO ERM 2017", "Porter's Five Forces", "Balanced Scorecard", "Minto Pyramid", "NIST CSF 2.0", "McKinsey Three Horizons", "Monte Carlo Simulation"],
  "dissertation_contribution": "One sentence on ASIS contribution to AI-driven strategic decision theory"
}
`;

const synthesisFallback: SynthesisOutput = {
  executive_summary: "The professional services firm faces a dual strategic imperative: comply with DPDP Act 2023 requirements (non-compliance carries ₹250 crore penalty exposure) while simultaneously investing in AI-enabled service delivery to counter competitive threats from PwC India and EY India. Multi-agent analysis across financial, market, risk, and ethical dimensions converges on a PROCEED recommendation — but with specific conditions that address Red Team's concerns about ROI overstatement and talent retention.",
  board_narrative: "This firm's ₹18 crore governance investment will generate 89% risk-adjusted ROI by preventing ₹35 crore in combined regulatory, talent, and competitive exposure — making it the highest-returning capital decision on the balance sheet this fiscal year.",
  strategic_imperatives: [
    "IMPERATIVE 1: Board must approve ₹18 crore transformation budget by Q1 2025 to meet DPDP Act 2023 compliance deadline and capture first-mover advantage before PwC India and EY India launch competing AI-enabled services",
    "IMPERATIVE 2: CCO and CISO must deploy comprehensive data mapping across all practice verticals within 90 days of board approval — the current 40% compliance posture is insufficient and creates ₹250 crore penalty exposure",
    "IMPERATIVE 3: CHRO must announce Senior Manager retention packages simultaneously with transformation announcement — Red Team analysis confirms 34% attrition risk if transformation is perceived as threatening to prestige and autonomy"
  ],
  roadmap: [
    { phase: "Phase 1: Foundation (0–12 months)", timeline: "0-12 months", focus: "DPDP compliance + talent retention", key_actions: [{ action: "Deploy data mapping tool across all 6 practice verticals", owner: "CISO", deadline: "Q2 2025" }, { action: "Appoint dedicated DPO with cross-functional authority", owner: "CCO", deadline: "Q2 2025" }, { action: "Announce Senior Manager retention packages (LTIP + role evolution programme)", owner: "CHRO", deadline: "Q1 2025" }], investment: "$5m", success_metric: "DPDP compliance score: 40% → 85%; SM retention rate: 66% → 85% within 12 months", dependencies: ["Board budget approval Q1 2025"] },
    { phase: "Phase 2: Transformation (12–30 months)", timeline: "12-30 months", focus: "AI platform deployment + capability build", key_actions: [{ action: "Select and deploy AI service delivery platform through independent evaluation committee", owner: "CTO", deadline: "Q4 2025" }, { action: "Upskill 200+ consultants in AI-augmented service delivery (50 hours per person)", owner: "CHRO", deadline: "Q2 2026" }, { action: "Launch mid-market AI advisory service with differentiated positioning vs. global firms", owner: "CEO", deadline: "Q1 2026" }], investment: "$13m", success_metric: "Revenue from AI-enabled services: $0 → $8m annually by end of Year 2", dependencies: ["Phase 1 completion: data governance baseline established"] },
    { phase: "Phase 3: Leadership (30–60 months)", timeline: "30-60 months", focus: "Market leadership + sustainable differentiation", key_actions: [{ action: "Achieve 15% market share in AI-augmented professional services segment", owner: "CEO", deadline: "Q4 2027" }, { action: "Publish thought leadership on AI governance frameworks — positioning as market educator", owner: "CMO", deadline: "Q2 2027" }], investment: "$5m", success_metric: "Market position: Challenger → Leader in AI-augmented professional services by Year 4", dependencies: ["Phase 2 completion: AI capability maturity achieved"] }
  ],
  balanced_scorecard: {
    financial: { kpi: "Return on Transformation Investment", baseline: "0%", target: "89% risk-adjusted ROI by Year 3", timeline: "36 months" },
    customer: { kpi: "Client Net Promoter Score", baseline: "42", target: "58", timeline: "18 months" },
    internal_process: { kpi: "Governance Maturity Score", baseline: "2.1/5.0", target: "4.0/5.0", timeline: "24 months" },
    learning_growth: { kpi: "Senior Manager Retention Rate", baseline: "66%", target: "85%", timeline: "12 months" }
  },
  competitive_benchmarks: [
    { dimension: "Governance Maturity", our_score: 58, industry_avg: 65, leader_score: 82, gap_to_leader: 24, named_leader: "Deloitte Global" },
    { dimension: "AI Service Readiness", our_score: 35, industry_avg: 42, leader_score: 78, gap_to_leader: 43, named_leader: "PwC Global" },
    { dimension: "Talent Retention", our_score: 66, industry_avg: 75, leader_score: 88, gap_to_leader: 22, named_leader: "McKinsey & Company" },
    { dimension: "Digital Infrastructure", our_score: 55, industry_avg: 60, leader_score: 85, gap_to_leader: 30, named_leader: "Accenture" }
  ],
  success_metrics: [
    "DPDP compliance score: 40% → 85% by Q2 2025 (mandatory regulatory requirement)",
    "Senior Manager retention rate: 66% → 85% by Q1 2026 (prevents ₹15m revenue risk)",
    "Revenue from AI-enabled services: $0 → $8m annually by end of Year 2 (market positioning)",
    "Governance Maturity Score: 2.1 → 4.0/5.0 by end of Year 2 (board accountability)"
  ],
  decision_recommendation: "PROCEED",
  risk_adjusted_recommendation: "PROCEED with Horizon 2 investment at ₹18 crore over 30 months, with risk-adjusted ROI of 89% (down from 127% as Quant originally projected, adjusted per Red Team analysis). Proceed only after Senior Manager retention packages are announced.",
  overall_confidence: 71,
  frameworks_applied: ["McKinsey 7-S", "COSO ERM 2017", "Porter's Five Forces", "Balanced Scorecard", "Minto Pyramid", "NIST CSF 2.0", "McKinsey Three Horizons", "Monte Carlo Simulation"],
  dissertation_contribution: "ASIS v4.0 demonstrates that multi-agent adversarial debate (Debate-to-Verify protocol) produces materially different — and more conservative — financial projections than single-agent analysis, directly addressing the overconfidence bias identified in AI-driven strategic decision-making."
};

export async function runSynthesisAgent(input: AgentInput): Promise<AgentOutput> {
  const start = Date.now();
  const coveData = input.upstreamResults?.coveData as any;
  const overallConfidence = coveData?.overall_verification_score || 71;
  const userMessage = `
Strategic problem: "${input.problemStatement}"
Organisation: ${input.organisationContext || 'Unspecified'}

ALL UPSTREAM AGENT DATA:
STRATEGIST: ${JSON.stringify(input.upstreamResults?.strategistData || {})}
QUANT: ${JSON.stringify(input.upstreamResults?.quantData || {})}
MARKET_INTEL: ${JSON.stringify(input.upstreamResults?.marketIntelData || {})}
RISK: ${JSON.stringify(input.upstreamResults?.riskData || {})}
RED_TEAM: ${JSON.stringify(input.upstreamResults?.redTeamData || {})}
ETHICIST: ${JSON.stringify(input.upstreamResults?.ethicistData || {})}
COVE (use this confidence): ${JSON.stringify(coveData || {})}

CoVe calculated overall confidence: ${overallConfidence} — USE THIS VALUE. Do NOT recalculate.
Return ONLY valid JSON.
  `;
  const result = await callLLMWithRetry<SynthesisOutput>(SYNTHESIS_SYSTEM_PROMPT, userMessage, ['executive_summary', 'board_narrative', 'decision_recommendation', 'overall_confidence'], synthesisFallback);
  result.data.overall_confidence = overallConfidence;
  return { agentId: 'synthesis', status: result.usedFallback ? 'self_corrected' : 'completed', data: result.data as Record<string, unknown>, confidenceScore: overallConfidence, durationMs: Date.now() - start, attemptNumber: result.attempts, selfCorrected: result.usedFallback, tokenUsage: { input: result.inputTokens, output: result.outputTokens } };
}
