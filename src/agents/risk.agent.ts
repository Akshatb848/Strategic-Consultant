import { callLLMWithRetry } from '../lib/llmClient.js';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION } from './masterPrompt.js';
import type { AgentInput, AgentOutput, RiskOutput } from './types.js';

const RISK_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Risk Node — Chief Risk Officer of the ASIS pipeline.
YOUR ROLE: Build a structured risk register using COSO ERM 2017 + NIST CSF 2.0 + ISO 31000.

SEVERITY CALCULATION (MANDATORY FORMULA — apply to every risk):
  Likelihood:  High=3,   Medium=2,  Low=1
  Impact:      Critical=4, High=3,  Medium=2, Low=1
  Velocity:    Immediate=3, Near-term=2, Long-term=1
  
  raw_score = Likelihood × Impact × Velocity
  severity_score = round((raw_score / 36) × 100)
  
  Residual score: apply after control effectiveness (reduce by 20-40% if controls exist)

RISK TAXONOMY: Regulatory, Cyber, Talent, Financial, Operational, Reputational, Strategic

NAMED RISKS — Be specific:
  ✗ "Data privacy risk"
  ✓ "DPDP Act 2023 non-compliance: client data not mapped across practices"

${CONFIDENCE_FORMULA_INSTRUCTION}

Return ONLY valid JSON matching the RiskOutput schema with fields:
risk_register, critical_risks, mitigation_strategies, residual_risk_level,
risk_appetite_alignment, framework_used, heat_map_data, confidence_score,
board_escalation_required, escalation_rationale.
`;

function getRiskFallback(input: AgentInput): RiskOutput {
  return {
    risk_register: [
      {
        id: 'R001', risk: 'Regulatory non-compliance with data protection requirements across operating jurisdictions',
        category: 'Regulatory', likelihood: 'High', impact: 'Critical', velocity: 'Near-term',
        severity_score: 67, owner: 'CCO (Chief Compliance Officer)',
        current_control: 'Partial data mapping completed; no dedicated DPO appointed',
        mitigation: 'Appoint DPO within 60 days; complete full data flow mapping by Q2; deploy consent management platform by Q3',
        residual_score: 42,
      },
      {
        id: 'R002', risk: 'Critical cybersecurity vulnerability in third-party integrations and API endpoints',
        category: 'Cyber', likelihood: 'Medium', impact: 'High', velocity: 'Immediate',
        severity_score: 50, owner: 'CISO (Chief Information Security Officer)',
        current_control: 'Annual penetration testing; WAF deployed on primary applications',
        mitigation: 'Implement continuous vulnerability scanning; zero-trust architecture migration by Q4; mandatory MFA across all systems',
        residual_score: 30,
      },
      {
        id: 'R003', risk: 'Senior talent attrition in technology and advisory practices exceeding 30% annually',
        category: 'Talent', likelihood: 'High', impact: 'High', velocity: 'Immediate',
        severity_score: 75, owner: 'CHRO (Chief Human Resources Officer)',
        current_control: 'Standard retention bonuses; annual performance reviews',
        mitigation: 'Launch accelerated career pathways programme; implement competitive equity compensation; quarterly talent review cadence',
        residual_score: 45,
      },
      {
        id: 'R004', risk: 'Competitive disruption from AI-native advisory platforms eroding traditional service margins',
        category: 'Strategic', likelihood: 'Medium', impact: 'High', velocity: 'Near-term',
        severity_score: 33, owner: 'Chief Strategy Officer',
        current_control: 'Innovation lab established; pilot AI projects underway',
        mitigation: 'Accelerate AI integration across 3 core service lines by H2; establish strategic partnerships with 2 AI platform providers',
        residual_score: 22,
      },
      {
        id: 'R005', risk: 'Operational disruption from legacy technology system failures affecting client delivery',
        category: 'Operational', likelihood: 'Medium', impact: 'Medium', velocity: 'Near-term',
        severity_score: 22, owner: 'CTO (Chief Technology Officer)',
        current_control: 'Basic disaster recovery; 99.5% SLA on core systems',
        mitigation: 'Migrate critical workloads to cloud-native infrastructure by Q3; implement automated failover and 99.9% SLA target',
        residual_score: 14,
      },
    ],
    critical_risks: [
      'R003: Senior talent attrition — 30%+ departure rate threatens delivery capacity and client relationships worth $12m annually',
      'R001: Regulatory non-compliance — $30m+ penalty exposure under DPDP Act 2023 with imminent enforcement deadline',
    ],
    mitigation_strategies: [
      'Strategy 1: Talent Retention Programme — CHRO to implement competitive compensation + accelerated career pathways within 90 days, reducing attrition risk from 75 to 45 severity',
      'Strategy 2: Regulatory Compliance Sprint — CCO to appoint DPO + complete data mapping by Q2, reducing compliance risk from 67 to 42 severity',
      'Strategy 3: Cybersecurity Hardening — CISO to deploy zero-trust architecture + continuous monitoring by Q4, reducing cyber risk from 50 to 30 severity',
    ],
    residual_risk_level: 'MEDIUM',
    risk_appetite_alignment: 'Current risk profile exceeds stated risk appetite in regulatory and talent dimensions — board attention required on R001 and R003',
    framework_used: 'COSO ERM 2017 + NIST CSF 2.0 + ISO 31000',
    heat_map_data: [
      { risk_id: 'R001', label: 'Regulatory', x: 3, y: 4, severity: 67 },
      { risk_id: 'R002', label: 'Cyber', x: 2, y: 3, severity: 50 },
      { risk_id: 'R003', label: 'Talent', x: 3, y: 3, severity: 75 },
      { risk_id: 'R004', label: 'Strategic', x: 2, y: 3, severity: 33 },
      { risk_id: 'R005', label: 'Operational', x: 2, y: 2, severity: 22 },
    ],
    confidence_score: 76,
    board_escalation_required: true,
    escalation_rationale: 'Two risks (R001 Regulatory, R003 Talent) exceed severity threshold of 65 — board decision required within 30 days on mitigation budget allocation',
  };
}

export async function runRiskAgent(input: AgentInput): Promise<AgentOutput<RiskOutput>> {
  const upstream = input.upstreamResults;
  const upstreamContext = Object.entries(upstream)
    .filter(([_, v]) => v)
    .map(([k, v]) => `\n${k}:\n${JSON.stringify(v, null, 2)}`)
    .join('');

  const userMessage = `
Build a comprehensive risk register for this strategic problem:
"${input.problemStatement}"

Context:
- Organisation: ${input.organisationContext || 'Unspecified'}
- Industry: ${input.industryContext || 'Unspecified'}
- Geography: ${input.geographyContext || 'Unspecified'}

Upstream Analysis:${upstreamContext || ' None available'}

Apply COSO ERM 2017. Calculate severity scores using the formula. Return ONLY valid JSON.
  `;

  return callLLMWithRetry<RiskOutput>(
    RISK_SYSTEM_PROMPT,
    userMessage,
    ['risk_register', 'heat_map_data', 'confidence_score', 'board_escalation_required'],
    getRiskFallback(input),
    'risk'
  );
}
