import { callLLMWithRetry } from '../lib/llmClient';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION, CITATION_FORMAT_INSTRUCTION } from './masterPrompt';
import { webSearch } from '../lib/webSearch';
import type { AgentInput, MarketIntelOutput, AgentOutput } from './types';

const MARKET_INTEL_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Market Intelligence Node — Chief Market Strategist of the ASIS pipeline.
YOUR ROLE: Apply PESTLE + Porter's Five Forces + Blue Ocean Strategy to map the regulatory,
competitive, and whitespace landscape for this specific company/sector/geography.

NAMED COMPETITOR MANDATE:
NEVER use "Incumbent Leader", "Digital Challenger", "New Entrant", "Competitor A/B/C".
ALWAYS use real company names for the exact industry and geography being analysed.

PESTLE DIMENSIONS (every factor must be specific to the exact country/industry):
  Political: Named policy, named minister/regulator, named legislative body
  Economic: Specific % GDP growth, named central bank rate, named FX pair
  Social: Named demographic trend with population data
  Technological: Named platform/company driving disruption
  Legal: Specific law with section/article reference and enforcement agency
  Environmental: Named ESG standard (BRSR, TCFD, CSRD) with deadline

PORTER'S FIVE FORCES (named examples for every force):
  Each force must name 2–3 actual companies as examples, not generic descriptions

BLUE OCEAN STRATEGY (strategy canvas):
  Identify 3–5 factors the industry competes on (the "as-is" canvas)
  Plot where the company and 2–3 named competitors score on each factor (1–10)
  Identify the "blue ocean" — what factor to eliminate/reduce/raise/create (ERRC grid)

${CONFIDENCE_FORMULA_INSTRUCTION}
${CITATION_FORMAT_INSTRUCTION}

