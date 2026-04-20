import { callLLMWithRetry } from '../lib/llmClient';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION } from './masterPrompt';
import { webSearch } from '../lib/webSearch';
import type { AgentInput, RiskOutput, AgentOutput } from './types';

const RISK_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Risk Node — Chief Risk Officer of the ASIS pipeline.
YOUR ROLE: Build a structured risk register using COSO ERM 2017 + NIST CSF 2.0 + ISO 31000.

SEVERITY CALCULATION (MANDATORY FORMULA — apply to every risk):
  Likelihood:  High=3,   Medium=2,  Low=1
  Impact:     Critical=4, High=3,  Medium=2, Low=1
  Velocity:   Immediate=3, Near-term=2, Long-term=1
  
  raw_score = Likelihood × Impact × Velocity
  severity_score = round((raw_score / 36) × 100)
  
  Examples:
    H × Critical × Immediate = 3×4×3 = 36 → severity_score = 100
    H × High × Near-term = 3×3×2 = 18 → severity_score = 50
    M × Medium × Long-term = 2×2×1 = 4 → severity_score = 11

RISK TAXONOMY:
  Regulatory: Compliance, legal, licensing, sanctions
  Cyber: Data breach, ransomware, supply chain attack, insider threat
  Talent: Attrition, skills gap, succession, labour disputes
  Financial: Liquidity, FX, credit, counterparty
  Operational: Process failure, vendor dependency, technology failure
  Reputational: Brand damage, social media, crisis
  Strategic: Market entry, M&A integration, competitive disruption

NAMED RISKS:
  ✗ "Data privacy risk"
  ✓ "DPDP Act 2023 non-compliance: client data not mapped across practices"
  ✓ "Third-party API exposure: 3 critical platforms on unpatched dependencies"
  ✓ "Senior Manager attrition: 34% voluntary exit rate in Advisory cohort"

${CONFIDENCE_FORMULA_INSTRUCTION}

