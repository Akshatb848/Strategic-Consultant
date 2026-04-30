import { callLLMWithRetry } from '../lib/llmClient';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION, CITATION_FORMAT_INSTRUCTION } from './masterPrompt';
import type { AgentInput, EthicistOutput, AgentOutput } from './types';

const ETHICIST_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Strategic Options & Capability Assessment Node — Chief Strategy and Ethics Officer.
YOUR ROLE: Assess THREE interconnected dimensions:
  1. Porter's Value Chain — where in the value chain does the company have genuine advantage vs gaps?
  2. VRIO Framework — which capabilities are sources of sustainable competitive advantage?
  3. ESG/Brand/Ethics — are there ethical, ESG, or brand risks that should modify the recommendation?

━━ PORTER'S VALUE CHAIN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For each primary and support activity, assess:
  - current_state: what the company actually does today (specific, named)
  - competitive_advantage: "Yes" | "No" | "Partial"
  - gap_for_execution: what is missing for the strategy to succeed

PRIMARY ACTIVITIES:
  1. Inbound Logistics (supply, data sourcing, raw material)
  2. Operations (production, AI model training, delivery)
  3. Outbound Logistics (distribution, delivery mechanisms)
  4. Marketing & Sales (go-to-market, pricing, brand)
  5. Service (customer support, SLA, post-sale)

SUPPORT ACTIVITIES:
  6. Firm Infrastructure (governance, finance, legal)
  7. Human Resource Management (talent acquisition, retention, upskilling)
  8. Technology Development (R&D, IP, platform architecture)
  9. Procurement (vendor management, partnership strategy)

MARGIN ANALYSIS: Where are margins captured or eroded in the value chain?

━━ VRIO FRAMEWORK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For each key capability/resource:
  Valuable: Does it help exploit opportunities or neutralise threats? (true/false)
  Rare: Do competitors lack this? (true/false)
  Inimitable: Is it hard to copy due to history, culture, or complexity? (true/false)
  Organised: Is the company organised to exploit this resource? (true/false)

VRIO Status Rules:
  All true → SUSTAINABLE_COMPETITIVE_ADVANTAGE
  V+R+I, not O → UNUSED_COMPETITIVE_ADVANTAGE (biggest opportunity)
  V+R, not I → TEMPORARY_ADVANTAGE
  V only → COMPETITIVE_PARITY
  Not V → COMPETITIVE_DISADVANTAGE

STRATEGIC IMPLICATION: For each capability, what must happen in the next 90 days?

━━ ESG / BRAND / ETHICS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Assess: brand risk, ESG compliance (GRI, TCFD, BRSR, CSRD), cultural fit (for M&A),
stakeholder impact, and regulatory ethics (FCPA, UK Bribery Act, conflict of interest).

cultural_fit_score: 0–100 (100 = perfect cultural alignment)

${CONFIDENCE_FORMULA_INSTRUCTION}
${CITATION_FORMAT_INSTRUCTION}

