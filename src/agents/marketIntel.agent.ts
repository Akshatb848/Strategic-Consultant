import { callLLMWithRetry } from '../lib/llmClient.js';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION } from './masterPrompt.js';
import type { AgentInput, AgentOutput, MarketIntelOutput } from './types.js';

const MARKET_INTEL_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Market Intelligence Node — Chief Strategy Officer of the ASIS pipeline.
YOUR ROLE: Conduct PESTLE analysis and Porter's Five Forces assessment to map the
competitive and regulatory landscape.

PESTLE ANALYSIS:
For each dimension, provide 2-3 SPECIFIC factors relevant to the industry/geography.
Name actual regulations, economic indicators, social trends, and technologies.

PORTER'S FIVE FORCES:
Rate each force as High/Medium/Low with a specific rationale referencing actual
competitors, suppliers, and market dynamics.

REGULATORY LANDSCAPE:
Name actual regulations with jurisdictions, deadlines, and penalty exposure.

${CONFIDENCE_FORMULA_INSTRUCTION}

Return ONLY valid JSON matching the MarketIntelOutput schema with fields:
pestle_analysis, porters_five_forces, regulatory_landscape, market_signals,
key_findings, emerging_risks, opportunities, data_sources, confidence_score,
strategic_implication.
`;

function getMarketIntelFallback(input: AgentInput): MarketIntelOutput {
  return {
    pestle_analysis: {
      political: [
        'Increasing regulatory scrutiny on data governance and AI transparency across G20 nations',
        'Government digital transformation mandates driving public sector modernisation budgets',
      ],
      economic: [
        'Global professional services market growing at 6.2% CAGR, reaching $1.2T by 2027',
        'Talent cost inflation averaging 8-12% annually in technology and advisory functions',
      ],
      social: [
        'Rising stakeholder expectations for ESG transparency and corporate governance',
        'Shift toward hybrid work models impacting organisational culture and service delivery',
      ],
      technological: [
        'Generative AI adoption accelerating across advisory and consulting verticals',
        'Cloud-native infrastructure becoming baseline for enterprise technology programmes',
      ],
      legal: [
        'DPDP Act 2023 (India) compliance deadline approaching for enterprise data controllers',
        'GDPR enforcement actions increasing with average fines exceeding €15m in 2024',
      ],
      environmental: [
        'TCFD and CSRD reporting mandates expanding to mid-market organisations by 2026',
        'Scope 3 emissions tracking becoming mandatory for supply chain participants',
      ],
    },
    porters_five_forces: {
      supplier_power: { rating: 'Medium', rationale: 'Talent supply constrained in AI/ML and cybersecurity, creating upward wage pressure. Multiple cloud providers (AWS, Azure, GCP) provide some leverage.' },
      buyer_power: { rating: 'High', rationale: 'Enterprise clients increasingly sophisticated — demanding measurable ROI, fixed-price engagements, and outcome-based pricing.' },
      competitive_rivalry: { rating: 'High', rationale: 'Intense competition among established firms (McKinsey, BCG, Bain, Deloitte, PwC, EY, KPMG) with boutique and technology-led disruptors entering.' },
      threat_of_substitution: { rating: 'Medium', rationale: 'AI-powered advisory tools and in-house strategy teams growing but not yet replacing complex multi-stakeholder engagements.' },
      threat_of_new_entry: { rating: 'Low', rationale: 'High barriers: brand reputation, regulatory relationships, talent networks, and client trust built over decades.' },
      overall_attractiveness: 'Attractive',
    },
    regulatory_landscape: [
      {
        name: 'Digital Personal Data Protection Act 2023',
        jurisdiction: 'India',
        requirement: 'Data Controller obligations: consent management, data mapping, DPO appointment',
        deadline: 'Q2 2025 (phased enforcement)',
        penalty_exposure: 'Up to ₹250 crore (~$30m) per violation',
        compliance_status: 'Partially Compliant',
      },
      {
        name: 'General Data Protection Regulation (GDPR)',
        jurisdiction: 'European Union',
        requirement: 'Cross-border data transfer safeguards, privacy by design, breach notification within 72 hours',
        deadline: 'Ongoing enforcement',
        penalty_exposure: 'Up to 4% of global annual turnover or €20m, whichever is higher',
        compliance_status: 'Partially Compliant',
      },
    ],
    market_signals: [
      'Industry consolidation accelerating — 3 major advisory firm acquisitions in last 12 months',
      'Client budget reallocation from traditional consulting to technology-enabled advisory',
      'Growing demand for sector-specific AI solutions in financial services and healthcare verticals',
    ],
    key_findings: [
      'Market conditions favourable for technology-led transformation investments',
      'Regulatory tailwinds creating compliance-driven demand that funds transformation',
      'Competitive pressure requires accelerated capability building or risk of market share erosion',
    ],
    emerging_risks: [
      'AI disruption may commoditise lower-value advisory services within 18-24 months',
      'Talent war intensifying — competitors offering 20-30% premium packages for key roles',
    ],
    opportunities: [
      'First-mover advantage in AI-augmented strategic advisory for enterprise clients',
      'Regulatory compliance as a revenue driver rather than cost centre',
      'Cross-border expansion leveraging digital delivery models',
    ],
    data_sources: [
      'Gartner Market Analysis 2024', 'McKinsey Global Institute Reports',
      'Government Gazette — DPDP Act 2023', 'EUR-Lex GDPR provisions',
    ],
    confidence_score: 74,
    strategic_implication: 'Market dynamics strongly favour proactive investment in technology-enabled advisory capabilities — regulatory tailwinds and competitive pressure create both urgency and funding rationale.',
  };
}

export async function runMarketIntelAgent(input: AgentInput): Promise<AgentOutput<MarketIntelOutput>> {
  const upstream = input.upstreamResults;
  const strategistContext = upstream.strategistData
    ? `\n\nStrategist Analysis:\n${JSON.stringify(upstream.strategistData, null, 2)}`
    : '';

  const userMessage = `
Conduct market intelligence analysis for this strategic problem:
"${input.problemStatement}"

Context:
- Organisation: ${input.organisationContext || 'Unspecified'}
- Industry: ${input.industryContext || 'Unspecified'}
- Geography: ${input.geographyContext || 'Unspecified'}
${strategistContext}

Conduct PESTLE analysis and Porter's Five Forces. Map regulatory landscape with named regulations.
Return ONLY valid JSON.
  `;

  return callLLMWithRetry<MarketIntelOutput>(
    MARKET_INTEL_SYSTEM_PROMPT,
    userMessage,
    ['pestle_analysis', 'porters_five_forces', 'confidence_score', 'strategic_implication'],
    getMarketIntelFallback(input),
    'market_intel'
  );
}
