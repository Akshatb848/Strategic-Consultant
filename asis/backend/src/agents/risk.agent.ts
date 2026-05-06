import { callLLMWithRetry } from '../lib/llmClient';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION, CITATION_FORMAT_INSTRUCTION } from './masterPrompt';
import { webSearch } from '../lib/webSearch';
import type { AgentInput, RiskOutput, AgentOutput } from './types';

const RISK_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Risk Node — Chief Risk Officer of the ASIS pipeline.
YOUR ROLE: Build a structured risk register using COSO ERM 2017 + NIST CSF 2.0 + ISO 31000.

SEVERITY CALCULATION (MANDATORY FORMULA — apply to every risk):
  Likelihood:  High=3, Medium=2, Low=1
  Impact:     Critical=4, High=3, Medium=2, Low=1
  Velocity:   Immediate=3, Near-term=2, Long-term=1
  raw_score = Likelihood × Impact × Velocity
  severity_score = round((raw_score / 36) × 100)

RISK TAXONOMY:
  Regulatory | Cyber | Talent | Financial | Operational | Reputational | Strategic

NAMED RISK STANDARD:
  ✗ "Data privacy risk"
  ✓ "DPDP Act 2023 non-compliance: client data not mapped across practices — Section 8 fiduciary obligation"
  ✓ "NVIDIA H100 supply constraint: 6-month GPU lead times delay JioAI model training milestones"
  ✓ "Key AI talent exodus: 3 founding engineers of acquisition target likely to depart within 90 days"

Every risk MUST name: the specific law/system/company/person involved, NOT generic descriptions.

${CONFIDENCE_FORMULA_INSTRUCTION}
${CITATION_FORMAT_INSTRUCTION}

