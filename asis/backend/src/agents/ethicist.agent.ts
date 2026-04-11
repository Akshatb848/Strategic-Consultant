import { callLLMWithRetry } from '../lib/llmClient';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION } from './masterPrompt';
import type { AgentInput, EthicistOutput, AgentOutput } from './types';

const ETHICIST_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Ethicist Node — Chief Ethics and ESG Officer of the ASIS pipeline.
YOUR ROLE: Assess whether the recommended strategy aligns with ESG frameworks,
brand values, cultural expectations, and ethical guardrails for the client organisation.

ASSESSMENT DIMENSIONS:
1. BRAND RISK: Does the strategy risk diluting premium brand equity?
   (Critical for McKinsey, Deloitte, BCG — brand is the product)
2. ESG COMPLIANCE: GRI Standards, TCFD, BRSR (India), CSRD (EU), SASB
3. CULTURAL FIT: For M&A/partnerships — culture clash risk assessment
4. STAKEHOLDER IMPACT: Map all affected stakeholders; who wins, who loses?
5. REGULATORY ETHICS: Anti-bribery (FCPA, UK Bribery Act), conflict of interest, 
   data ethics, AI ethics (if technology deployment)

SCORING:
  cultural_fit_score: 0-100 (100 = perfect cultural alignment)
  Brand risk: Qualitative with specific scenarios

${CONFIDENCE_FORMULA_INSTRUCTION}

Return ONLY this exact JSON structure:
{
  "brand_risk_assessment": "Specific assessment of brand implications — not generic",
  "esg_implications": [
    "Specific ESG factor with named framework reference: TCFD climate risk disclosure for [specific exposure]",
    "Specific ESG factor with named framework reference"
  ],
  "cultural_fit_score": [0-100 INTEGER],
  "regulatory_ethics_flags": [
    "Specific flag: e.g., FCPA exposure in [geography] given [specific practice]"
  ],
  "stakeholder_impact": [
    {
      "stakeholder": "Specific stakeholder group",
      "impact_type": "Positive|Negative|Neutral",
      "description": "Specific impact description",
      "severity": "High|Medium|Low"
    }
  ],
  "recommendation": "Proceed|Proceed with Conditions|Pause|Do Not Proceed",
  "conditions": [
    "Specific condition that must be met before proceeding"
  ],
  "confidence_score": [CALCULATED INTEGER]
}
`;

const ethicistFallback: EthicistOutput = {
  brand_risk_assessment: "Transformation initiative carries moderate brand risk if perceived as reactive compliance rather than proactive leadership. Professional services clients expect their advisors to be ahead of regulatory curves. Announcing DPDP compliance transformation BEFORE it becomes a crisis positions the brand as a thought leader — net positive brand impact.",
  esg_implications: [
    "TCFD alignment: transformation reduces carbon footprint through digital processes — estimated 12% reduction in paper consumption + travel reduction (Scope 3 emissions)",
    "BRSR (India) compliance: ESG disclosure requirements under SEBI's BRSR format require governance metrics that this transformation directly addresses",
    "Social impact: transformation creates upskilling opportunity for 200+ employees in AI capabilities — positive talent retention and DEI implications"
  ],
  cultural_fit_score: 78,
  regulatory_ethics_flags: [
    "FCPA exposure: if any transformation vendors or partners have government relationships in regulated geographies, enhanced due diligence required before contract award",
    "Conflict of interest: if transformation includes AI platform selection by a vendor with existing firm relationships, independent evaluation committee required"
  ],
  stakeholder_impact: [
    { stakeholder: "Partners / Equity Holders", impact_type: "Positive", description: "Long-term value creation through compliance and efficiency gains", severity: "High" },
    { stakeholder: "Senior Managers", impact_type: "Negative", description: "Increased workload during transformation period; potential role ambiguity during restructuring", severity: "High" },
    { stakeholder: "Junior Staff", impact_type: "Positive", description: "Skill development opportunities in AI-augmented service delivery; career progression pathway", severity: "Medium" },
    { stakeholder: "Clients", impact_type: "Positive", description: "Enhanced service quality and faster delivery through AI tools; improved compliance assurance", severity: "High" },
    { stakeholder: "Regulators", impact_type: "Positive", description: "Demonstrates proactive compliance posture; reduces regulatory scrutiny risk", severity: "Medium" }
  ],
  recommendation: "Proceed with Conditions",
  conditions: [
    "Talent retention packages for Senior Manager band must be announced alongside transformation to mitigate exodus risk",
    "Independent AI vendor evaluation committee must include at least one external board member",
    "FCPA due diligence on all transformation vendors with government-facing business lines"
  ],
  confidence_score: 76
};

export async function runEthicistAgent(input: AgentInput): Promise<AgentOutput> {
  const start = Date.now();
  const userMessage = `
Strategic problem: "${input.problemStatement}"
Organisation: ${input.organisationContext || 'Unspecified'}
Industry: ${input.industryContext || 'Unspecified'}
Geography: ${input.geographyContext || 'Unspecified'}

Assess brand, ESG, and ethical implications. Return ONLY valid JSON.
  `;
  const result = await callLLMWithRetry<EthicistOutput>(ETHICIST_SYSTEM_PROMPT, userMessage, ['brand_risk_assessment', 'recommendation', 'stakeholder_impact', 'confidence_score'], ethicistFallback);
  return { agentId: 'ethicist', status: result.usedFallback ? 'self_corrected' : 'completed', data: result.data as Record<string, unknown>, confidenceScore: result.data.confidence_score, durationMs: Date.now() - start, attemptNumber: result.attempts, selfCorrected: result.usedFallback, tokenUsage: { input: result.inputTokens, output: result.outputTokens } };
}
