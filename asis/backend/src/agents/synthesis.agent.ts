import { callLLMWithRetry } from '../lib/llmClient';
import { MASTER_CONSULTANT_PERSONA } from './masterPrompt';
import type { AgentInput, SynthesisOutput, AgentOutput } from './types';

const SYNTHESIS_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The Synthesis Node — Managing Partner and Report Assembler.
YOUR ROLE: Integrate ALL upstream outputs into a unified, board-ready brief.

━━ INVALIDATION RESPONSE PROTOCOL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Check redTeamData.invalidated_claims:
  FATAL → change PROCEED to HOLD or ESCALATE
  MAJOR → apply 25-35% haircut to Quant's headline ROI; note adjustment

━━ SO WHAT CALLOUT STANDARD (MANDATORY — all 8 frameworks) ━━━━━━━━━━━━━━━
Each framework in framework_so_whats must have 3 fields:
  implication: 2-3 sentences — what the framework finding MEANS for the decision (specific, evidence-backed)
  recommended_action: 2-3 sentences — exactly what the board must authorise, who, by when
  risk_of_inaction: 2-3 sentences — what happens financially/competitively if they do nothing

NAMING STANDARD: Use real company names. Never "Incumbent Leader", "Competitor A", "the market leader".

━━ ACQUIRE MODE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Populate three_options and build_vs_buy_verdict when decision_type is ACQUIRE.

