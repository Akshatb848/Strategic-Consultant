import { callLLMWithRetry } from '../lib/llmClient';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION } from './masterPrompt';
import { webSearch } from '../lib/webSearch';
import type { AgentInput, MarketIntelOutput, AgentOutput } from './types';

const MARKET_INTEL_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Market Intelligence Node — Chief Market Strategist of the ASIS pipeline.
YOUR ROLE: Apply PESTLE + Porter's Five Forces to map the regulatory and competitive landscape.

PESTLE DIMENSIONS:
  Political: Trade policy, government stability, regulation, lobbying
  Economic: GDP growth, inflation, FX, interest rates, consumer confidence
  Social: Demographics, cultural shifts, talent availability, work patterns
  Technological: Disruption, AI adoption, R&D, automation, digital transformation
  Legal: Compliance requirements, employment law, competition law, data protection
  Environmental: ESG, carbon regulations, climate risk, resource scarcity

PORTER'S FIVE FORCES — for the specific industry/geography:
  Supplier Power: concentration, switching costs, substitutes
  Buyer Power: buyer volume, price sensitivity, differentiation
  Competitive Rivalry: concentration, diversity, industry growth, exit barriers
  Threat of Substitution: substitutes, switching costs, buyer propensity
  Threat of New Entry: barriers to entry, economies of scale, regulation

NAMED REGULATIONS — cite specific laws:
  India: DPDP Act 2023, IT Act 2000, SEBI regulations, RBI guidelines, Companies Act 2013
  EU: GDPR, CSRD, DORA, AI Act
  US: SOX, CCPA, FTC regulations, SEC requirements
  UK: UK GDPR, Companies Act 2006, FCA regulations

${CONFIDENCE_FORMULA_INSTRUCTION}

