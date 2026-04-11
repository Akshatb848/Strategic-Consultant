import { callLLMWithRetry } from '../lib/llmClient.js';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION } from './masterPrompt.js';
import type { AgentInput, AgentOutput, EthicistOutput } from './types.js';

const ETHICIST_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Ethicist Node — Chief Ethics and ESG Officer of the ASIS pipeline.
YOUR ROLE: Assess whether the recommended strategy aligns with ESG frameworks,
brand values, cultural expectations, and ethical guardrails.

ASSESSMENT DIMENSIONS:
1. BRAND RISK: Does the strategy risk diluting premium brand equity?
2. ESG COMPLIANCE: GRI Standards, TCFD, BRSR (India), CSRD (EU), SASB
3. CULTURAL FIT: For M&A/partnerships — culture clash risk assessment
4. STAKEHOLDER IMPACT: Map all affected stakeholders; who wins, who loses?
5. REGULATORY ETHICS: Anti-bribery (FCPA, UK Bribery Act), conflict of interest, data ethics

SCORING:
  cultural_fit_score: 0-100 (100 = perfect cultural alignment)

${CONFIDENCE_FORMULA_INSTRUCTION}

Return ONLY valid JSON matching the EthicistOutput schema with fields:
brand_risk_assessment, esg_implications, cultural_fit_score, regulatory_ethics_flags,
stakeholder_impact, recommendation, conditions, confidence_score.
`;

function getEthicistFallback(input: AgentInput): EthicistOutput {
  return {
    brand_risk_assessment: `The proposed strategic initiative presents moderate brand risk for ${input.organisationContext || 'the organisation'}. Technology transformation programmes, when communicated effectively, typically enhance brand perception among enterprise clients. However, execution failures during transition could temporarily impact client confidence and Net Promoter Score. Key brand protection measure: maintain premium service delivery standards throughout transition with dedicated quality assurance overlay.`,
    esg_implications: [
      'GRI 418 (Customer Privacy): Data governance improvements directly support GRI reporting requirements and strengthen client trust positioning',
      'TCFD (Climate-related Financial Disclosures): Technology modernisation reduces Scope 2 emissions through cloud migration — quantifiable ESG benefit for sustainability reporting',
      'BRSR (Business Responsibility and Sustainability Reporting): Compliance with SEBI-mandated BRSR framework enhanced through improved governance maturity',
      'Social Impact: Upskilling programme creates positive employee development narrative — 200+ team members benefit from AI literacy training',
    ],
    cultural_fit_score: 72,
    regulatory_ethics_flags: [
      'Data Ethics: AI-augmented advisory tools must include human-in-the-loop oversight to prevent automated decision bias — per IEEE 7010 standard',
      'Anti-bribery compliance: Third-party technology vendor relationships must be screened under FCPA and UK Bribery Act 2010 due diligence requirements',
      'Conflict of interest: If advisory services include competitor analysis, ethical walls must be established between engagement teams per professional services standards',
    ],
    stakeholder_impact: [
      { stakeholder: 'Enterprise Clients', impact_type: 'Positive', description: 'Enhanced service quality through AI-augmented advisory; faster turnaround; more data-driven recommendations', severity: 'High' },
      { stakeholder: 'Employees (Senior)', impact_type: 'Negative', description: 'Role redefinition anxiety; potential for experienced consultants to perceive AI as threat to expertise value', severity: 'Medium' },
      { stakeholder: 'Employees (Junior)', impact_type: 'Positive', description: 'Access to AI-powered tools accelerates skill development; reduced time on low-value data gathering tasks', severity: 'Medium' },
      { stakeholder: 'Shareholders/Partners', impact_type: 'Positive', description: 'Revenue protection and margin improvement from operational efficiency; competitive positioning strengthened', severity: 'High' },
      { stakeholder: 'Regulators', impact_type: 'Neutral', description: 'Proactive compliance posture viewed favourably; however, AI usage in advisory may attract regulatory scrutiny in some jurisdictions', severity: 'Low' },
    ],
    recommendation: 'Proceed with Conditions',
    conditions: [
      'Establish AI Ethics Board with external representation before deploying AI-augmented advisory tools to clients',
      'Implement human-in-the-loop oversight for all AI-generated strategic recommendations',
      'Complete FCPA/Bribery Act due diligence on all technology vendor relationships within 90 days',
      'Launch employee communication programme explaining transformation rationale and career development opportunities before formal announcement',
    ],
    confidence_score: 71,
  };
}

export async function runEthicistAgent(input: AgentInput): Promise<AgentOutput<EthicistOutput>> {
  const upstream = input.upstreamResults;
  const upstreamContext = Object.entries(upstream)
    .filter(([_, v]) => v)
    .map(([k, v]) => `\n${k}:\n${JSON.stringify(v, null, 2)}`)
    .join('');

  const userMessage = `
Assess the ethical and ESG implications of this strategic initiative:
"${input.problemStatement}"

Context:
- Organisation: ${input.organisationContext || 'Unspecified'}
- Industry: ${input.industryContext || 'Unspecified'}
- Geography: ${input.geographyContext || 'Unspecified'}

Upstream Analysis:${upstreamContext || ' None available'}

Assess brand risk, ESG compliance, stakeholder impact. Return ONLY valid JSON.
  `;

  return callLLMWithRetry<EthicistOutput>(
    ETHICIST_SYSTEM_PROMPT,
    userMessage,
    ['brand_risk_assessment', 'stakeholder_impact', 'recommendation', 'confidence_score'],
    getEthicistFallback(input),
    'ethicist'
  );
}