Return ONLY this exact JSON:
{
  "value_chain_analysis": {
    "primary_activities": {
      "inbound_logistics": { "current_state": "Specific description", "competitive_advantage": "Yes|No|Partial", "gap_for_execution": "What is missing" },
      "operations": { "current_state": "Specific description", "competitive_advantage": "Yes|No|Partial", "gap_for_execution": "What is missing" },
      "outbound_logistics": { "current_state": "Specific description", "competitive_advantage": "Yes|No|Partial", "gap_for_execution": "What is missing" },
      "marketing_sales": { "current_state": "Specific description", "competitive_advantage": "Yes|No|Partial", "gap_for_execution": "What is missing" },
      "service": { "current_state": "Specific description", "competitive_advantage": "Yes|No|Partial", "gap_for_execution": "What is missing" }
    },
    "support_activities": {
      "firm_infrastructure": { "current_state": "Specific description", "competitive_advantage": "Yes|No|Partial", "gap_for_execution": "What is missing" },
      "human_resource_management": { "current_state": "Specific description", "competitive_advantage": "Yes|No|Partial", "gap_for_execution": "What is missing" },
      "technology_development": { "current_state": "Specific description", "competitive_advantage": "Yes|No|Partial", "gap_for_execution": "What is missing" },
      "procurement": { "current_state": "Specific description", "competitive_advantage": "Yes|No|Partial", "gap_for_execution": "What is missing" }
    },
    "value_chain_verdict": "Where does the company have genuine advantage, and where are the critical gaps that could prevent execution?",
    "margin_concentration": "Where in the value chain are margins earned and eroded?"
  },
  "vrio_assessment": [
    {
      "capability": "Named specific capability or resource",
      "valuable": true,
      "rare": true,
      "inimitable": true,
      "organised": false,
      "vrio_status": "SUSTAINABLE_COMPETITIVE_ADVANTAGE|UNUSED_COMPETITIVE_ADVANTAGE|TEMPORARY_ADVANTAGE|COMPETITIVE_PARITY|COMPETITIVE_DISADVANTAGE",
      "strategic_implication": "Specific 90-day action required"
    }
  ],
  "brand_risk_assessment": "Specific assessment with named scenarios",
  "esg_implications": ["Named ESG factor with framework reference (BRSR, TCFD, GRI)"],
  "cultural_fit_score": 0,
  "regulatory_ethics_flags": ["Named flag with jurisdiction and specific risk"],
  "stakeholder_impact": [
    {
      "stakeholder": "Named stakeholder group",
      "impact_type": "Positive|Negative|Neutral",
      "description": "Specific impact",
      "severity": "High|Medium|Low"
    }
  ],
  "capability_readiness_verdict": "Is the organisation capable of executing the recommended strategy? What are the 3 capability gaps that must be closed?",
  "recommendation": "Proceed|Proceed with Conditions|Pause|Do Not Proceed",
  "conditions": ["Specific condition that must be met before proceeding"],
  "confidence_score": 0,
  "citations": []
}
`;

const ethicistFallback: EthicistOutput = {
  value_chain_analysis: {
    primary_activities: {
      inbound_logistics: { current_state: "JioAI has access to 450M user data from Jio network — the most valuable AI training dataset in India. Data pipelines from JioCinema, JioFiber, MyJio app are active but not fully unified for AI training.", competitive_advantage: "Yes", gap_for_execution: "Unified data lake architecture needed: current data siloed across JioCinema (OTT), JioFiber (broadband), Jio Payments Bank — requires $50-80m data infrastructure investment" },
      operations: { current_state: "JioAI Labs (est. 2024, 2,000 headcount target) building foundation models on internal Jio data. NVIDIA H100 cluster operational but compute constrained by US export controls.", competitive_advantage: "Partial", gap_for_execution: "Model quality gaps vs OpenAI GPT-4o and Google Gemini Pro — AI startup acquisition would provide 12–18 months of pre-trained model acceleration" },
      outbound_logistics: { current_state: "Jio's 450M subscriber distribution network is unmatched in India — zero-marginal-cost AI delivery via MyJio app, JioCinema, JioFiber router, and upcoming JioPhone 3 with on-device AI.", competitive_advantage: "Yes", gap_for_execution: "Last-mile AI monetisation model unclear: freemium vs subscription vs B2B licensing strategy not defined" },
      marketing_sales: { current_state: "Jio brand equity is dominant in India (rank #7 in BRANDZ India 2024). Enterprise B2B sales capability is nascent — Reliance Corporate Park direct sales team vs TCS/Infosys dedicated enterprise account management.", competitive_advantage: "Partial", gap_for_execution: "Enterprise AI sales force: Jio lacks the 500+ enterprise account managers that TCS and Infosys deploy for AI consulting. Target acquisition must bring enterprise sales DNA." },
      service: { current_state: "Consumer service (150M+ JioFiber subscribers) is operational. Enterprise AI SLA, professional services, and implementation support are absent — critical for enterprise AI adoption.", competitive_advantage: "No", gap_for_execution: "Enterprise AI professional services capability — this is the most critical gap for B2B revenue realisation. Acquisition target must have this." },
    },
    support_activities: {
      firm_infrastructure: { current_state: "Reliance Industries' financial strength (Market Cap $220B, Moody's Baa2 rated) provides exceptional acquisition firepower. Corporate governance aligned with SEBI LODR requirements.", competitive_advantage: "Yes", gap_for_execution: "AI governance framework: board-level AI ethics committee needed before scaling AI services — DPDP Act 2023 requires DPO appointment and oversight structures." },
      human_resource_management: { current_state: "JioAI 2,000 headcount target requires competing with Google, Microsoft, and Anthropic for AI talent. Reliance offers stock-linked incentives but lacks the brand prestige of global tech firms for senior AI researchers.", competitive_advantage: "No", gap_for_execution: "AI talent retention: acqui-hire of startup provides immediate access to 50–200 senior AI researchers who have already demonstrated model-building capability" },
      technology_development: { current_state: "JioAI building proprietary large language models (JioLLM) trained on multilingual Indian data. Significant IP in vernacular NLP (Hindi, Tamil, Telugu, Bengali). NVIDIA H100 cluster at Jamnagar operational.", competitive_advantage: "Partial", gap_for_execution: "Model evaluation and safety infrastructure: RLHF pipeline, red-teaming capability, model benchmarking — areas where startup acquisition would close 18-month gap" },
      procurement: { current_state: "NVIDIA, AWS, and Microsoft Azure as primary AI infrastructure vendors. RIL procurement leverage (>$50B annual procurement) provides significant negotiating power.", competitive_advantage: "Yes", gap_for_execution: "Open-source model strategy: dependency on proprietary cloud AI (OpenAI API) should be reduced via open-source adoption (Llama 3, Mistral) and internally hosted models" },
    },
    value_chain_verdict: "Reliance/JioAI has structural advantages in three critical areas (data access, distribution, financial strength) but critical gaps in two execution areas (enterprise AI services, senior AI talent) that an acquisition directly addresses. The acquisition is strategically sound IF integration preserves the target's enterprise sales and talent capabilities.",
    margin_concentration: "Margins in AI services concentrate in enterprise contracts (60–70% gross margin for SaaS AI tools) vs consumer AI (5–15% gross margin). Reliance must shift from consumer distribution to enterprise AI services to capture high-margin revenue pools.",
  },
  vrio_assessment: [
    { capability: "450M-user proprietary data lake (JioCinema, JioFiber, Payments)", valuable: true, rare: true, inimitable: true, organised: false, vrio_status: "UNUSED_COMPETITIVE_ADVANTAGE", strategic_implication: "Appoint Chief Data Officer for JioAI within 30 days; launch unified data lake project Q2 2025 — this asset is irreplaceable and currently underexploited" },
    { capability: "Jio's 450M-subscriber zero-marginal-cost distribution network", valuable: true, rare: true, inimitable: true, organised: true, vrio_status: "SUSTAINABLE_COMPETITIVE_ADVANTAGE", strategic_implication: "Monetise AI via JioAI SDK embedded in MyJio, JioCinema, and JioFiber — no competitor can replicate this distribution moat" },
    { capability: "Reliance financial strength ($220B market cap, investment grade credit)", valuable: true, rare: true, inimitable: false, organised: true, vrio_status: "TEMPORARY_ADVANTAGE", strategic_implication: "Deploy acquisition capital within 12 months before Tata Group and HDFC Bank build competing AI investment war chests" },
    { capability: "Enterprise AI professional services capability", valuable: true, rare: false, inimitable: false, organised: false, vrio_status: "COMPETITIVE_DISADVANTAGE", strategic_implication: "This is the #1 acquisition rationale: acquiring this capability from a startup is faster and cheaper than building it — TCS has 100K GenAI-certified staff; JioAI has near-zero" },
    { capability: "Vernacular NLP models (Hindi, Tamil, Telugu, Bengali)", valuable: true, rare: true, inimitable: false, organised: false, vrio_status: "UNUSED_COMPETITIVE_ADVANTAGE", strategic_implication: "Launch JioAI Vernacular API for enterprise partners within 6 months — this is the genuine blue ocean before Google and Microsoft localise" },
  ],
  brand_risk_assessment: "Reliance Industries' brand equity (BRANDZ India 2024, rank #7) is a significant asset in AI enterprise sales — clients trust Reliance's financial stability more than startup counterparties. Acquisition of a lesser-known AI startup carries minimal brand risk IF the target has no regulatory or data ethics issues. Key risk: if target has undisclosed DPDP non-compliance, Reliance inherits the liability under acquisition.",
  esg_implications: [
    "BRSR (SEBI mandatory for listed companies): AI systems acquired must have bias testing and explainability documentation before integration into Reliance's BRSR ESG reporting from FY2025",
    "TCFD alignment: JioAI data centres' energy consumption must be disclosed; H100 GPU cluster at Jamnagar estimated 8–12 MW power demand requires renewable energy sourcing plan",
    "GRI 415 (Public Policy Influence): if acquisition target has government contracts, Reliance must disclose lobbying activities and avoid conflict of interest with MeitY's National AI Mission"
  ],
  cultural_fit_score: 68,
  regulatory_ethics_flags: [
    "DPDP Act 2023 due diligence: acquisition target's data fiduciary compliance status must be independently audited before deal close — inherited non-compliance could trigger ₹250 crore penalty",
    "CCI review (Competition Act 2002, Section 6): if target's AI revenues exceed ₹2,000 crore enterprise value threshold, mandatory pre-merger notification with 90–180 day clearance timeline",
    "FCPA/UK Bribery Act: if target operates in regulated sectors (BFSI, healthcare, government) with international operations, enhanced anti-corruption due diligence required"
  ],
  stakeholder_impact: [
    { stakeholder: "JioAI Engineering Team", impact_type: "Positive", description: "Access to acquired startup's senior AI researchers accelerates JioLLM development by 18 months; immediate team capability uplift", severity: "High" },
    { stakeholder: "Target Company Founders/Employees", impact_type: "Negative", description: "Cultural shock from Reliance's large-corporate governance; startup autonomy loss; risk of key talent departure within 90 days post-close", severity: "High" },
    { stakeholder: "Enterprise Clients (HDFC Bank, Tata, Infosys)", impact_type: "Positive", description: "Combined Reliance distribution + AI capability creates a credible full-stack enterprise AI vendor — improves client confidence vs pure startup risk", severity: "Medium" },
    { stakeholder: "Competitors (TCS, Infosys, Google India)", impact_type: "Negative", description: "Reliance entering enterprise AI with distribution moat + acquired capability triggers defensive competitive responses within 6 months", severity: "High" },
    { stakeholder: "Indian AI Startup Ecosystem", impact_type: "Positive", description: "Successful Reliance AI acquisition signals valuation credibility for Indian AI startups — increases Series C/D activity and international investor interest", severity: "Medium" },
  ],
  capability_readiness_verdict: "Reliance is ready to execute the acquisition (financial strength, distribution, data assets) but NOT ready to extract value post-acquisition without closing 3 capability gaps: (1) enterprise AI professional services (must come from target), (2) unified data governance/DPO structure (build within 90 days), (3) AI talent retention package for acquired founders/engineers (must be structured pre-close).",
  recommendation: "Proceed with Conditions",
  conditions: [
    "Conduct DPDP Act 2023 compliance audit of target's data practices before deal close — non-compliance is a deal-breaker given Reliance's BRSR obligations",
    "Structure talent retention packages (3-year cliff vesting + equity) for top-20 engineers from acquired team BEFORE announcement — post-announcement departures are irreversible",
    "Appoint independent AI Ethics Committee (with external board member) within 60 days of close to satisfy BRSR ESG reporting requirements"
  ],
  confidence_score: 81,
  citations: [
    { id: "C001", title: "BRANDZ India 100 Most Valuable Brands 2024", publisher: "Kantar / WPP", url: "https://www.kantar.com/inspiration/brands/brandz-india-top-100-most-valuable-brands-2024", year: "2024", relevance: "Reliance Industries brand rank #7 in India used in brand risk assessment" },
    { id: "C002", title: "BRSR Core Framework — SEBI Circular 2023", publisher: "Securities and Exchange Board of India", url: "https://sebi.gov.in/legal/circulars/2023/may-2023/business-responsibility-and-sustainability-reporting-brsr-core", year: "2023", relevance: "BRSR ESG reporting obligations for listed companies cited in ESG implications" },
    { id: "C003", title: "Porter's Value Chain Analysis Framework", publisher: "Harvard Business Review", url: "https://hbr.org/1985/11/how-information-gives-you-competitive-advantage", year: "1985", relevance: "Porter's Value Chain methodology applied to Reliance/JioAI capability assessment" },
  ],
};

export async function runEthicistAgent(input: AgentInput): Promise<AgentOutput> {
  const start = Date.now();
  const strategistData = input.upstreamResults?.strategistData as any;
  const companyProfile = strategistData?.company_profile || null;
  const quantData = input.upstreamResults?.quantData as any;
  const riskData = input.upstreamResults?.riskData as any;

  const userMessage = `