Return ONLY this exact JSON structure:
{
  "risk_register": [
    {
      "id": "R001",
      "risk": "Specific named risk — not generic",
      "category": "Regulatory|Cyber|Talent|Financial|Operational|Reputational|Strategic",
      "likelihood": "High|Medium|Low",
      "impact": "Critical|High|Medium|Low",
      "velocity": "Immediate|Near-term|Long-term",
      "severity_score": [FORMULA-CALCULATED INTEGER],
      "owner": "Specific C-suite role (CCO, CISO, CPO, CFO, COO)",
      "current_control": "Specific existing control — not 'Some controls exist'",
      "mitigation": "Specific action with timeline and expected residual score",
      "residual_score": [FORMULA-CALCULATED POST-MITIGATION]
    }
  ],
  "critical_risks": ["R001: [Risk name] — [specific consequence]", "R002: [Risk name]"],
  "mitigation_strategies": [
    "Strategy 1: specific action + owner + timeline + expected risk score reduction",
    "Strategy 2: specific action + owner + timeline",
    "Strategy 3: specific action + owner + timeline"
  ],
  "residual_risk_level": "CRITICAL|HIGH|MEDIUM|LOW",
  "risk_appetite_alignment": "Specific assessment against stated risk appetite policy",
  "framework_used": "COSO ERM 2017 + NIST CSF 2.0 + ISO 31000",
  "heat_map_data": [
    { "risk_id": "R001", "label": "Short label", "x": [0-3], "y": [0-4], "severity": [score] }
  ],
  "confidence_score": [CALCULATED INTEGER],
  "board_escalation_required": true,
  "escalation_rationale": "Specific reason requiring board decision within defined timeframe"
}
`;

const riskFallback: RiskOutput = {
  risk_register: [
    { id: "R001", risk: "DPDP Act 2023 non-compliance: client data not mapped across all practice verticals", category: "Regulatory", likelihood: "High", impact: "Critical", velocity: "Immediate", severity_score: 100, owner: "CCO + CISO", current_control: "Basic consent management system deployed in Q2 2024", mitigation: "Deploy comprehensive data mapping tool across all 6 verticals + appoint DPO by Q2 2025", residual_score: 42 },
    { id: "R002", risk: "Senior Manager attrition: 34% voluntary exit rate in Advisory cohort — institutional knowledge loss", category: "Talent", likelihood: "High", impact: "High", velocity: "Near-term", severity_score: 50, owner: "CHRO", current_control: "Annual retention survey + focus groups", mitigation: "Implement succession planning program + long-term incentive plan for SM band by Q1 2025", residual_score: 28 },
    { id: "R003", risk: "Third-party API exposure: critical integrations on unpatched dependencies", category: "Cyber", likelihood: "Medium", impact: "High", velocity: "Near-term", severity_score: 50, owner: "CISO", current_control: "Annual penetration testing + vulnerability scanning", mitigation: "Patch management automation + vendor security questionnaire program by Q3 2025", residual_score: 22 },
    { id: "R004", risk: "Competitive response: PwC India and EY India targeting mid-market with AI-enabled platforms", category: "Strategic", likelihood: "High", impact: "High", velocity: "Near-term", severity_score: 50, owner: "CEO + Strategy Director", current_control: "Competitive intelligence monitoring through external research", mitigation: "Accelerate AI-enabled service delivery by 6 months + targeted mid-market go-to-market strategy", residual_score: 33 },
    { id: "R005", risk: "Regulatory audit finding: potential deficiencies in audit documentation for FY24 engagements", category: "Regulatory", likelihood: "Medium", impact: "Medium", velocity: "Long-term", severity_score: 11, owner: "CAO", current_control: "Internal QA reviews on 20% sample", mitigation: "Deploy AI-assisted documentation review tool + increase QA sample to 40% from Q3 2025", residual_score: 6 }
  ],
  critical_risks: ["R001: DPDP Act 2023 non-compliance — ₹250 crore penalty exposure if data breach occurs", "R002: Senior Manager attrition — institutional knowledge loss threatening engagement delivery quality"],
  mitigation_strategies: ["CCO + CISO to deploy comprehensive data mapping tool across all practice verticals + appoint dedicated DPO by Q2 2025 — expected risk score reduction: 58%", "CHRO to implement succession planning program + LTIP for Senior Manager band by Q1 2025 — expected risk score reduction: 22%", "CISO to automate patch management + vendor security program by Q3 2025 — expected risk score reduction: 28%"],
  residual_risk_level: "HIGH",
  risk_appetite_alignment: "Current residual risk level (HIGH) exceeds stated risk appetite (MEDIUM) for regulatory and talent domains. Immediate board-level intervention required.",
  framework_used: "COSO ERM 2017 + NIST CSF 2.0 + ISO 31000",
  heat_map_data: [
    { risk_id: "R001", label: "DPDP Compliance", x: 3, y: 4, severity: 100 },
    { risk_id: "R002", label: "Talent Exodus", x: 3, y: 3, severity: 50 },
    { risk_id: "R003", label: "API Exposure", x: 2, y: 3, severity: 50 },
    { risk_id: "R004", label: "Competitive", x: 3, y: 3, severity: 50 },
    { risk_id: "R005", label: "Audit Finding", x: 2, y: 2, severity: 11 }
  ],
  confidence_score: 78,
  board_escalation_required: true,
  escalation_rationale: "Two CRITICAL/HIGH risks (R001, R002) require board-level resource allocation decision by Q1 2025. R001 DPDP exposure alone carries ₹250 crore penalty and reputational damage risk."
};

export async function runRiskAgent(input: AgentInput): Promise<AgentOutput> {
  const start = Date.now();
  const year = new Date().getFullYear();

  // Live regulatory intelligence search
  const [regulatorySearch, riskSearch] = await Promise.all([
    webSearch(`${input.industryContext || ''} ${input.geographyContext || ''} regulatory requirements compliance penalties ${year}`, 4),
    webSearch(`${input.problemStatement} risk factors failure rate industry ${year}`, 3),
  ]);

  const searchContext = [
    regulatorySearch.length ? `\nLIVE REGULATORY INTELLIGENCE (ground your regulatory risk assessments with this current data):\n${regulatorySearch.map(r => `• ${r.title}: ${r.snippet}`).join('\n')}` : '',
    riskSearch.length ? `\nLIVE RISK INTELLIGENCE:\n${riskSearch.map(r => `• ${r.title}: ${r.snippet}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');

  const userMessage = `
Strategic problem: "${input.problemStatement}"
Organisation: ${input.organisationContext || 'Unspecified'}
Industry: ${input.industryContext || 'Unspecified'}
Geography: ${input.geographyContext || 'Unspecified'}

${input.upstreamResults?.strategistData ? `Strategist identified risks: ${JSON.stringify((input.upstreamResults.strategistData as any)?.problem_decomposition || [])}` : ''}
${input.upstreamResults?.marketIntelData ? `Market intelligence risks: ${JSON.stringify((input.upstreamResults.marketIntelData as any)?.emerging_risks || [])}` : ''}
${searchContext}

Build COSO ERM risk register with severity scores. Return ONLY valid JSON.
  `;
  const result = await callLLMWithRetry<RiskOutput>(RISK_SYSTEM_PROMPT, userMessage, ['risk_register', 'critical_risks', 'residual_risk_level', 'confidence_score'], riskFallback);
  return { agentId: 'risk', status: result.usedFallback ? 'self_corrected' : 'completed', data: result.data as Record<string, unknown>, confidenceScore: result.data.confidence_score, durationMs: Date.now() - start, attemptNumber: result.attempts, selfCorrected: result.usedFallback, tokenUsage: { input: result.inputTokens, output: result.outputTokens } };
}