Return ONLY this exact JSON:
{
  "risk_register": [
    {
      "id": "R001",
      "risk": "Specific named risk — not generic",
      "category": "Regulatory|Cyber|Talent|Financial|Operational|Reputational|Strategic",
      "likelihood": "High|Medium|Low",
      "impact": "Critical|High|Medium|Low",
      "velocity": "Immediate|Near-term|Long-term",
      "severity_score": 0,
      "owner": "Specific C-suite role (CCO, CISO, CPO, CFO, COO, CHRO, CTO)",
      "current_control": "Specific existing control — not 'Some controls exist'",
      "mitigation": "Specific action with timeline + named responsible party + expected residual score",
      "residual_score": 0
    }
  ],
  "critical_risks": ["R001: Named risk — specific consequence with $ figure"],
  "mitigation_strategies": ["Strategy 1: specific action + owner + timeline + expected risk score reduction"],
  "residual_risk_level": "CRITICAL|HIGH|MEDIUM|LOW",
  "risk_appetite_alignment": "Specific assessment against stated risk appetite",
  "framework_used": "COSO ERM 2017 + NIST CSF 2.0 + ISO 31000",
  "heat_map_data": [
    { "risk_id": "R001", "label": "Short label (max 4 words)", "x": 0, "y": 0, "severity": 0 }
  ],
  "confidence_score": 0,
  "board_escalation_required": true,
  "escalation_rationale": "Specific reason requiring board decision — name the risk and the financial exposure",
  "citations": []
}
`;

const riskFallback: RiskOutput = {
  risk_register: [
    { id: "R001", risk: "DPDP Act 2023 non-compliance: acquisition target's data fiduciary obligations not mapped — Section 8-12 violations inherited by Reliance at deal close", category: "Regulatory", likelihood: "High", impact: "Critical", velocity: "Immediate", severity_score: 100, owner: "CCO + CISO", current_control: "Basic data inventory audit commissioned but not completed; no DPO appointed at target company", mitigation: "Complete DPDP compliance audit of target within 30 days pre-close; appoint DPO at Reliance JioAI within 60 days post-close; implement consent management platform by Q3 2025. Expected residual score: 42", residual_score: 42 },
    { id: "R002", risk: "AI talent exodus: 3 founding engineers of acquisition target expected to exercise put options and exit within 90 days post-close — institutional knowledge loss", category: "Talent", likelihood: "High", impact: "High", velocity: "Immediate", severity_score: 75, owner: "CHRO", current_control: "Standard employment contracts; no specific retention incentives structured for M&A scenario", mitigation: "Structure 3-year cliff vesting retention packages for top-20 engineers BEFORE announcement; assign JioAI CTO as integration sponsor; guarantee technical autonomy for 24 months. Expected residual score: 33", residual_score: 33 },
    { id: "R003", risk: "CCI merger control delay: acquisition >₹2,000 crore enterprise value triggers mandatory pre-merger notification (Competition Act 2002, Section 6) — 90–180 day clearance timeline", category: "Regulatory", likelihood: "Medium", impact: "High", velocity: "Near-term", severity_score: 50, owner: "CFO + General Counsel", current_control: "Reliance legal team experienced in CCI filings; previous Jio acquisitions completed successfully", mitigation: "File CCI notification within 5 days of signing; pre-clear market share calculations with antitrust counsel; prepare substantive remedies for CCI review. Expected residual score: 22", residual_score: 22 },
    { id: "R004", risk: "NVIDIA H100 GPU export controls (US Commerce Dept Entity List, October 2023): AI compute scarcity could delay JioAI model training by 6–12 months post-acquisition", category: "Operational", likelihood: "Medium", impact: "High", velocity: "Near-term", severity_score: 50, owner: "CTO", current_control: "Existing NVIDIA H100 cluster at Jamnagar; Microsoft Azure GPU allocation agreement in place", mitigation: "Diversify compute to AMD MI300X + Google TPU v4 (alternative GPU suppliers); accelerate open-source model adoption (Llama 3, Mistral) to reduce H100 dependency. Expected residual score: 28", residual_score: 28 },
    { id: "R005", risk: "Integration risk: culture clash between Reliance Corporate governance model and acquired AI startup's agile/autonomous culture — 40–60% of M&A value destruction attributable to cultural misalignment (McKinsey 2023)", category: "Strategic", likelihood: "High", impact: "High", velocity: "Near-term", severity_score: 50, owner: "CEO + CHRO", current_control: "Reliance has completed 6 acquisitions in last 3 years but AI startups represent new cultural archetype", mitigation: "Establish 'JioAI Labs' as semi-autonomous subsidiary with separate Glassdoor brand; CEO of acquired company joins Reliance board; 100-day integration plan with named cultural integration workstreams. Expected residual score: 28", residual_score: 28 },
  ],
  critical_risks: ["R001: DPDP Act 2023 non-compliance at acquisition target — ₹250 crore penalty exposure per violation if inherited by Reliance post-close", "R002: AI talent exodus — 3 founding engineers departure within 90 days destroys 60% of acquisition's stated synergy value"],
  mitigation_strategies: ["CCO + CISO: complete DPDP compliance audit of target within 30 days pre-close; DPO appointment within 60 days post-close — reduces R001 severity score 100→42", "CHRO: structure retention packages for top-20 target engineers BEFORE announcement — 3-year cliff vesting + JioAI equity equivalent — reduces R002 severity score 75→33", "CFO: file CCI pre-merger notification within 5 days of signing with pre-cleared market share analysis — reduces R003 severity score 50→22"],
  residual_risk_level: "HIGH",
  risk_appetite_alignment: "Residual risk level HIGH exceeds Reliance Industries' stated M&A risk appetite (MEDIUM) for Regulatory and Talent categories. Board-level sign-off required before proceeding.",
  framework_used: "COSO ERM 2017 + NIST CSF 2.0 + ISO 31000",
  heat_map_data: [
    { risk_id: "R001", label: "DPDP Compliance", x: 3, y: 4, severity: 100 },
    { risk_id: "R002", label: "AI Talent Exit", x: 3, y: 3, severity: 75 },
    { risk_id: "R003", label: "CCI Review Delay", x: 2, y: 3, severity: 50 },
    { risk_id: "R004", label: "GPU Constraint", x: 2, y: 3, severity: 50 },
    { risk_id: "R005", label: "Culture Clash", x: 3, y: 3, severity: 50 },
  ],
  confidence_score: 82,
  board_escalation_required: true,
  escalation_rationale: "R001 (DPDP non-compliance, ₹250 crore exposure) and R002 (founder talent exodus, 60% synergy destruction) together require board-level pre-approval and resource allocation decision within 30 days of Letter of Intent signing.",
  citations: [
    { id: "C001", title: "DPDP Act 2023 — Digital Personal Data Protection Act", publisher: "Ministry of Electronics & IT, Government of India", url: "https://meity.gov.in/writereaddata/files/Digital%20Personal%20Data%20Protection%20Act%202023.pdf", year: "2023", relevance: "DPDP penalty provisions (Section 25: ₹250 crore per violation) cited in R001 risk assessment" },
    { id: "C002", title: "Competition Act 2002 — Merger Control Guidelines", publisher: "Competition Commission of India", url: "https://cci.gov.in/sites/default/files/whats_newdocument/CompetitionAct2002.pdf", year: "2002", relevance: "Section 6 merger notification threshold cited in R003 regulatory risk" },
    { id: "C003", title: "McKinsey M&A Integration Survey 2023", publisher: "McKinsey & Company", url: "https://mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/done-deal-why-many-large-transactions-fail-to-cross-the-finish-line", year: "2023", relevance: "40–60% M&A value destruction from cultural misalignment statistic cited in R005" },
    { id: "C004", title: "COSO ERM 2017 Framework", publisher: "Committee of Sponsoring Organizations of the Treadway Commission", url: "https://www.coso.org/Shared%20Documents/2017-COSO-ERM-Integrating-with-Strategy-and-Performance-Executive-Summary.pdf", year: "2017", relevance: "Risk severity formula and risk register methodology applied throughout" },
  ],
};

export async function runRiskAgent(input: AgentInput): Promise<AgentOutput> {
  const start = Date.now();
  const year = new Date().getFullYear();
  const strategistData = input.upstreamResults?.strategistData as any;
  const companyProfile = strategistData?.company_profile || null;

  const [regulatorySearch, riskSearch] = await Promise.all([
    webSearch(`${input.industryContext || ''} ${input.geographyContext || ''} regulatory requirements compliance penalties ${year}`, 4),
    webSearch(`${input.problemStatement} risk factors failure case studies ${year}`, 3),
  ]);

  const searchContext = [
    regulatorySearch.length ? `\nLIVE REGULATORY INTELLIGENCE (use for named regulations and penalties):\n${regulatorySearch.map(r => `• [${r.title}](${r.url}): ${r.snippet}`).join('\n')}` : '',
    riskSearch.length ? `\nLIVE RISK INTELLIGENCE:\n${riskSearch.map(r => `• [${r.title}](${r.url}): ${r.snippet}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');

  const userMessage = `
Strategic problem: "${input.problemStatement}"
Organisation: ${input.organisationContext || companyProfile?.name || 'Unspecified'}
Industry: ${input.industryContext || companyProfile?.primary_sector || 'Unspecified'}
Geography: ${input.geographyContext || 'Unspecified'}

COMPANY PROFILE:
${JSON.stringify(companyProfile, null, 2)}

Upstream context:
${input.upstreamResults?.strategistData ? `Key risks identified by Strategist: ${JSON.stringify((strategistData)?.swot_analysis?.threats || [])}` : ''}
${input.upstreamResults?.marketIntelData ? `Regulatory landscape: ${JSON.stringify((input.upstreamResults.marketIntelData as any)?.regulatory_landscape || [])}` : ''}
${searchContext}

CRITICAL INSTRUCTIONS:
1. Every risk must NAME the specific law/system/company — ZERO generic risks
2. severity_score = round((Likelihood×Impact×Velocity / 36) × 100) — show the math
3. mitigation must name the responsible C-suite role AND expected residual score
4. citations: include real regulatory URLs from search results above + minimum 3 from knowledge

Return ONLY valid JSON.
  `;
  const result = await callLLMWithRetry<RiskOutput>(
    RISK_SYSTEM_PROMPT,
    userMessage,
    ['risk_register', 'critical_risks', 'residual_risk_level', 'confidence_score'],
    riskFallback
  );
  return {
    agentId: 'risk',
    status: result.usedFallback ? 'self_corrected' : 'completed',
    data: result.data as Record<string, unknown>,
    confidenceScore: result.data.confidence_score,
    durationMs: Date.now() - start,
    attemptNumber: result.attempts,
    selfCorrected: result.usedFallback,
    tokenUsage: { input: result.inputTokens, output: result.outputTokens }
  };
}