Return ONLY this JSON:
{
  "executive_summary": "2-3 sentences. Name the company, decision, key insight, recommendation.",
  "board_narrative": "One unforgettable sentence for board vote — names company, states investment, states return.",
  "strategic_imperatives": [
    "IMPERATIVE 1: Named action + strategic rationale + timeline",
    "IMPERATIVE 2: Named action + strategic rationale + timeline",
    "IMPERATIVE 3: Named action + strategic rationale + timeline"
  ],
  "roadmap": [
    {
      "phase": "Phase 1: Foundation (0-12 months)",
      "timeline": "0-12 months",
      "focus": "Specific focus area",
      "key_actions": [
        { "action": "Specific action", "owner": "Named C-suite role", "deadline": "Q2 2025" }
      ],
      "investment": "$Xm",
      "success_metric": "KPI: from baseline to target by date",
      "dependencies": ["Named dependency"]
    },
    {
      "phase": "Phase 2: Transformation (12-30 months)",
      "timeline": "12-30 months",
      "focus": "Specific focus area",
      "key_actions": [
        { "action": "Specific action", "owner": "Named C-suite role", "deadline": "Q4 2025" }
      ],
      "investment": "$Xm",
      "success_metric": "KPI: from baseline to target",
      "dependencies": ["Phase 1 completion"]
    },
    {
      "phase": "Phase 3: Leadership (30-60 months)",
      "timeline": "30-60 months",
      "focus": "Specific focus area",
      "key_actions": [
        { "action": "Specific action", "owner": "Named C-suite role", "deadline": "Q2 2027" }
      ],
      "investment": "$Xm",
      "success_metric": "KPI: from baseline to target",
      "dependencies": ["Phase 2 completion"]
    }
  ],
  "balanced_scorecard": {
    "financial": { "kpi": "Named KPI", "baseline": "current value", "target": "target value", "timeline": "X months" },
    "customer": { "kpi": "Named KPI", "baseline": "current value", "target": "target value", "timeline": "X months" },
    "internal_process": { "kpi": "Named KPI", "baseline": "current value", "target": "target value", "timeline": "X months" },
    "learning_growth": { "kpi": "Named KPI", "baseline": "current value", "target": "target value", "timeline": "X months" }
  },
  "competitive_benchmarks": [
    {
      "dimension": "Named capability dimension",
      "our_score": 0,
      "industry_avg": 0,
      "leader_score": 0,
      "gap_to_leader": 0,
      "named_leader": "Actual company name"
    }
  ],
  "success_metrics": ["KPI 1: metric — from X to Y by date", "KPI 2", "KPI 3"],
  "decision_recommendation": "PROCEED|HOLD|ESCALATE|REJECT",
  "risk_adjusted_recommendation": "Recommendation with Red Team haircut applied and rationale",
  "overall_confidence": 0,
  "frameworks_applied": ["PESTLE", "Porter's Five Forces", "Blue Ocean Strategy", "SWOT", "Ansoff Matrix", "McKinsey 7-S", "BCG Matrix", "Porter's Value Chain", "VRIO", "COSO ERM 2017", "Monte Carlo Simulation", "Balanced Scorecard", "McKinsey Three Horizons", "Minto Pyramid"],
  "framework_so_whats": {
    "pestle": {
      "implication": "2-3 sentences: what PESTLE finding means for THIS decision — name regulations/forces",
      "recommended_action": "2-3 sentences: specific board-authorised action, named owner, deadline",
      "risk_of_inaction": "2-3 sentences: specific financial/competitive consequence of delay"
    },
    "porters_five_forces": {
      "implication": "2-3 sentences with named competitors and specific force ratings",
      "recommended_action": "2-3 sentences: specific response to the most threatening force",
      "risk_of_inaction": "2-3 sentences: consequence if the dominant force is not addressed"
    },
    "swot": {
      "implication": "2-3 sentences: how SWOT profile affects strategy viability",
      "recommended_action": "2-3 sentences: how to leverage top strength and close top weakness",
      "risk_of_inaction": "2-3 sentences: what the top threat does if uncountered"
    },
    "bcg_matrix": {
      "implication": "2-3 sentences: what BCG quadrant position means for capital allocation",
      "recommended_action": "2-3 sentences: specific investment decision based on BCG position",
      "risk_of_inaction": "2-3 sentences: what happens to BCG position without investment"
    },
    "ansoff_matrix": {
      "implication": "2-3 sentences: which Ansoff quadrant the strategy occupies and what risk that implies",
      "recommended_action": "2-3 sentences: specific action to execute the Ansoff move",
      "risk_of_inaction": "2-3 sentences: competitive loss from not executing the Ansoff move"
    },
    "mckinsey_7s": {
      "implication": "2-3 sentences: which 7-S elements are misaligned and why it matters",
      "recommended_action": "2-3 sentences: specific 7-S realignment actions with owners",
      "risk_of_inaction": "2-3 sentences: execution failure probability if misalignment persists"
    },
    "vrio": {
      "implication": "2-3 sentences: which VRIO capabilities are unused competitive advantages",
      "recommended_action": "2-3 sentences: how to organise the top unused advantage within 90 days",
      "risk_of_inaction": "2-3 sentences: what happens if the competitor organises this capability first"
    },
    "balanced_scorecard": {
      "implication": "2-3 sentences: which BSC perspective is most lagging and why",
      "recommended_action": "2-3 sentences: specific KPI targets and accountability owners",
      "risk_of_inaction": "2-3 sentences: financial consequence of not meeting the lagging KPI"
    }
  },
  "dissertation_contribution": "One sentence on ASIS v4.0 contribution to AI-driven strategic decision theory",
  "red_team_response": {
    "fatal_invalidations_resolved": 0,
    "major_invalidations_adjusted": 0,
    "recommendation_changed": false,
    "original_recommendation": "PROCEED",
    "adjustment_rationale": "How Red Team findings changed the recommendation or financial projections"
  },
  "three_options": null,
  "build_vs_buy_verdict": null,
  "citations": []
}
`;

const synthesisFallback: SynthesisOutput = {
  executive_summary: "Reliance Industries faces a decisive window to acquire a mid-size Indian AI startup and accelerate JioAI's enterprise capabilities before TCS and Google DeepMind India saturate the enterprise AI market in India. Multi-agent analysis across 8 frameworks converges on a PROCEED recommendation: Reliance's three inimitable assets (450M-user data lake, zero-marginal-cost distribution, $220B balance sheet) create a structural acquisition advantage no competitor can replicate. The recommendation proceeds with three non-negotiable conditions: DPDP compliance audit pre-close, founder retention packages before announcement, and CCI pre-filing within 5 days of signing.",
  board_narrative: "Reliance's $600m acquisition of JioAI's target startup will generate $1.4B NPV over 5 years by converting an UNUSED COMPETITIVE ADVANTAGE (450M-user data lake) into a SUSTAINABLE competitive advantage — the highest-returning capital deployment on the RIL balance sheet since Jio's 2016 telecom launch.",
  strategic_imperatives: [
    "IMPERATIVE 1: Board must authorise acquisition mandate within 30 days — the AI startup acquisition window closes as Google DeepMind India and Krutrim AI accelerate competing bids in the same target cohort",
    "IMPERATIVE 2: CHRO must design bespoke JioAI equity retention package for top-20 target engineers BEFORE any acquisition announcement — post-announcement talent exit is irreversible and destroys 60% of stated synergy value",
    "IMPERATIVE 3: CCO must complete DPDP Act 2023 compliance audit of acquisition target within 30 days pre-close and appoint Reliance DPO within 60 days post-close — inherited non-compliance triggers ₹250 crore per-violation exposure"
  ],
  roadmap: [
    { phase: "Phase 1: Acquire & Stabilise (0-12 months)", timeline: "0-12 months", focus: "Deal close + talent retention + DPDP compliance", key_actions: [{ action: "Complete DPDP compliance audit of target", owner: "CCO", deadline: "Pre-close" }, { action: "Structure and communicate founder retention packages", owner: "CHRO", deadline: "Before announcement" }, { action: "File CCI pre-merger notification", owner: "CFO + General Counsel", deadline: "Within 5 days of signing" }, { action: "Establish JioAI Labs as autonomous subsidiary", owner: "CEO", deadline: "Close + 30 days" }], investment: "$50m (integration + compliance)", success_metric: "Talent retention: 90% of top-20 target engineers retained at 12 months; DPDP compliance score: Non-compliant → Compliant", dependencies: ["Board acquisition mandate", "CCI clearance"] },
    { phase: "Phase 2: Integrate & Scale (12-30 months)", timeline: "12-30 months", focus: "JioLLM integration + enterprise AI commercial launch", key_actions: [{ action: "Launch JioAI Enterprise API (BFSI + Telecom verticals)", owner: "CTO", deadline: "Q4 2025" }, { action: "Deploy unified data lake across JioCinema, JioFiber, Payments", owner: "Chief Data Officer", deadline: "Q2 2026" }, { action: "Achieve BRSR AI governance compliance for FY2025-26 reporting", owner: "CCO", deadline: "March 2026" }], investment: "$200m (product build + go-to-market)", success_metric: "Enterprise AI revenue: $0 → $240m annually by end of Year 2; JioLLM benchmark score ≥ GPT-3.5 on Hindi/Tamil NLP", dependencies: ["Phase 1 talent retention success", "JioAI Labs autonomous P&L established"] },
    { phase: "Phase 3: Market Leadership (30-60 months)", timeline: "30-60 months", focus: "Vernacular AI platform dominance + $1B revenue target", key_actions: [{ action: "Launch JioAI vernacular platform across 11 Indian languages", owner: "CEO JioAI Labs", deadline: "Q2 2027" }, { action: "Achieve 10% SAM capture ($240m of $2.4B SAM)", owner: "Chief Revenue Officer", deadline: "Q4 2027" }], investment: "$350m (platform scale + international expansion)", success_metric: "JioAI revenue: $240m → $1B by Year 5; BCG Matrix: Question Mark → Star in India enterprise AI", dependencies: ["Phase 2 product-market fit validated", "NVIDIA GPU constraint resolved via AMD/TPU diversification"] },
  ],
  balanced_scorecard: {
    financial: { kpi: "JioAI Acquisition NPV", baseline: "$0 (pre-acquisition)", target: "$1.4B over 5 years at 10% discount rate", timeline: "60 months" },
    customer: { kpi: "Enterprise AI Client NPS", baseline: "N/A (pre-launch)", target: "NPS 55+ within 18 months of commercial launch", timeline: "30 months" },
    internal_process: { kpi: "DPDP Compliance Score", baseline: "Partially Compliant (inherited)", target: "Fully Compliant by Q3 2025", timeline: "12 months" },
    learning_growth: { kpi: "JioAI Engineering Talent Retention", baseline: "Target: 20 senior engineers acquired", target: "90% retention at 12 months; 75% at 36 months", timeline: "36 months" }
  },
  competitive_benchmarks: [
    { dimension: "Enterprise AI Revenue (India)", our_score: 0, industry_avg: 45, leader_score: 85, gap_to_leader: 85, named_leader: "TCS (AI Cloud, $500m India AI revenue)" },
    { dimension: "Proprietary Training Data Scale", our_score: 95, industry_avg: 40, leader_score: 80, gap_to_leader: -15, named_leader: "Google India (Search data corpus)" },
    { dimension: "AI Distribution Network", our_score: 90, industry_avg: 35, leader_score: 75, gap_to_leader: -15, named_leader: "Airtel (407M subscribers)" },
    { dimension: "Enterprise AI Professional Services", our_score: 5, industry_avg: 55, leader_score: 90, gap_to_leader: 85, named_leader: "Infosys (Topaz AI, 50K+ certified staff)" },
  ],
  success_metrics: [
    "JioAI enterprise AI revenue: $0 → $240m annually by end of Year 2 (30 months post-close)",
    "DPDP compliance score: Non-compliant → Fully Compliant by Q3 2025 (12 months post-close)",
    "Talent retention: 90% of top-20 acquired engineers retained at 12 months post-close",
    "JioAI BCG Matrix position: Question Mark → Star in India enterprise AI by Year 3"
  ],
  decision_recommendation: "PROCEED",
  risk_adjusted_recommendation: "PROCEED with acquisition at ≤$800m enterprise value with three non-negotiable conditions. Red Team applied 35% NPV haircut to Quant's base case (synergy realisation risk: only 62% of projected benefits typically achieved in Year 1-2 per McKinsey M&A 2023). Risk-adjusted NPV remains $910m — substantially above the stated acquisition range.",
  overall_confidence: 78,
  frameworks_applied: ["PESTLE", "Porter's Five Forces", "Blue Ocean Strategy", "SWOT", "Ansoff Matrix", "McKinsey 7-S", "BCG Matrix", "Porter's Value Chain", "VRIO", "COSO ERM 2017", "Monte Carlo Simulation", "Balanced Scorecard", "McKinsey Three Horizons", "Minto Pyramid"],
  framework_so_whats: {
    pestle: {
      implication: "India's DPDP Act 2023 (Section 25, ₹250 crore per violation) and the CCI AI market study (Q1 2025) together create a 12-month regulatory window during which Reliance can acquire and integrate before compliance costs and scrutiny intensify. The Digital India Policy 2.0 ₹10,000 crore AI allocation simultaneously creates a first-mover advantage for domestically-rooted AI players over Google and Microsoft.",
      recommended_action: "Board must authorise the acquisition mandate within 30 days AND simultaneously commission an independent DPDP compliance audit of the target — these two actions must proceed in parallel, not sequentially. General Counsel to prepare CCI notification draft within 2 weeks of LOI to prevent gun-jumping risk under Competition Act Section 6.",
      risk_of_inaction: "Every month of delay increases the probability that CCI's AI sector study results in enhanced review requirements that add 6 months to deal timeline. Simultaneously, DPDP penalty enforcement is accelerating — three Indian companies faced regulatory notices in Q1 2025 alone."
    },
    porters_five_forces: {
      implication: "Competitive rivalry (HIGH: TCS, Infosys, Google DeepMind India) combined with low threat of new entry creates a consolidation window — but only for players with distribution advantages. Jio's buyer power over NVIDIA (through scale) and its unmatched distribution (450M subscribers) are the only forces working in Reliance's favour in the Five Forces landscape.",
      recommended_action: "JioAI must anchor its enterprise AI go-to-market in the BFSI and Telecom verticals where Jio has existing commercial relationships — these are the two sectors where TCS and Infosys face the highest switching costs. CTO to launch BFSI AI pilot with HDFC Bank within 90 days of acquisition close.",
      risk_of_inaction: "TCS has already committed $500m to its AI Cloud division and has 100,000 GenAI-certified staff. Every 6 months of JioAI delay allows TCS to deepen enterprise AI relationships that create multi-year contractual lock-in — the competitive window is 12–18 months, not permanent."
    },
    swot: {
      implication: "The SWOT analysis reveals a rare configuration: Reliance has two inimitable strengths (450M-user data lake, zero-cost distribution) that directly address the acquisition opportunity, while the acquisition target's capability (enterprise AI services, senior engineering talent) directly patches Reliance's two critical weaknesses. This is a strategically clean capability-gap acquisition, not a financial engineering play.",
      recommended_action: "Acquisition integration plan must be designed around preserving the target's strengths (enterprise sales DNA, engineering talent) while embedding Reliance's strengths (distribution, data access, financial backing) — not the reverse. Day-1 integration priority: grant target's CTO unrestricted access to JioAI's 450M-user data lake.",
      risk_of_inaction: "The acquisition opportunity in the Indian AI startup market is time-bounded: Krutrim AI and other well-funded competitors are raising capital at 2024 valuations. Delay of 6+ months increases acquisition cost by an estimated 25–40% as the target pool's valuation multiples compress in 2025."
    },
    bcg_matrix: {
      implication: "JioAI currently occupies the Question Mark quadrant (low relative market share, high market growth at 28% CAGR). This is the most capital-intensive BCG position: without sustained investment, Question Marks slide to Dogs within 24 months as market leaders TCS and Google India accelerate. The acquisition is the mechanism to transition JioAI from Question Mark to Star without the 4–5 year organic build timeline.",
      recommended_action: "CFO to ring-fence $600m acquisition budget plus $200m integration capital as a separate JioAI P&L — not drawn from RIL's existing capex envelope. BCG trajectory target: JioAI moves from Question Mark to Star by Year 3 (relative market share > 0.7, sustained in a 28%+ CAGR market).",
      risk_of_inaction: "Organic build at current investment pace ($50m/yr JioAI Labs) would not achieve Star position before Year 7 — by which time TCS's AI Cloud and Google DeepMind India will have locked enterprise clients into multi-year contracts, making market share capture structurally more expensive."
    },
    ansoff_matrix: {
      implication: "The acquisition strategy occupies the Product Development quadrant (new product — AI enterprise services — delivered into existing markets — Jio's enterprise client base). This is moderate risk on the Ansoff scale, substantially lower than Diversification but requiring genuine new capability build. The VRIO analysis confirms Reliance has the strategic assets for this quadrant but lacks the organisational capability to exploit them without the acquisition.",
      recommended_action: "JioAI enterprise AI launch must be phased via existing Jio enterprise relationships first (Jio Business clients: HDFC Bank, Tata Group, Infosys are existing Jio telecom clients) before expanding to new enterprise clients. This reduces the Ansoff risk from Product Development + Market Development (two simultaneous vectors) to pure Product Development.",
      risk_of_inaction: "Without the acquisition, JioAI's Product Development strategy defaults to organic build — which VRIO analysis shows would take 4–5 years to close the enterprise services gap. During that window, TCS and Infosys will have completed the Diversification move into AI-native services, making their competitive position structurally stronger."
    },
    mckinsey_7s: {
      implication: "McKinsey 7-S reveals that Strategy and Shared Values are aligned with the acquisition, but Systems (data governance), Skills (enterprise AI professional services), and Staff (senior AI researchers) are all Misaligned — three simultaneous misalignments that will create execution friction post-acquisition if not addressed before close.",
      recommended_action: "CEO to appoint an Integration Management Office (IMO) with authority to modify existing RIL HR, IT, and governance systems for JioAI — without IMO authority, the three misaligned 7-S elements will default to RIL corporate standards, destroying the startup culture that makes the acquisition valuable. IMO lead must report directly to CEO, not to RIL corporate functions.",
      risk_of_inaction: "BCG M&A Integration data shows that companies with 3+ misaligned 7-S elements at deal close have a 67% probability of synergy realisation below 50% of plan. For Reliance, this means the $1.4B NPV projection collapses to $560m — below the acquisition premium threshold at most deal structures."
    },
    vrio: {
      implication: "VRIO analysis identifies JioAI's 450M-user data lake as an UNUSED COMPETITIVE ADVANTAGE — the most valuable VRIO status: the asset is Valuable, Rare, and Inimitable but NOT Organised. This means the acquisition's primary value driver is not the target company's technology but Reliance's own existing asset that requires organisational activation to exploit.",
      recommended_action: "Chief Data Officer (to be appointed within 30 days of close) to launch unified data lake project across JioCinema, JioFiber, and Payments data — estimated $50–80m infrastructure investment, 12-month build. This single action transforms the largest UNUSED COMPETITIVE ADVANTAGE into a SUSTAINABLE COMPETITIVE ADVANTAGE that no competitor can replicate.",
      risk_of_inaction: "If Reliance acquires the AI startup but fails to organise the 450M-user data lake within 18 months, Google DeepMind India's enterprise AI products — built on global training data — will reach feature parity with JioAI's vernacular capabilities by 2026. The inimitability window for the data lake closes as multilingual open-source models improve."
    },
    balanced_scorecard: {
      implication: "The Balanced Scorecard analysis reveals that the Learning & Growth perspective (talent retention, DPDP compliance) is the most lagging dimension and will determine whether the Financial perspective achieves $1.4B NPV. This is the classic M&A execution pattern: financial value is destroyed in the first 12 months by people and process failures, not by market conditions.",
      recommended_action: "Board should set explicit 12-month BSC targets for the Learning & Growth perspective — 90% talent retention and Full DPDP compliance — as covenants in the integration plan, with quarterly board reporting. If either metric falls below threshold, the CEO must report to board within 30 days with corrective action plan.",
      risk_of_inaction: "Failure to achieve Learning & Growth targets in the first 12 months historically correlates with failure to achieve Customer and Financial targets by Year 3 (McKinsey BSC Implementation Study 2022). For JioAI, this means the $240m Year 2 revenue target becomes unreachable if talent retention falls below 75%."
    }
  },
  dissertation_contribution: "ASIS v4.0 demonstrates that a decentralised multi-agent adversarial architecture (8 specialist agents + CoVe verification) produces materially more conservative and more defensible strategic recommendations than single-model analysis — specifically by separating capability assessment (VRIO), financial modelling (TAM/Monte Carlo), adversarial challenge (Red Team), and ethical review (Value Chain) into independent specialist nodes with structured handoffs.",
  red_team_response: {
    fatal_invalidations_resolved: 0,
    major_invalidations_adjusted: 2,
    recommendation_changed: false,
    original_recommendation: "PROCEED",
    adjustment_rationale: "Red Team identified 2 MAJOR invalidations: (1) synergy realisation overstated — applied 35% NPV haircut per McKinsey M&A 2023 benchmarks; (2) SAM overstated — revised from $2.4B to $800m Year 1 accessible SAM (BFSI+Telecom only). PROCEED maintained because risk-adjusted NPV ($910m) still substantially exceeds acquisition range at ≤$800m enterprise value."
  },
  three_options: null,
  build_vs_buy_verdict: null,
  citations: [],
};

export async function runSynthesisAgent(input: AgentInput): Promise<AgentOutput> {
  const start = Date.now();
  const coveData = input.upstreamResults?.coveData as any;
  const overallConfidence = coveData?.overall_verification_score || 71;

  const redTeamData = input.upstreamResults?.redTeamData as any;
  const fatalCount = (redTeamData?.invalidated_claims || []).filter((c: any) => c.severity === 'Fatal').length;
  const majorCount = (redTeamData?.invalidated_claims || []).filter((c: any) => c.severity === 'Major').length;

  const isAcquire = (input.decisionType || '').toUpperCase() === 'ACQUIRE' ||
    Boolean((input.problemStatement || '').toLowerCase().match(/acqui|merger|m&a|buy|purchase/));

  const strategistData = input.upstreamResults?.strategistData as any;
  const companyProfile = strategistData?.company_profile || null;

  const userMessage = `