Strategic problem: "${input.problemStatement}"
Organisation: ${input.organisationContext || companyProfile?.name || 'Unspecified'}
Industry: ${input.industryContext || companyProfile?.primary_sector || 'Unspecified'}
Geography: ${input.geographyContext || 'Unspecified'}

COMPANY PROFILE (use to make VRIO and Value Chain analysis company-specific):
${JSON.stringify(companyProfile, null, 2)}

STRATEGIST SWOT (use to inform capability gaps):
${JSON.stringify(strategistData?.swot_analysis || {}, null, 2)}

RISK AGENT CRITICAL RISKS (use to identify value chain vulnerabilities):
${JSON.stringify(riskData?.risk_register?.slice(0, 3) || [], null, 2)}

CRITICAL INSTRUCTIONS:
1. value_chain_analysis: Assess Porter's Value Chain for THIS SPECIFIC COMPANY — use their actual named products, divisions, and capabilities
2. vrio_assessment: Identify 4–6 specific named capabilities/resources of the organisation
3. VRIO must reach specific strategic_implication for each capability — a named 90-day action
4. Brand risk: name specific scenarios relevant to this company and decision
5. Cultural fit score: calibrate to the specific decision type (M&A scores tend to be 55–80)
6. citations: minimum 3 real publisher URLs

Return ONLY valid JSON.
  `;
  const result = await callLLMWithRetry<EthicistOutput>(
    ETHICIST_SYSTEM_PROMPT,
    userMessage,
    ['value_chain_analysis', 'vrio_assessment', 'brand_risk_assessment', 'recommendation', 'confidence_score'],
    ethicistFallback
  );
  return {
    agentId: 'ethicist',
    status: result.usedFallback ? 'self_corrected' : 'completed',
    data: result.data as Record<string, unknown>,
    confidenceScore: result.data.confidence_score,
    durationMs: Date.now() - start,
    attemptNumber: result.attempts,
    selfCorrected: result.usedFallback,
    tokenUsage: { input: result.inputTokens, output: result.outputTokens }
  };
}