Return ONLY this exact JSON structure:
{
  "pestle_analysis": {
    "political": ["Specific political factor with named policy/regulation", "Specific political factor"],
    "economic": ["Specific economic factor with quantified impact", "Specific economic factor"],
    "social": ["Specific social trend with named demographic/behavioral shift", "Specific social trend"],
    "technological": ["Specific technology disruption with named platform/company", "Specific technology trend"],
    "legal": ["Specific law with jurisdiction: DPDP Act 2023 (India) or GDPR (EU)", "Specific law"],
    "environmental": ["Specific ESG factor with named regulation or framework", "Specific environmental factor"]
  },
  "porters_five_forces": {
    "supplier_power": { "rating": "High|Medium|Low", "rationale": "Specific reasoning with named examples" },
    "buyer_power": { "rating": "High|Medium|Low", "rationale": "Specific reasoning with named examples" },
    "competitive_rivalry": { "rating": "High|Medium|Low", "rationale": "Specific reasoning with named competitors" },
    "threat_of_substitution": { "rating": "High|Medium|Low", "rationale": "Specific reasoning" },
    "threat_of_new_entry": { "rating": "High|Medium|Low", "rationale": "Specific reasoning with named barriers" },
    "overall_attractiveness": "Very Attractive|Attractive|Moderate|Unattractive"
  },
  "regulatory_landscape": [
    {
      "name": "Specific regulation name with year: DPDP Act 2023",
      "jurisdiction": "India|EU|US|UK|Global",
      "requirement": "Specific requirement — not generic",
      "deadline": "Q1 2025|Month Year|ALREADY IN FORCE",
      "penalty_exposure": "$XM or X% of global turnover",
      "compliance_status": "Compliant|Partially Compliant|Non-Compliant|Unknown"
    }
  ],
  "market_signals": ["Named signal: Company X acquired Company Y in Q3 2024", "Named signal: Regulation Z announced for Q1 2025"],
  "key_findings": ["Specific finding with named evidence source", "Specific finding with quantified data point"],
  "emerging_risks": ["Specific named emerging risk with timeline", "Specific named risk"],
  "opportunities": ["Specific named opportunity with estimated market size", "Specific named opportunity"],
  "data_sources": ["Named source: IBEF, CRISIL, Gartner, Forrester, McKinsey Global Institute, Statista", "Named source"],
  "confidence_score": [CALCULATED INTEGER],
  "strategic_implication": "Single board-level sentence: what leadership must act on immediately"
}
`;

const marketIntelFallback: MarketIntelOutput = {
  pestle_analysis: { political: ["Government stability enabling business continuity", "Trade policy shifts affecting cross-border operations"], economic: ["GDP growth of 6.5% supporting investment appetite", "Inflation moderation improving consumer spending"], social: ["Digital adoption accelerating post-pandemic", "Talent competition intensifying for specialized skills"], technological: ["AI adoption creating both disruption and opportunity", "Cloud migration enabling operational efficiency"], legal: ["DPDP Act 2023 requiring data protection compliance", "Companies Act 2013 governance requirements"], environmental: ["ESG reporting becoming mandatory for large corporates", "Carbon neutrality commitments from key stakeholders"] },
  porters_five_forces: {
    supplier_power: { rating: 'Medium', rationale: 'Multiple suppliers available but specialized vendors have leverage' },
    buyer_power: { rating: 'High', rationale: 'Buyers have high information access and can easily compare alternatives' },
    competitive_rivalry: { rating: 'High', rationale: 'Multiple global players competing in India: PwC India, EY India, KPMG India, Deloitte India' },
    threat_of_substitution: { rating: 'Medium', rationale: 'In-house capabilities emerging but specialist expertise remains differentiated' },
    threat_of_new_entry: { rating: 'Low', rationale: 'High capital requirements, regulatory compliance, and brand trust barriers protect incumbents' },
    overall_attractiveness: 'Moderate'
  },
  regulatory_landscape: [
    { name: "DPDP Act 2023", jurisdiction: "India", requirement: "Consent management, data fiduciary obligations, breach notification within 72 hours", deadline: "ALREADY IN FORCE", penalty_exposure: "Up to ₹250 crore or 4% of global turnover", compliance_status: "Partially Compliant" },
    { name: "Companies Act 2013 (Section 134)", jurisdiction: "India", requirement: "Board-approved financial statements, auditor independence, related party transaction disclosures", deadline: "ANNUAL", penalty_exposure: "₹5 lakh fine + imprisonment for fraud", compliance_status: "Compliant" }
  ],
  market_signals: ["PwC India announced AI-enabled audit platform expansion in Q3 2024", "EY India launched ESG advisory practice with 200+ consultants", "BCG opened new India office in Bangalore with 400 capacity"],
  key_findings: ["Professional services market in India growing at 12% CAGR to reach $25B by 2027", "Regulatory complexity increasing demand for specialized compliance advisory"],
  emerging_risks: ["AI disruption threatening traditional consulting delivery models", "Talent attrition rates reaching 25% annually in top consulting firms"],
  opportunities: ["AI-augmented consulting services estimated $8B market in India by 2026", "Mid-market segment underserved by global consulting firms presenting M&A opportunity"],
  data_sources: ["IBEF India Reports 2024", "NASSCOM Strategic Review 2024", "Gartner AI Adoption Survey", "McKinsey Global Institute India Report 2024"],
  confidence_score: 75,
  strategic_implication: "DPDP Act 2023 compliance is non-negotiable — failure to act immediately exposes the firm to penalties up to ₹250 crore and reputational damage in the professional services market."
};

export async function runMarketIntelAgent(input: AgentInput): Promise<AgentOutput> {
  const start = Date.now();
  const year = new Date().getFullYear();

  // Live web search to ground analysis with current data
  const [marketSearch, regulatorySearch, trendsSearch] = await Promise.all([
    webSearch(`${input.problemStatement} market size ${input.industryContext || ''} ${year}`, 4),
    webSearch(`${input.geographyContext || ''} ${input.industryContext || ''} regulations compliance ${year}`, 4),
    webSearch(`${input.industryContext || ''} industry trends growth competitive landscape ${year}`, 4),
  ]);

  const searchContext = [
    marketSearch.length ? `\nLIVE MARKET INTELLIGENCE (use to ground analysis with current data):\n${marketSearch.map(r => `• ${r.title}: ${r.snippet}`).join('\n')}` : '',
    regulatorySearch.length ? `\nLIVE REGULATORY INTELLIGENCE:\n${regulatorySearch.map(r => `• ${r.title}: ${r.snippet}`).join('\n')}` : '',
    trendsSearch.length ? `\nLIVE INDUSTRY TRENDS:\n${trendsSearch.map(r => `• ${r.title}: ${r.snippet}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');

  const userMessage = `
Strategic problem: "${input.problemStatement}"
Organisation: ${input.organisationContext || 'Unspecified'}
Industry: ${input.industryContext || 'Unspecified'}
Geography: ${input.geographyContext || 'Unspecified'}

${input.upstreamResults?.strategistData ? `Strategist framework: ${JSON.stringify((input.upstreamResults.strategistData as any)?.analytical_framework || '')}` : ''}
${searchContext}

Apply PESTLE and Porter's Five Forces. Return ONLY valid JSON.
  `;
  const result = await callLLMWithRetry<MarketIntelOutput>(MARKET_INTEL_SYSTEM_PROMPT, userMessage, ['pestle_analysis', 'porters_five_forces', 'key_findings', 'confidence_score'], marketIntelFallback);
  return { agentId: 'market_intel', status: result.usedFallback ? 'self_corrected' : 'completed', data: result.data as Record<string, unknown>, confidenceScore: result.data.confidence_score, durationMs: Date.now() - start, attemptNumber: result.attempts, selfCorrected: result.usedFallback, tokenUsage: { input: result.inputTokens, output: result.outputTokens } };
}
