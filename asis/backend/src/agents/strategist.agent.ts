import { callLLMWithRetry } from '../lib/llmClient';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION, CITATION_FORMAT_INSTRUCTION } from './masterPrompt';
import type { AgentInput, StrategistOutput, AgentOutput } from './types';

const STRATEGIST_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Strategist/Orchestrator Node — Chief of Staff of the ASIS pipeline.
YOUR ROLE: 
1. Extract a structured company profile from the query (revenue tier, scale, sector)
2. Apply Minto Pyramid MECE decomposition to scope the problem
3. Produce SWOT, Ansoff Matrix, McKinsey 7-S skeleton for downstream agents
4. Assign precise, scoped mandates to each worker node

COMPANY PROFILE EXTRACTION (MANDATORY FIRST STEP):
From the problem statement, extract or infer:
  name: exact company/organisation name (or "Unspecified")
  estimated_revenue_usd: best estimate from known public data or "Unspecified"
  revenue_tier: MEGA_CAP ($50B+) | LARGE_CAP ($5B–$50B) | MID_CAP ($500m–$5B) | SME (<$500m) | UNSPECIFIED
  ebitda_margin_pct: integer estimate, or null
  market_cap_usd: known market cap or "Unspecified"
  headquarters: city, country
  primary_sector: specific sector (not just "Technology" but "AI Services / Enterprise SaaS")
  key_subsidiaries_or_divisions: list of named subsidiaries relevant to the decision (e.g. JioAI, Reliance Retail)

DECISION TYPE TAXONOMY:
  INVEST | DIVEST | RESTRUCTURE | ENTER | EXIT | DEFEND | ACQUIRE | TRANSFORM

ACQUIRE DECISION — MANDATORY ADDITIONAL FIELDS:
If decision_type is ACQUIRE, populate acquisition_prerequisites.

SWOT ANALYSIS (generate for the specific company — never generic):
  Strengths: capabilities/assets the company actually has (named products, market positions, revenue figures)
  Weaknesses: real documented gaps (attrition rates, legacy systems, geographic concentration)
  Opportunities: named market opportunities with size estimates
  Threats: named competitors with specific competitive actions, named regulations

ANSOFF MATRIX — Place the recommended strategy in the correct quadrant:
  Market Penetration: existing products, existing markets
  Market Development: existing products, new markets
  Product Development: new products, existing markets
  Diversification: new products, new markets
  Include: current_position and recommended_move with strategic rationale

