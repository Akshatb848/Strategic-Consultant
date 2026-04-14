import { callLLMWithRetry } from '../lib/llmClient.js';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION } from './masterPrompt.js';
import type { AgentInput, AgentOutput, StrategistOutput } from './types.js';
import { defaultConfidence } from './confidence.js';

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

DECISION TYPE TAXONOMY (identify which applies):
  - INVEST: "Should we allocate capital to X?"
  - DIVEST: "Should we exit/sell X?"
  - RESTRUCTURE: "How do we reorganise for Y outcome?"
  - ENTER: "Should we enter market/segment Z?"
  - EXIT: "Should we leave market/segment Z?"
  - DEFEND: "How do we protect our position against X?"
  - ACQUIRE: "Should we acquire / merge with X?"
  - TRANSFORM: "How do we reinvent our business model for X?"

DECISION TYPE DETECTION - ACQUIRE TRIGGER:
When the problem statement contains any of these signals, set decision_type = "ACQUIRE":
  - "acquire", "acquisition", "buy", "purchase", "takeover", "M&A", "merger"
  - "invest in [company]", "take a stake in", "absorb", "integrate [company]"

When decision_type === "ACQUIRE", add this mandatory field:
"acquisition_prerequisites": {
  "build_vs_buy_required": true,
  "key_person_risk": "Identify by name or role the 3-5 individuals whose departure would destroy the acquisition's value proposition",
  "ip_portability": "Is the competitive advantage in the technology or the people?",
  "client_relationship_transfer": "What percentage of revenue is relationship-dependent versus product-dependent?",
  "integration_complexity": "HIGH | MEDIUM | LOW",
  "board_questions_to_answer": [
    "Why can we not hire the capability for 7-15x less than acquisition cost?",
    "What is our key person agreement strategy pre-close?",
    "What is our integration model - absorb into practice or operate independently?",
    "What is our exit plan if key talent departs within 18 months?"
  ]
}

${CONFIDENCE_FORMULA_INSTRUCTION}