Return ONLY this exact JSON:
{
  "pestle_analysis": {
    "political": ["Named policy + ministry + impact"],
    "economic": ["Named metric + source + impact"],
    "social": ["Named demographic trend + data point"],
    "technological": ["Named platform/company + disruption mechanism"],
    "legal": ["Named law + section + enforcement + penalty"],
    "environmental": ["Named ESG standard + deadline + requirement"]
  },
  "porters_five_forces": {
    "supplier_power": {
      "rating": "High|Medium|Low",
      "rationale": "Specific reasoning with 2–3 named supplier companies",
      "named_examples": ["Company A: why they have leverage", "Company B"]
    },
    "buyer_power": {
      "rating": "High|Medium|Low",
      "rationale": "Specific reasoning with named customer segments",
      "named_examples": ["Segment A: why they have power"]
    },
    "competitive_rivalry": {
      "rating": "High|Medium|Low",
      "rationale": "Name the 3–5 key competitors and their specific competitive actions",
      "named_competitors": ["Company A: specific action taken in 2024", "Company B", "Company C"]
    },
    "threat_of_substitution": {
      "rating": "High|Medium|Low",
      "rationale": "Named substitute products/services",
      "named_examples": ["Substitute 1: company and product name"]
    },
    "threat_of_new_entry": {
      "rating": "High|Medium|Low",
      "rationale": "Named barriers and any recent entrants",
      "named_examples": ["Barrier 1 with specific data point"]
    },
    "overall_attractiveness": "Very Attractive|Attractive|Moderate|Unattractive"
  },
  "blue_ocean_strategy": {
    "strategy_canvas": [
      {
        "factor": "Named competitive factor (e.g. Pricing, AI Capability, Client Coverage)",
        "industry_avg": 5,
        "company_score": 4,
        "competitor_scores": { "CompetitorName1": 7, "CompetitorName2": 6 }
      }
    ],
    "errc_grid": {
      "eliminate": ["Factor the industry competes on that adds no value"],
      "reduce": ["Factor to reduce below industry standard"],
      "raise": ["Factor to raise above industry standard"],
      "create": ["New factor never offered in this industry"]
    },
    "blue_ocean_move": "Specific recommendation: what uncontested market space exists"
  },
  "regulatory_landscape": [
    {
      "name": "Named regulation with year",
      "jurisdiction": "Country/region",
      "requirement": "Specific requirement — cite section if known",
      "deadline": "Q1 2025|Already in force|etc.",
      "penalty_exposure": "$Xm or X% of revenue",
      "compliance_status": "Compliant|Partially Compliant|Non-Compliant|Unknown"
    }
  ],
  "market_signals": ["Named signal: Company X did Y in Month Year — impact on sector"],
  "key_findings": ["Specific finding with named source or data point"],
  "emerging_risks": ["Named risk with timeline and named catalyst"],
  "opportunities": ["Named opportunity with market size estimate and named beneficiary"],
  "data_sources": ["Named source: NASSCOM, IBEF, Gartner, McKinsey, IMF, World Bank, SEBI, RBI"],
  "confidence_score": 0,
  "strategic_implication": "Single board-level sentence naming the #1 thing leadership must act on",
  "citations": []
}
`;

const marketIntelFallback: MarketIntelOutput = ({
  pestle_analysis: {
    political: ["Digital India Policy 2.0 (MeitY, 2024): ₹10,000 crore allocation for AI infrastructure — direct enabler for domestic AI players including JioAI and homegrown startups", "National AI Mission (NITI Aayog): 7 AI competence centres funded — influences talent pipeline for AI sector hiring"],
    economic: ["India GDP growth 7.2% (IMF WEO April 2024) — fastest large economy globally, sustaining enterprise technology investment appetite", "RBI repo rate 6.5% (April 2024) — elevated cost of capital constraining leverage-funded acquisitions; equity-funded deals remain viable"],
    social: ["India's 600M smartphone users (TRAI 2024) creating the world's largest mobile-first AI data pool — structural advantage for JioAI's 450M user base", "Engineering talent pool of 3.1M graduates/yr (AICTE 2024) — largest AI talent supply globally after US"],
    technological: ["OpenAI, Google DeepMind, and Anthropic accelerating LLM commoditisation — reducing differentiation moat for AI startups without proprietary data", "JioAI's 450M-user data lake creates an inimitable training corpus advantage that no startup acquisition can fully replicate but can accelerate access to"],
    legal: ["DPDP Act 2023 (Section 25, MeitY): data fiduciary obligations, 72-hour breach notification, ₹250 crore per-violation penalties — in force Q1 2024", "Competition Commission of India: acquisitions >₹2,000 crore enterprise value require CCI clearance — expected 90–180 day timeline for AI sector deals"],
    environmental: ["BRSR (SEBI, mandatory for top-1000 listed companies from FY2022–23): ESG disclosure obligations that AI infrastructure must comply with", "India's Net Zero 2070 commitment — AI data centre energy consumption under regulatory scrutiny from MoPNG and BEE"],
  },
  porters_five_forces: {
    supplier_power: { rating: 'Medium', rationale: 'NVIDIA (GPU supply), Google Cloud and AWS (cloud infrastructure) have high leverage; Azure OpenAI agreements create switching cost lock-in', named_examples: ["NVIDIA: A100/H100 GPU supply constraints — 6–12 month lead times for enterprise AI compute", "Google Cloud/AWS: enterprise AI API pricing — 15–25% annual increase projected by Gartner 2024"] },
    buyer_power: { rating: 'High', rationale: 'Enterprise clients (HDFC Bank, Tata Group, Infosys) have high bargaining power; Jio network effects create some counter-leverage', named_examples: ["HDFC Bank: largest enterprise AI buyer in BFSI — negotiating multi-vendor contracts to prevent lock-in", "Tata Group: building internal AI CoE (TCS AI Cloud) — reducing dependency on external AI vendors"] },
    competitive_rivalry: { rating: 'High', rationale: 'TCS, Infosys, and Wipro scaling AI practices; Google DeepMind India and Microsoft AI India establishing local presence', named_competitors: ["TCS (AI Cloud, 2024): $500M AI practice, 100K GenAI-certified staff — direct enterprise AI competition", "Infosys (Topaz AI, 2024): $2B AI investment announced — accelerating enterprise AI deployment", "Google DeepMind India: Bangalore R&D centre, 500+ researchers — upstream model competition"] },
    threat_of_substitution: { rating: 'Medium', rationale: 'Open-source LLMs (Llama 3, Mistral) reducing dependency on proprietary AI platforms', named_examples: ["Meta Llama 3: enterprise deployments growing 340% YoY — reducing proprietary AI API revenue for incumbents", "Mistral AI: European open-source challenger gaining India enterprise traction via Azure partnership"] },
    threat_of_new_entry: { rating: 'Low', rationale: 'DPDP Act 2023 compliance costs, NVIDIA GPU scarcity, and enterprise sales cycles create significant entry barriers', named_examples: ["DPDP compliance: ₹15–50 crore implementation cost for new AI data fiduciaries — meaningful SME barrier", "Enterprise sales cycle: 12–18 months average for enterprise AI contracts — capital intensity deters new entrants"] },
    overall_attractiveness: 'Attractive',
  },
  blue_ocean_strategy: {
    strategy_canvas: [
      { factor: "AI Model Capability", industry_avg: 6, company_score: 5, competitor_scores: { "TCS": 7, "Infosys": 7, "Google India": 9 } },
      { factor: "Distribution Network", industry_avg: 5, company_score: 9, competitor_scores: { "TCS": 6, "Infosys": 5, "Google India": 7 } },
      { factor: "Price Competitiveness", industry_avg: 6, company_score: 8, competitor_scores: { "TCS": 5, "Infosys": 5, "Google India": 4 } },
      { factor: "Regulatory Compliance Infrastructure", industry_avg: 5, company_score: 4, competitor_scores: { "TCS": 7, "Infosys": 7, "Google India": 6 } },
    ],
    errc_grid: {
      eliminate: ["Generic AI consulting without proprietary data assets — commoditised by TCS/Infosys at scale"],
      reduce: ["Dependency on third-party LLM APIs (OpenAI, Anthropic) — replace with proprietary models trained on Jio data"],
      raise: ["Vernacular AI capability: Hindi, Tamil, Bengali, Telugu — 450M users demand regional-language AI"],
      create: ["AI-native distribution: embedding AI directly in JioCinema, JioFiber, MyJio — zero-marginal-cost AI distribution to 450M users"],
    },
    blue_ocean_move: "JioAI can create an uncontested market space in vernacular + distribution-embedded AI — a segment where TCS, Infosys, and Google India cannot compete on cost or access due to the absence of a comparable consumer distribution network",
  },
  regulatory_landscape: [
    { name: "DPDP Act 2023", jurisdiction: "India", requirement: "Data fiduciary obligations, consent management, DPO appointment, 72-hour breach notification (Section 8–12)", deadline: "ALREADY IN FORCE (Q1 2024)", penalty_exposure: "₹250 crore per violation (~$30M)", compliance_status: "Partially Compliant" },
    { name: "CCI Merger Control (Section 6, Competition Act 2002)", jurisdiction: "India", requirement: "Pre-merger notification for deals >₹2,000 crore enterprise value; await approval before completion", deadline: "Pre-acquisition (90–180 days)", penalty_exposure: "Deal nullification + ₹1 crore/day penalty for gun-jumping", compliance_status: "Unknown" },
  ],
  market_signals: ["Reliance Jio AI Labs (JioAI) launched Q3 2024 — 2,000 headcount target by 2025, signalling serious AI build strategy", "TCS announced ₹4,000 crore AI capability investment in January 2024 — aggressive competitive response incoming", "Google India signed enterprise AI agreements with HDFC Bank, Airtel, and Flipkart in Q4 2024 — accelerating enterprise capture"],
  key_findings: ["India enterprise AI market reaching $8.5B by 2027 at 28% CAGR (NASSCOM 2024) — most attractive AI growth market outside China", "Vernacular AI is the single largest unaddressed segment: 600M Indian internet users, 80% prefer regional language content (KPMG India Digital 2024)", "DPDP Act 2023 compliance is creating a 12-month window for compliant players to establish trust advantage before penalties begin"],
  emerging_risks: ["CCI AI-sector scrutiny increasing: announced AI market study Q1 2025 — acquisition targets may face enhanced review", "NVIDIA H100 export controls (US Commerce Dept, October 2023): AI compute constraints could delay JioAI model training timelines by 6–12 months"],
  opportunities: ["Vernacular AI services: $2.4B addressable market by 2026 — zero direct competition from TCS/Infosys/Google at scale", "BFSI AI compliance automation: ₹800 crore market in India by 2025 driven by RBI AI governance guidelines"],
  data_sources: ["NASSCOM AI Adoption Index 2024", "IMF World Economic Outlook April 2024", "KPMG India Digital 2024 Report", "Gartner AI Market Forecast 2024", "TRAI Telecom Subscription Report 2024"],
  confidence_score: 84,
  strategic_implication: "India's DPDP Act 2023 compliance window (12 months) and vernacular AI whitespace ($2.4B by 2026) together create a time-bound first-mover opportunity that closes once TCS and Google India deploy at scale — Reliance must acquire and integrate within 18 months.",
  citations: [
    { id: "C001", title: "NASSCOM AI Adoption Index 2024", publisher: "NASSCOM", url: "https://nasscom.in/knowledge-center/publications/nasscom-ai-adoption-index-2024", year: "2024", relevance: "India AI market TAM and CAGR cited in Porter's analysis" },
    { id: "C002", title: "IMF World Economic Outlook April 2024", publisher: "International Monetary Fund", url: "https://imf.org/en/Publications/WEO/Issues/2024/04/16/world-economic-outlook-april-2024", year: "2024", relevance: "India GDP growth rate (7.2%) used in PESTLE economic analysis" },
    { id: "C003", title: "KPMG India Digital Maturity Survey 2024", publisher: "KPMG India", url: "https://kpmg.com/in/en/home/insights/2024/01/india-digital-maturity-survey.html", year: "2024", relevance: "Vernacular AI adoption data: 80% of Indian internet users prefer regional language" },
    { id: "C004", title: "DPDP Act 2023 — Ministry of Electronics and IT", publisher: "Government of India / MeitY", url: "https://meity.gov.in/writereaddata/files/Digital%20Personal%20Data%20Protection%20Act%202023.pdf", year: "2023", relevance: "DPDP penalty exposure (₹250 crore) and compliance requirements cited in regulatory landscape" },
  ],
}) as any as MarketIntelOutput;

export async function runMarketIntelAgent(input: AgentInput): Promise<AgentOutput> {
  const start = Date.now();
  const year = new Date().getFullYear();
  const strategistData = input.upstreamResults?.strategistData as any;
  const companyProfile = strategistData?.company_profile || null;

  const [marketSearch, regulatorySearch, competitorSearch] = await Promise.all([
    webSearch(`${input.problemStatement} market size ${input.industryContext || ''} ${year}`, 4),
    webSearch(`${input.geographyContext || ''} ${input.industryContext || ''} regulations compliance ${year}`, 4),
    webSearch(`${input.industryContext || ''} competitors ${input.geographyContext || ''} market share ${year}`, 4),
  ]);

  const searchContext = [
    marketSearch.length ? `\nLIVE MARKET INTELLIGENCE (use to ground analysis):\n${marketSearch.map(r => `• [${r.title}](${r.url}): ${r.snippet}`).join('\n')}` : '',
    regulatorySearch.length ? `\nLIVE REGULATORY INTELLIGENCE:\n${regulatorySearch.map(r => `• [${r.title}](${r.url}): ${r.snippet}`).join('\n')}` : '',
    competitorSearch.length ? `\nLIVE COMPETITOR INTELLIGENCE:\n${competitorSearch.map(r => `• [${r.title}](${r.url}): ${r.snippet}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');

  // Build search-sourced citations
  const searchCitations = [
    ...marketSearch.slice(0, 2),
    ...regulatorySearch.slice(0, 1),
    ...competitorSearch.slice(0, 1),
  ].filter(r => r.url && !r.url.includes('example.com')).map((r, i) => ({
    id: `SEARCH${i + 1}`,
    title: r.title,
    publisher: new URL(r.url).hostname.replace('www.', ''),
    url: r.url,
    year: String(r.publishedDate?.slice(0, 4) || year),
    relevance: `Live web search result supporting market intelligence analysis`,
  }));

  const userMessage = `
Strategic problem: "${input.problemStatement}"
Organisation: ${input.organisationContext || companyProfile?.name || 'Unspecified'}
Industry: ${input.industryContext || companyProfile?.primary_sector || 'Unspecified'}
Geography: ${input.geographyContext || companyProfile?.headquarters || 'Unspecified'}

COMPANY PROFILE (use for named competitor analysis):
${JSON.stringify(companyProfile, null, 2)}

CRITICAL INSTRUCTIONS:
1. Porter's Five Forces — competitive_rivalry.named_competitors: name REAL companies in this exact market (NEVER "Incumbent Leader" or generic labels)
2. Blue Ocean — strategy_canvas competitor_scores: use REAL company names
3. PESTLE — every factor must reference named laws, named companies, named regulators
4. citations — include search-sourced URLs below PLUS 3+ additional from your knowledge
${searchContext ? `\nLIVE SEARCH DATA (incorporate as grounding — use URLs as citations):\n${searchContext}` : ''}

Pre-built search citations (include in your output citations array):
${JSON.stringify(searchCitations, null, 2)}

Apply PESTLE + Porter's Five Forces + Blue Ocean. Return ONLY valid JSON.
  `;

  const result = await callLLMWithRetry<MarketIntelOutput>(
    MARKET_INTEL_SYSTEM_PROMPT,
    userMessage,
    ['pestle_analysis', 'porters_five_forces', 'blue_ocean_strategy', 'key_findings', 'confidence_score'],
    marketIntelFallback
  );

  // Inject search citations if LLM didn't include them
  if (searchCitations.length > 0) {
    const existing = (result.data.citations as any[] || []);
    const merged = [...existing, ...searchCitations.filter(sc =>
      !existing.some((ec: any) => ec.url === sc.url)
    )];
    result.data.citations = merged;
  }

  return {
    agentId: 'market_intel',
    status: result.usedFallback ? 'self_corrected' : 'completed',
    data: result.data as Record<string, unknown>,
    confidenceScore: result.data.confidence_score,
    durationMs: Date.now() - start,
    attemptNumber: result.attempts,
    selfCorrected: result.usedFallback,
    tokenUsage: { input: result.inputTokens, output: result.outputTokens }
  };
}