McKINSEY 7-S FRAMEWORK (diagnose the organisation's alignment):
  Strategy, Structure, Systems, Shared Values, Style, Staff, Skills
  For each element: current_state (brief), alignment_with_decision (Aligned|Misaligned|Neutral)

${CONFIDENCE_FORMULA_INSTRUCTION}
${CITATION_FORMAT_INSTRUCTION}

Return ONLY this exact JSON structure:
{
  "company_profile": {
    "name": "string",
    "estimated_revenue_usd": "string",
    "revenue_tier": "MEGA_CAP|LARGE_CAP|MID_CAP|SME|UNSPECIFIED",
    "ebitda_margin_pct": null,
    "market_cap_usd": "string",
    "headquarters": "City, Country",
    "primary_sector": "Specific sector",
    "key_subsidiaries_or_divisions": ["Division 1", "Division 2"]
  },
  "problem_decomposition": ["MECE branch 1", "MECE branch 2", "MECE branch 3", "MECE branch 4"],
  "mece_tree": [
    { "label": "Branch label", "sub_questions": ["Q1", "Q2"], "assigned_agent": "market_intel" }
  ],
  "analytical_framework": "Framework name — one-sentence rationale",
  "agent_assignments": {
    "quant": "Specific mandate calibrated to company_profile.revenue_tier: model 3 investment scenarios at [TIER] scale",
    "market_intel": "Specific mandate: PESTLE + Porter's Five Forces for [extracted industry/geography]",
    "risk": "Specific mandate: COSO ERM 2017 risk register for [org] in [industry/geography]",
    "red_team": "Specific mandate: invalidate Quant ROI projections; name real competitors that will respond",
    "ethicist": "Specific mandate: VRIO capability assessment + Value Chain analysis + ESG for [org]",
    "synthesis": "Specific mandate: integrate all outputs with per-framework So What callouts"
  },
  "key_hypotheses": ["Hypothesis 1: falsifiable", "Hypothesis 2: falsifiable", "Hypothesis 3: falsifiable"],
  "success_criteria": ["KPI 1: metric baseline→target within timeline", "KPI 2"],
  "decision_type": "INVEST|DIVEST|RESTRUCTURE|ENTER|EXIT|DEFEND|ACQUIRE|TRANSFORM",
  "swot_analysis": {
    "strengths": ["Specific strength with named asset/metric", "Specific strength"],
    "weaknesses": ["Specific weakness with evidence", "Specific weakness"],
    "opportunities": ["Named opportunity with market size estimate", "Named opportunity"],
    "threats": ["Named competitor/regulation threat with timeline", "Named threat"]
  },
  "ansoff_matrix": {
    "current_position": "Market Penetration|Market Development|Product Development|Diversification",
    "recommended_move": "Market Penetration|Market Development|Product Development|Diversification",
    "rationale": "Why this quadrant — specific strategic logic",
    "risk_level": "Low|Medium|High",
    "expected_revenue_impact": "Estimated revenue uplift from this strategic move"
  },
  "mckinsey_7s": {
    "strategy": { "current_state": "string", "alignment_with_decision": "Aligned|Misaligned|Neutral" },
    "structure": { "current_state": "string", "alignment_with_decision": "Aligned|Misaligned|Neutral" },
    "systems": { "current_state": "string", "alignment_with_decision": "Aligned|Misaligned|Neutral" },
    "shared_values": { "current_state": "string", "alignment_with_decision": "Aligned|Misaligned|Neutral" },
    "style": { "current_state": "string", "alignment_with_decision": "Aligned|Misaligned|Neutral" },
    "staff": { "current_state": "string", "alignment_with_decision": "Aligned|Misaligned|Neutral" },
    "skills": { "current_state": "string", "alignment_with_decision": "Aligned|Misaligned|Neutral" }
  },
  "confidence_score": [CALCULATED INTEGER],
  "strategic_priority": "CRITICAL|HIGH|MEDIUM|LOW",
  "time_horizon": "X-Y years",
  "context": { "org": "string", "industry": "string", "geography": "string" },
  "acquisition_prerequisites": null,
  "citations": []
}
`;

const strategistFallback: StrategistOutput = {
  company_profile: {
    name: "Unspecified Organisation",
    estimated_revenue_usd: "Unspecified",
    revenue_tier: "UNSPECIFIED",
    ebitda_margin_pct: null,
    market_cap_usd: "Unspecified",
    headquarters: "Unspecified",
    primary_sector: "Unspecified",
    key_subsidiaries_or_divisions: [],
  },
  problem_decomposition: ["Market and regulatory landscape assessment", "Financial viability and investment return analysis", "Risk quantification and mitigation planning", "Competitive positioning and strategic fit"],
  mece_tree: [
    { label: "Market Context", sub_questions: ["What is the competitive landscape?", "What are the regulatory requirements?"], assigned_agent: 'market_intel' as const },
    { label: "Financial Analysis", sub_questions: ["What is the NPV of investment?", "What are the risk-adjusted returns?"], assigned_agent: 'quant' as const },
    { label: "Risk Assessment", sub_questions: ["What are the critical risks?", "How should they be mitigated?"], assigned_agent: 'risk' as const },
  ],
  analytical_framework: "Minto Pyramid Principle + MECE Decomposition — chosen for its board-communication clarity",
  agent_assignments: {
    quant: "Model 3 investment scenarios using McKinsey Three Horizons at SME scale ($1m–$20m)",
    market_intel: "Map regulatory landscape using PESTLE + Porter's Five Forces",
    risk: "Build COSO ERM 2017 risk register with severity scores",
    red_team: "Attempt to invalidate ROI projections using named competitor response scenarios",
    ethicist: "Assess VRIO capabilities, Porter's Value Chain, ESG implications",
    synthesis: "Integrate all outputs with per-framework So What callouts for board narrative"
  },
  key_hypotheses: ["The market opportunity is quantifiable and real for this specific sector", "The financial returns justify the investment at this organisation's scale", "The risks are manageable with appropriate mitigation measures"],
  success_criteria: ["KPI: Compliance score baseline→target within 12 months", "KPI: ROI > 10% hurdle rate within 3 years"],
  decision_type: "INVEST",
  swot_analysis: {
    strengths: ["Established market position", "Existing customer relationships"],
    weaknesses: ["Legacy system constraints", "Geographic concentration risk"],
    opportunities: ["Market growth in target segment", "Regulatory compliance advantage"],
    threats: ["Competitive response from established players", "Regulatory compliance burden"],
  },
  ansoff_matrix: {
    current_position: "Market Penetration",
    recommended_move: "Product Development",
    rationale: "Leveraging existing customer base with enhanced capabilities",
    risk_level: "Medium",
    expected_revenue_impact: "15–25% revenue uplift over 36 months",
  },
  mckinsey_7s: {
    strategy: { current_state: "Growth-focused with selective investment", alignment_with_decision: "Aligned" },
    structure: { current_state: "Functional hierarchy with business unit overlay", alignment_with_decision: "Neutral" },
    systems: { current_state: "Legacy ERP with point solutions", alignment_with_decision: "Misaligned" },
    shared_values: { current_state: "Customer-first, quality-driven", alignment_with_decision: "Aligned" },
    style: { current_state: "Collaborative but hierarchical decision-making", alignment_with_decision: "Neutral" },
    staff: { current_state: "Experienced leadership, talent gaps in digital", alignment_with_decision: "Misaligned" },
    skills: { current_state: "Strong in core domain, weak in AI/data capabilities", alignment_with_decision: "Misaligned" },
  },
  confidence_score: 62,
  strategic_priority: "MEDIUM",
  time_horizon: "3-5 years",
  context: { org: "Unspecified", industry: "Unspecified", geography: "Global" },
  acquisition_prerequisites: null,
  citations: [],
};

export async function runStrategistAgent(input: AgentInput): Promise<AgentOutput> {
  const start = Date.now();
  const userMessage = `
${input.semanticMemoryContext ? `${input.semanticMemoryContext}\n` : ''}Analyse this strategic problem:
"${input.problemStatement}"

Explicit context provided:
- Organisation: ${input.organisationContext || 'Extract from problem statement'}
- Industry: ${input.industryContext || 'Extract from problem statement'}
- Geography: ${input.geographyContext || 'Extract from problem statement'}

CRITICAL INSTRUCTIONS:
1. Extract company_profile from the problem statement using public knowledge
2. Generate company-specific SWOT (not generic — use named assets, real competitors, real regulations)
3. Generate Ansoff Matrix with the specific strategic move being analysed
4. Generate McKinsey 7-S for THIS specific organisation
5. In agent_assignments.quant: reference the revenue_tier you extracted
6. In agent_assignments.red_team: name 2-3 specific real competitors that will respond
7. If this is an ACQUIRE decision: populate acquisition_prerequisites

Return ONLY valid JSON. No markdown, no prose.
  `;
  const result = await callLLMWithRetry<StrategistOutput>(
    STRATEGIST_SYSTEM_PROMPT,
    userMessage,
    ['company_profile', 'problem_decomposition', 'agent_assignments', 'swot_analysis', 'ansoff_matrix', 'confidence_score'],
    strategistFallback
  );
  return {
    agentId: 'strategist',
    status: result.usedFallback ? 'self_corrected' : 'completed',
    data: result.data as Record<string, unknown>,
    confidenceScore: result.data.confidence_score,
    durationMs: Date.now() - start,
    attemptNumber: result.attempts,
    selfCorrected: result.usedFallback,
    tokenUsage: { input: result.inputTokens, output: result.outputTokens }
  };
}