Return ONLY this exact JSON structure (no other text):
{
  "problem_decomposition": ["Sub-problem 1", "Sub-problem 2", "Sub-problem 3", "Sub-problem 4"],
  "mece_tree": [
    { "label": "Branch label", "sub_questions": ["Q1", "Q2"], "assigned_agent": "market_intel" }
  ],
  "analytical_framework": "Framework name — rationale",
  "agent_assignments": {
    "quant": "Specific mandate for quant agent",
    "market_intel": "Specific mandate for market intel agent",
    "risk": "Specific mandate for risk agent",
    "red_team": "Specific mandate for red team agent",
    "ethicist": "Specific mandate for ethicist agent",
    "synthesis": "Specific mandate for synthesis agent"
  },
  "key_hypotheses": ["H1", "H2", "H3"],
  "success_criteria": ["Criterion 1", "Criterion 2", "Criterion 3"],
  "decision_type": "INVEST|DIVEST|RESTRUCTURE|ENTER|EXIT|DEFEND|ACQUIRE|TRANSFORM",
  "confidence_score": 0,
  "strategic_priority": "CRITICAL|HIGH|MEDIUM|LOW",
  "time_horizon": "X-Y years",
  "context": { "org": "", "industry": "", "geography": "" },
  "acquisition_prerequisites": {
    "build_vs_buy_required": true,
    "key_person_risk": "",
    "ip_portability": "",
    "client_relationship_transfer": "",
    "integration_complexity": "HIGH|MEDIUM|LOW",
    "board_questions_to_answer": []
  }
}
`;

function getStrategistFallback(input: AgentInput): StrategistOutput {
  const inferredAcquire =
    input.decisionType === 'ACQUIRE' ||
    /(acquire|acquisition|buy|purchase|takeover|merger|stake)/i.test(input.problemStatement);

  return {
    problem_decomposition: [
      `Market opportunity assessment for ${input.organisationContext || 'the organisation'}`,
      `Financial viability and ROI analysis for the strategic initiative`,
      `Risk landscape mapping across regulatory, operational, and competitive dimensions`,
      `Organisational readiness and capability gap assessment`,
    ],
    mece_tree: [
      { label: 'Market & Competitive Position', sub_questions: ['What is the market size?', 'Who are key competitors?'], assigned_agent: 'market_intel' },
      { label: 'Financial Viability', sub_questions: ['What is the expected ROI?', 'What are the investment scenarios?'], assigned_agent: 'quant' as any },
      { label: 'Risk Exposure', sub_questions: ['What regulatory risks exist?', 'What are the operational risks?'], assigned_agent: 'risk' },
    ],
    analytical_framework: 'Minto Pyramid + McKinsey 7-S — structured decomposition with organisational alignment assessment',
    agent_assignments: {
      quant: 'Model 3 investment scenarios using McKinsey 3 Horizons with NPV/IRR at 10% discount rate',
      market_intel: 'Map regulatory and competitive landscape using PESTLE + Porter\'s Five Forces',
      risk: 'Build COSO ERM 2017 risk register with severity scores',
      red_team: 'Attempt to invalidate Quant ROI projections and competitive assumptions',
      ethicist: 'Assess brand, ESG, and cultural fit implications',
      synthesis: 'Integrate all agent outputs into Balanced Scorecard and phased roadmap',
    },
    key_hypotheses: [
      `The ${input.industryContext || 'target'} market presents a viable growth opportunity with defensible positioning`,
      `The financial investment will generate positive NPV within 36 months at a 10% hurdle rate`,
      `Regulatory and competitive risks can be mitigated to acceptable residual levels`,
    ],
    success_criteria: [
      'Achieve positive NPV within 3 years of implementation',
      'Maintain risk severity below "HIGH" threshold across all categories',
      'Secure regulatory compliance across all applicable jurisdictions within 12 months',
    ],
    decision_type: inferredAcquire ? 'ACQUIRE' : input.decisionType || 'INVEST',
    confidence_score: defaultConfidence('strategist', input.problemStatement),
    strategic_priority: 'HIGH',
    time_horizon: '3-5 years',
    context: {
      org: input.organisationContext || 'Unspecified',
      industry: input.industryContext || 'Unspecified',
      geography: input.geographyContext || 'Global',
    },
    acquisition_prerequisites: inferredAcquire
      ? {
          build_vs_buy_required: true,
          key_person_risk:
            'Key-person concentration must identify the 3-5 leaders whose departure would erase client transfer, product continuity, or domain credibility.',
          ip_portability:
            'Test whether value resides in portable workflow IP and contracted software assets or in a small founder-led expert group that may leave after close.',
          client_relationship_transfer:
            'Model how much revenue is relationship-led versus platform-led before paying an acquisition premium.',
          integration_complexity: 'HIGH',
          board_questions_to_answer: [
            'Why can the capability not be hired or licensed for materially less than the acquisition premium?',
            'What pre-close retention instruments secure the top revenue and product leaders?',
            'Will the target remain ring-fenced, or be absorbed into the existing practice model?',
            'What is the downside plan if the top team leaves inside 18 months?',
          ],
        }
      : undefined,
  };
}

export async function runStrategistAgent(input: AgentInput): Promise<AgentOutput<StrategistOutput>> {
  const userMessage = `
Analyse this strategic problem:
"${input.problemStatement}"

Context detected:
- Organisation: ${input.organisationContext || 'Unspecified'}
- Industry: ${input.industryContext || 'Unspecified'}
- Geography: ${input.geographyContext || 'Unspecified'}
- Decision Type: ${input.decisionType || 'To be determined'}

Apply Minto Pyramid MECE decomposition. Return ONLY valid JSON.
  `;

  const result = await callLLMWithRetry<StrategistOutput>(
    STRATEGIST_SYSTEM_PROMPT,
    userMessage,
    ['problem_decomposition', 'agent_assignments', 'key_hypotheses', 'confidence_score'],
    getStrategistFallback(input),
    'strategist'
  );

  return result;
}
