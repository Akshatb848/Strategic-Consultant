import { callLLMWithRetry } from '../lib/llmClient';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION } from './masterPrompt';
import type { AgentInput, StrategistOutput, AgentOutput } from './types';

const STRATEGIST_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Strategist Node — Chief of Staff of the ASIS pipeline.
YOUR ROLE: Apply the Minto Pyramid Principle to decompose the problem into 
a MECE Issue Tree, then assign precise tasks to downstream worker nodes.

METHODOLOGY:
1. Extract context: Who is the client? What is the exact decision they face?
   What industry, geography, company stage, and time horizon?
2. Apply MECE decomposition: Break the problem into 3-5 branches that are
   Mutually Exclusive (no overlap) and Collectively Exhaustive (cover all angles)
3. Map each branch to a specialist agent with a scoped research mandate
4. Generate 3 falsifiable hypotheses — claims that downstream agents must verify or reject
5. Define success criteria with measurable KPIs

DECISION TYPE TAXONOMY:
  - INVEST: "Should we allocate capital to X?"
  - DIVEST: "Should we exit/sell X?"
  - RESTRUCTURE: "How do we reorganise for Y outcome?"
  - ENTER: "Should we enter market/segment Z?"
  - EXIT: "Should we leave market/segment Z?"
  - DEFEND: "How do we protect our position against X?"
  - ACQUIRE: "Should we acquire / merge with X?"
  - TRANSFORM: "How do we reinvent our business model for X?"

${CONFIDENCE_FORMULA_INSTRUCTION}

Return ONLY this exact JSON structure (no other text):
{
  "problem_decomposition": ["MECE sub-problem 1", "MECE sub-problem 2", "MECE sub-problem 3", "MECE sub-problem 4"],
  "mece_tree": [
    { "label": "Branch label", "sub_questions": ["Q1", "Q2"], "assigned_agent": "market_intel" }
  ],
  "analytical_framework": "Framework name — one-sentence rationale",
  "agent_assignments": {
    "quant": "Specific mandate: model 3 investment scenarios using McKinsey 3 Horizons with NPV/IRR at 10% discount rate",
    "market_intel": "Specific mandate: map regulatory landscape for [extracted industry/geography] using PESTLE + Porter's Five Forces",
    "risk": "Specific mandate: build COSO ERM 2017 risk register with severity scores for regulatory, cyber, talent dimensions",
    "red_team": "Specific mandate: attempt to invalidate the Quant's ROI projections using Accenture/competitor response scenarios",
    "ethicist": "Specific mandate: assess brand, ESG, and cultural fit implications for [extracted org]",
    "synthesis": "Specific mandate: integrate all agent outputs into Balanced Scorecard and phased roadmap"
  },
  "key_hypotheses": ["Hypothesis 1: falsifiable claim", "Hypothesis 2: falsifiable claim", "Hypothesis 3: falsifiable claim"],
  "success_criteria": ["Criterion 1: specific KPI with baseline and target", "Criterion 2: specific KPI with baseline and target"],
  "decision_type": "INVEST|DIVEST|RESTRUCTURE|ENTER|EXIT|DEFEND|ACQUIRE|TRANSFORM",
  "confidence_score": [CALCULATED INTEGER],
  "strategic_priority": "CRITICAL|HIGH|MEDIUM|LOW",
  "time_horizon": "X-Y years",
  "context": { "org": "Extracted organisation name or 'Unspecified'", "industry": "Extracted industry or 'Unspecified'", "geography": "Extracted geography or 'Global'" }
}
`;

const strategistFallback: StrategistOutput = {
  problem_decomposition: ["Market and regulatory landscape assessment", "Financial viability and investment return analysis", "Risk quantification and mitigation planning", "Competitive positioning and strategic fit"],
  mece_tree: [
    { label: "Market Context", sub_questions: ["What is the competitive landscape?", "What are the regulatory requirements?"], assigned_agent: 'market_intel' },
    { label: "Financial Analysis", sub_questions: ["What is the NPV of investment?", "What are the risk-adjusted returns?"], assigned_agent: 'quant' },
    { label: "Risk Assessment", sub_questions: ["What are the critical risks?", "How should they be mitigated?"], assigned_agent: 'risk' },
  ],
  analytical_framework: "Minto Pyramid Principle + MECE Decomposition + COSO ERM 2017",
  agent_assignments: {
    quant: "Model 3 investment scenarios using McKinsey Three Horizons with NPV/IRR at 10% discount rate",
    market_intel: "Map regulatory landscape using PESTLE + Porter's Five Forces",
    risk: "Build COSO ERM 2017 risk register with severity scores",
    red_team: "Attempt to invalidate ROI projections using competitor response scenarios",
    ethicist: "Assess brand, ESG, and cultural fit implications",
    synthesis: "Integrate all outputs into Balanced Scorecard and phased roadmap"
  },
  key_hypotheses: ["The market opportunity is real and quantifiable", "The financial returns justify the investment", "The risks are manageable with proper mitigation"],
  success_criteria: ["KPI: Compliance score from baseline to target within timeline", "KPI: ROI > threshold within 3 years"],
  decision_type: "INVEST",
  confidence_score: 68,
  strategic_priority: "MEDIUM",
  time_horizon: "3-5 years",
  context: { org: "Unspecified", industry: "Unspecified", geography: "Global" }
};

export async function runStrategistAgent(input: AgentInput): Promise<AgentOutput> {
  const start = Date.now();
  const userMessage = `
${input.semanticMemoryContext ? `${input.semanticMemoryContext}\n` : ''}Analyse this strategic problem:
"${input.problemStatement}"

Context detected:
- Organisation: ${input.organisationContext || 'Unspecified'}
- Industry: ${input.industryContext || 'Unspecified'}
- Geography: ${input.geographyContext || 'Unspecified'}

Apply Minto Pyramid MECE decomposition. Return ONLY valid JSON.
  `;
  const result = await callLLMWithRetry<StrategistOutput>(
    STRATEGIST_SYSTEM_PROMPT,
    userMessage,
    ['problem_decomposition', 'agent_assignments', 'key_hypotheses', 'confidence_score'],
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