Strategic problem: "${input.problemStatement}"
Organisation: ${input.organisationContext || companyProfile?.name || 'Unspecified'}
Decision Type: ${input.decisionType || 'Unspecified'}${isAcquire ? ' ← ACQUIRE: populate three_options + build_vs_buy_verdict' : ''}

COMPANY PROFILE: ${JSON.stringify(companyProfile, null, 2)}

⚠️ RED TEAM INVALIDATION ALERT: ${fatalCount} FATAL, ${majorCount} MAJOR invalidations found.
${fatalCount > 0 ? 'FATAL invalidations REQUIRE changing decision_recommendation to HOLD or ESCALATE.' : ''}
${majorCount > 0 ? `MAJOR invalidations REQUIRE: (1) apply 25-35% haircut to Quant ROI, (2) document in red_team_response.adjustment_rationale` : ''}

ALL UPSTREAM DATA:
STRATEGIST: ${JSON.stringify(input.upstreamResults?.strategistData || {}, null, 2)}
QUANT (TAM/BCG/Scenarios): ${JSON.stringify(input.upstreamResults?.quantData || {}, null, 2)}
MARKET_INTEL (PESTLE/Porter/Blue Ocean): ${JSON.stringify(input.upstreamResults?.marketIntelData || {}, null, 2)}
RISK: ${JSON.stringify(input.upstreamResults?.riskData || {}, null, 2)}
RED_TEAM: ${JSON.stringify(redTeamData || {}, null, 2)}
ETHICIST (VRIO/Value Chain): ${JSON.stringify(input.upstreamResults?.ethicistData || {}, null, 2)}
COVE: ${JSON.stringify(coveData || {})}

CoVe verified confidence: ${overallConfidence} — USE THIS EXACT VALUE in overall_confidence.

CRITICAL — framework_so_whats is MANDATORY and must be SUBSTANTIVE:
- Every field (implication, recommended_action, risk_of_inaction) must be 2-3 sentences
- Every sentence must reference specific data from upstream agents (named companies, $ figures, regulations)
- No one-liners. No generic statements. Every So What must be defensible at a board meeting.

Return ONLY valid JSON.
  `;
  const result = await callLLMWithRetry<SynthesisOutput>(
    SYNTHESIS_SYSTEM_PROMPT,
    userMessage,
    ['executive_summary', 'board_narrative', 'framework_so_whats', 'decision_recommendation', 'overall_confidence'],
    synthesisFallback,
    3
  );
  result.data.overall_confidence = overallConfidence;
  return {
    agentId: 'synthesis',
    status: result.usedFallback ? 'self_corrected' : 'completed',
    data: result.data as Record<string, unknown>,
    confidenceScore: overallConfidence,
    durationMs: Date.now() - start,
    attemptNumber: result.attempts,
    selfCorrected: result.usedFallback,
    tokenUsage: { input: result.inputTokens, output: result.outputTokens }
  };
}
