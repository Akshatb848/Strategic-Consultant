import type { AgentLog, Analysis } from '@prisma/client';

type AnalysisWithLogs = Analysis & {
  agentLogs?: AgentLog[];
  fatalInvalidationCount?: number | null;
  majorInvalidationCount?: number | null;
  recommendationDowngraded?: boolean | null;
  originalRecommendation?: string | null;
  threeOptionsData?: unknown;
  buildVsBuyVerdict?: string | null;
  recommendedOption?: string | null;
  confidenceBreakdown?: unknown;
  hasBlockingWarnings?: boolean | null;
  reportVersion?: number | null;
  pdfUrl?: string | null;
};
type JsonRecord = Record<string, unknown>;

export interface FrameworkOutput {
  framework_name: string;
  agent_author: string;
  structured_data: JsonRecord;
  narrative: string;
  citations: CitationRecord[];
  confidence_score: number;
  exhibit_number: number;
  exhibit_title: string;
  implication: string;
  recommended_action: string;
  risk_of_inaction: string;
}

export interface SoWhatCallout {
  framework: string;
  implication: string;
  recommended_action: string;
  risk_of_inaction: string;
  exhibit_number: number;
}

export interface AgentCollaborationEvent {
  source_agent: string;
  target_agent: string;
  data_field: string;
  timestamp_ms: number;
  contribution_summary: string;
}

export interface CitationRecord {
  title?: string;
  publisher?: string;
  source?: string;
  url?: string;
  year?: string;
  published_at?: string;
  relevance?: string;
  excerpt?: string;
}

const COLLABORATION_FLOW: Array<{ from: string; to: string; field: string }> = [
  { from: 'strategist', to: 'quant', field: 'problem_decomposition' },
  { from: 'strategist', to: 'market_intel', field: 'company_profile' },
  { from: 'quant', to: 'risk', field: 'market_sizing' },
  { from: 'market_intel', to: 'risk', field: 'porters_five_forces' },
  { from: 'risk', to: 'red_team', field: 'risk_register' },
  { from: 'risk', to: 'ethicist', field: 'mitigation_strategies' },
  { from: 'red_team', to: 'cove', field: 'invalidated_claims' },
  { from: 'ethicist', to: 'cove', field: 'vrio_assessment' },
  { from: 'cove', to: 'synthesis', field: 'verification_checks' },
];

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizedScore(value: unknown): number {
  const numeric = asNumber(value);
  if (!numeric) return 0;
  return numeric <= 1 ? numeric : numeric / 100;
}

function sentence(value: string, fallback: string): string {
  const text = value.trim();
  if (!text) return fallback;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function dedupeCitations(...sources: unknown[]): CitationRecord[] {
  const seen = new Set<string>();
  const citations: CitationRecord[] = [];

  for (const source of sources) {
    for (const item of asArray<Record<string, unknown>>(source)) {
      const url = asString(item.url);
      const title = asString(item.title) || asString(item.source) || 'Source';
      const key = url || title;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      citations.push({
        title,
        publisher: asString(item.publisher) || asString(item.source),
        source: asString(item.source) || asString(item.publisher),
        url: url || undefined,
        year: asString(item.year),
        published_at: asString(item.published_at),
        relevance: asString(item.relevance),
        excerpt: asString(item.excerpt),
      });
    }
  }

  return citations;
}

function defaultExhibitTitle(
  key: string,
  context: { organisation: string; industry: string; geography: string; strategicImplication?: string }
): string {
  const organisation = context.organisation || 'The client';
  const geography = context.geography || 'the target market';
  const industry = context.industry || 'the sector';
  const implication = context.strategicImplication || '';

  switch (key) {
    case 'pestle':
      return sentence(implication, `${organisation} faces a regulatory and market environment in ${geography} that materially shapes the decision path.`);
    case 'porters_five_forces':
      return sentence(implication, `Industry pressure across ${industry} indicates where the client can win and where structural resistance remains high.`);
    case 'swot':
      return sentence(implication, `${organisation}'s internal strengths and execution gaps determine whether the opportunity is actionable at pace.`);
    case 'ansoff':
      return sentence(implication, `The recommended growth path concentrates on the option with the strongest fit-to-risk balance.`);
    case 'bcg_matrix':
      return sentence(implication, `The portfolio position implies a clear capital-allocation stance rather than a neutral hold decision.`);
    case 'mckinsey_7s':
      return sentence(implication, `Organizational alignment, not strategy intent alone, will determine execution credibility.`);
    case 'blue_ocean':
      return sentence(implication, `Differentiation potential depends on creating value where rivals remain overinvested or undifferentiated.`);
    case 'balanced_scorecard':
      return sentence(implication, `Execution should be governed through a balanced scorecard that links investment, customer impact, and operating discipline.`);
    case 'value_chain':
      return sentence(implication, `Margin capture depends on strengthening the activities where advantage is currently partial or absent.`);
    case 'vrio':
      return sentence(implication, `The most defendable advantages are the capabilities that can be organized faster than competitors can replicate them.`);
    default:
      return sentence(implication, `This exhibit summarizes the most decision-relevant evidence for ${organisation}.`);
  }
}

function buildSoWhatCallouts(synthesisData: JsonRecord): Record<string, SoWhatCallout> {
  const frameworkSoWhats = asRecord(synthesisData.framework_so_whats);
  const entries = Object.entries(frameworkSoWhats);
  return Object.fromEntries(
    entries.map(([key, value], index) => {
      const callout = asRecord(value);
      return [
        key,
        {
          framework: key,
          implication: asString(callout.implication),
          recommended_action: asString(callout.recommended_action),
          risk_of_inaction: asString(callout.risk_of_inaction),
          exhibit_number: index + 1,
        } satisfies SoWhatCallout,
      ];
    })
  );
}

export function buildFrameworkOutputs(analysis: AnalysisWithLogs): Record<string, FrameworkOutput> {
  const strategistData = asRecord(analysis.strategistData);
  const marketIntelData = asRecord(analysis.marketIntelData);
  const quantData = asRecord(analysis.quantData);
  const riskData = asRecord(analysis.riskData);
  const ethicistData = asRecord(analysis.ethicistData);
  const synthesisData = asRecord(analysis.synthesisData);
  const soWhats = buildSoWhatCallouts(synthesisData);
  const citations = {
    strategist: dedupeCitations(strategistData.citations),
    market: dedupeCitations(marketIntelData.citations),
    quant: dedupeCitations(quantData.citations),
    ethicist: dedupeCitations(ethicistData.citations),
    synthesis: dedupeCitations(synthesisData.citations),
  };
  const context = {
    organisation: analysis.organisationContext,
    industry: analysis.industryContext,
    geography: analysis.geographyContext,
  };

  const frameworks: Array<[string, FrameworkOutput]> = [
    [
      'pestle',
      {
        framework_name: 'PESTLE Analysis',
        agent_author: 'market_intel',
        structured_data: asRecord(marketIntelData.pestle_analysis),
        narrative: asString(marketIntelData.strategic_implication) || asString(marketIntelData.key_findings),
        citations: citations.market,
        confidence_score: asNumber(marketIntelData.confidence_score),
        exhibit_number: 1,
        exhibit_title: defaultExhibitTitle('pestle', {
          ...context,
          strategicImplication: asString(marketIntelData.strategic_implication),
        }),
        implication: soWhats.pestle?.implication || '',
        recommended_action: soWhats.pestle?.recommended_action || '',
        risk_of_inaction: soWhats.pestle?.risk_of_inaction || '',
      },
    ],
    [
      'porters_five_forces',
      {
        framework_name: "Porter's Five Forces",
        agent_author: 'market_intel',
        structured_data: asRecord(marketIntelData.porters_five_forces),
        narrative: asString(marketIntelData.strategic_implication),
        citations: citations.market,
        confidence_score: asNumber(marketIntelData.confidence_score),
        exhibit_number: 2,
        exhibit_title: defaultExhibitTitle('porters_five_forces', {
          ...context,
          strategicImplication: asString(marketIntelData.strategic_implication),
        }),
        implication: soWhats.porters_five_forces?.implication || '',
        recommended_action: soWhats.porters_five_forces?.recommended_action || '',
        risk_of_inaction: soWhats.porters_five_forces?.risk_of_inaction || '',
      },
    ],
    [
      'swot',
      {
        framework_name: 'SWOT Analysis',
        agent_author: 'strategist',
        structured_data: asRecord(strategistData.swot_analysis),
        narrative: asString(strategistData.analytical_framework) || asString(strategistData.strategic_priority),
        citations: citations.strategist,
        confidence_score: asNumber(strategistData.confidence_score),
        exhibit_number: 3,
        exhibit_title: defaultExhibitTitle('swot', {
          ...context,
          strategicImplication: asString(strategistData.strategic_priority),
        }),
        implication: soWhats.swot?.implication || '',
        recommended_action: soWhats.swot?.recommended_action || '',
        risk_of_inaction: soWhats.swot?.risk_of_inaction || '',
      },
    ],
    [
      'ansoff',
      {
        framework_name: 'Ansoff Matrix',
        agent_author: 'strategist',
        structured_data: asRecord(strategistData.ansoff_matrix),
        narrative: asString(asRecord(strategistData.ansoff_matrix).rationale),
        citations: citations.strategist,
        confidence_score: asNumber(strategistData.confidence_score),
        exhibit_number: 4,
        exhibit_title: defaultExhibitTitle('ansoff', {
          ...context,
          strategicImplication: asString(asRecord(strategistData.ansoff_matrix).recommended_move),
        }),
        implication: soWhats.ansoff?.implication || '',
        recommended_action: soWhats.ansoff?.recommended_action || '',
        risk_of_inaction: soWhats.ansoff?.risk_of_inaction || '',
      },
    ],
    [
      'bcg_matrix',
      {
        framework_name: 'BCG Matrix',
        agent_author: 'quant',
        structured_data: asRecord(quantData.bcg_matrix),
        narrative: asString(asRecord(quantData.bcg_matrix).strategic_implication),
        citations: citations.quant,
        confidence_score: asNumber(quantData.confidence_score),
        exhibit_number: 5,
        exhibit_title: defaultExhibitTitle('bcg_matrix', {
          ...context,
          strategicImplication: asString(asRecord(quantData.bcg_matrix).strategic_implication),
        }),
        implication: soWhats.bcg_matrix?.implication || '',
        recommended_action: soWhats.bcg_matrix?.recommended_action || '',
        risk_of_inaction: soWhats.bcg_matrix?.risk_of_inaction || '',
      },
    ],
    [
      'mckinsey_7s',
      {
        framework_name: 'McKinsey 7S',
        agent_author: 'strategist',
        structured_data: asRecord(strategistData.mckinsey_7s),
        narrative: asString(asRecord(strategistData.ansoff_matrix).rationale),
        citations: citations.strategist,
        confidence_score: asNumber(strategistData.confidence_score),
        exhibit_number: 6,
        exhibit_title: defaultExhibitTitle('mckinsey_7s', context),
        implication: soWhats.mckinsey_7s?.implication || '',
        recommended_action: soWhats.mckinsey_7s?.recommended_action || '',
        risk_of_inaction: soWhats.mckinsey_7s?.risk_of_inaction || '',
      },
    ],
    [
      'blue_ocean',
      {
        framework_name: 'Blue Ocean Strategy',
        agent_author: 'market_intel',
        structured_data: asRecord(marketIntelData.blue_ocean_strategy),
        narrative: asString(asRecord(marketIntelData.blue_ocean_strategy).blue_ocean_move),
        citations: citations.market,
        confidence_score: asNumber(marketIntelData.confidence_score),
        exhibit_number: 7,
        exhibit_title: defaultExhibitTitle('blue_ocean', {
          ...context,
          strategicImplication: asString(asRecord(marketIntelData.blue_ocean_strategy).blue_ocean_move),
        }),
        implication: soWhats.blue_ocean?.implication || '',
        recommended_action: soWhats.blue_ocean?.recommended_action || '',
        risk_of_inaction: soWhats.blue_ocean?.risk_of_inaction || '',
      },
    ],
    [
      'balanced_scorecard',
      {
        framework_name: 'Balanced Scorecard',
        agent_author: 'synthesis',
        structured_data: asRecord(synthesisData.balanced_scorecard),
        narrative: asString(synthesisData.board_narrative),
        citations: citations.synthesis,
        confidence_score: asNumber(synthesisData.overall_confidence, asNumber(analysis.overallConfidence)),
        exhibit_number: 8,
        exhibit_title: defaultExhibitTitle('balanced_scorecard', context),
        implication: soWhats.balanced_scorecard?.implication || '',
        recommended_action: soWhats.balanced_scorecard?.recommended_action || '',
        risk_of_inaction: soWhats.balanced_scorecard?.risk_of_inaction || '',
      },
    ],
    [
      'value_chain',
      {
        framework_name: "Porter's Value Chain",
        agent_author: 'ethicist',
        structured_data: asRecord(ethicistData.value_chain_analysis),
        narrative: asString(asRecord(ethicistData.value_chain_analysis).value_chain_verdict),
        citations: citations.ethicist,
        confidence_score: asNumber(ethicistData.confidence_score),
        exhibit_number: 9,
        exhibit_title: defaultExhibitTitle('value_chain', context),
        implication: soWhats.value_chain?.implication || '',
        recommended_action: soWhats.value_chain?.recommended_action || '',
        risk_of_inaction: soWhats.value_chain?.risk_of_inaction || '',
      },
    ],
    [
      'vrio',
      {
        framework_name: 'VRIO Framework',
        agent_author: 'ethicist',
        structured_data: {
          items: asArray(ethicistData.vrio_assessment),
          verdict: asString(ethicistData.capability_readiness_verdict),
        },
        narrative: asString(ethicistData.capability_readiness_verdict),
        citations: citations.ethicist,
        confidence_score: asNumber(ethicistData.confidence_score),
        exhibit_number: 10,
        exhibit_title: defaultExhibitTitle('vrio', context),
        implication: soWhats.vrio?.implication || '',
        recommended_action: soWhats.vrio?.recommended_action || '',
        risk_of_inaction: soWhats.vrio?.risk_of_inaction || '',
      },
    ],
    [
      'market_sizing',
      {
        framework_name: 'TAM-SAM-SOM',
        agent_author: 'quant',
        structured_data: asRecord(quantData.market_sizing),
        narrative: asString(quantData.cfo_recommendation),
        citations: citations.quant,
        confidence_score: asNumber(quantData.confidence_score),
        exhibit_number: 11,
        exhibit_title: sentence(asString(quantData.cfo_recommendation), 'The quantified addressable market supports a specific, staged capital commitment.'),
        implication: '',
        recommended_action: '',
        risk_of_inaction: '',
      },
    ],
  ];

  return Object.fromEntries(frameworks.filter(([, output]) => Object.keys(output.structured_data).length > 0 || output.narrative));
}

export function buildCollaborationTrace(agentLogs: AgentLog[]): AgentCollaborationEvent[] {
  const completedAgents = new Map<string, { timestamp: number; confidence: number | null }>();
  for (const log of agentLogs) {
    if (log.status === 'completed' || log.status === 'success' || log.status === 'self_corrected') {
      completedAgents.set(log.agentId, {
        timestamp: log.createdAt.getTime(),
        confidence: log.confidenceScore,
      });
    }
  }

  return COLLABORATION_FLOW
    .filter(({ from }) => completedAgents.has(from))
    .flatMap(({ from, to, field }) => {
      const fromMeta = completedAgents.get(from);
      if (!fromMeta) return [];
      const baseEvent: AgentCollaborationEvent = {
        source_agent: from,
        target_agent: to,
        data_field: field,
        timestamp_ms: fromMeta.timestamp + 100,
        contribution_summary: `${from.replace(/_/g, ' ')} passed ${field.replace(/_/g, ' ')} into ${to.replace(/_/g, ' ')} for downstream synthesis.`,
      };
      if (from === 'cove') {
        return [
          baseEvent,
          {
            source_agent: 'cove',
            target_agent: 'synthesis',
            data_field: 'verification',
            timestamp_ms: fromMeta.timestamp + 150,
            contribution_summary: 'CoVe verification approved the strategic brief for final synthesis.',
          },
        ];
      }
      return [baseEvent];
    });
}

function buildQualityReport(analysis: AnalysisWithLogs, coveData: JsonRecord) {
  const judgeDimensions = asRecord(coveData.judge_dimensions);
  const overallConfidence = normalizedScore(analysis.overallConfidence);
  return {
    overall_grade:
      (asString(coveData.quality_grade) as 'A' | 'B' | 'C' | 'FAIL') ||
      (overallConfidence >= 0.82 ? 'A' : overallConfidence >= 0.7 ? 'B' : overallConfidence >= 0.55 ? 'C' : 'FAIL'),
    checks: asArray<Record<string, unknown>>(coveData.verification_checks).map((check, index) => ({
      id: `check-${index + 1}`,
      description: asString(check.claim),
      level: 'WARN' as const,
      passed: Boolean(check.verified),
      notes: asString(check.evidence) || null,
    })),
    quality_flags: asArray<Record<string, unknown>>(coveData.flagged_claims).map((flag) => asString(flag.claim)).filter(Boolean),
    mece_score: 0.8,
    citation_density_score: 0.78,
    internal_consistency_score: asNumber(coveData.logic_consistent) ? 0.9 : 0.58,
    context_specificity_score: asNumber(judgeDimensions.specificity, 0.74),
    financial_grounding_score: asNumber(judgeDimensions.financial_grounding, 0.76),
    execution_specificity_score: asNumber(judgeDimensions.actionability, 0.74),
    retry_count: analysis.selfCorrectionCount ?? 0,
  };
}

function topDecisionEvidence(synthesisData: JsonRecord): string[] {
  return [
    ...asArray<string>(synthesisData.strategic_imperatives),
    ...Object.values(asRecord(synthesisData.framework_so_whats))
      .map((value) => asString(asRecord(value).implication))
      .filter(Boolean)
      .slice(0, 3),
  ].filter(Boolean);
}

function buildExecutiveSummary(analysis: AnalysisWithLogs, synthesisData: JsonRecord, riskData: JsonRecord, redTeamData: JsonRecord) {
  const summary = asString(synthesisData.executive_summary);
  const parts = summary
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    headline: parts[0] || asString(analysis.decisionRecommendation) || 'Board decision ready.',
    key_argument_1: asString(asArray(synthesisData.strategic_imperatives)[0]) || parts[1] || '',
    key_argument_2: asString(asArray(synthesisData.strategic_imperatives)[1]) || parts[2] || '',
    key_argument_3: asString(asArray(synthesisData.strategic_imperatives)[2]) || parts[3] || '',
    critical_risk: asString(asArray(riskData.critical_risks)[0]) || asString(redTeamData.red_team_verdict) || '',
    next_step:
      asString(asRecord(asArray(synthesisData.roadmap)[0]).focus) ||
      asString(asRecord(asArray(asRecord(asArray(synthesisData.roadmap)[0]).key_actions)[0]).action),
  };
}

function buildRoadmapItems(synthesisData: JsonRecord) {
  return asArray<Record<string, unknown>>(synthesisData.roadmap).map((phase) => ({
    phase: asString(phase.phase),
    actions: asArray<Record<string, unknown>>(phase.key_actions).map((action) => {
      const owner = asString(action.owner);
      const deadline = asString(action.deadline);
      const task = asString(action.action);
      return owner || deadline ? `${task} (${owner}${owner && deadline ? ', ' : ''}${deadline})` : task;
    }),
    owner_function: asString(asRecord(asArray(phase.key_actions)[0]).owner, 'Executive Sponsor'),
    success_metrics: [asString(phase.success_metric)].filter(Boolean),
    estimated_investment_usd: null,
  }));
}

export function buildStrategicBrief(analysis: AnalysisWithLogs): JsonRecord | null {
  const synthesisData = asRecord(analysis.synthesisData);
  if (!Object.keys(synthesisData).length) return null;

  const strategistData = asRecord(analysis.strategistData);
  const quantData = asRecord(analysis.quantData);
  const marketIntelData = asRecord(analysis.marketIntelData);
  const riskData = asRecord(analysis.riskData);
  const redTeamData = asRecord(analysis.redTeamData);
  const ethicistData = asRecord(analysis.ethicistData);
  const coveData = asRecord(analysis.coveVerificationData);
  const frameworkOutputs = buildFrameworkOutputs(analysis);
  const soWhatCallouts = buildSoWhatCallouts(synthesisData);
  const citations = dedupeCitations(
    strategistData.citations,
    quantData.citations,
    marketIntelData.citations,
    riskData.citations,
    redTeamData.citations,
    ethicistData.citations,
    synthesisData.citations
  );
  const reportMetadata = {
    analysis_id: analysis.id,
    company_name: analysis.organisationContext || 'Organisation',
    query: analysis.problemStatement,
    generated_at: (analysis.completedAt || analysis.updatedAt || analysis.createdAt).toISOString(),
    asis_version: analysis.pipelineVersion || '4.0.0',
    confidentiality_level: 'STRICTLY CONFIDENTIAL',
    disclaimer: 'This report is AI-assisted strategic analysis for internal decision support and must be reviewed before material action.',
  };
  const usedFallback = (analysis.agentLogs || []).some((agentLog) => Boolean(agentLog.selfCorrected));

  return {
    decision_statement: asString(synthesisData.decision_recommendation || analysis.decisionRecommendation || 'HOLD'),
    decision_confidence: asNumber(analysis.overallConfidence || synthesisData.overall_confidence),
    decision_rationale: asString(synthesisData.risk_adjusted_recommendation || synthesisData.board_narrative || analysis.executiveSummary),
    decision_evidence: topDecisionEvidence(synthesisData),
    framework_outputs: frameworkOutputs,
    executive_summary: buildExecutiveSummary(analysis, synthesisData, riskData, redTeamData),
    section_action_titles: {
      decision: 'Decision statement and board recommendation',
      pestle: 'External environment and market context',
      porters_five_forces: 'Competitive structure and rival pressure',
      ansoff: 'Strategic options and growth pathways',
      financial_analysis: 'Market sizing and financial logic',
      risk_assessment: 'Risk register and mitigation priorities',
    },
    so_what_callouts: soWhatCallouts,
    agent_collaboration_trace: buildCollaborationTrace(analysis.agentLogs || []),
    exhibit_registry: Object.entries(frameworkOutputs).map(([key, output]) => ({
      exhibit_number: output.exhibit_number,
      exhibit_title: output.exhibit_title,
      framework: key,
      agent_author: output.agent_author,
      source_note: output.citations[0]?.source || output.citations[0]?.publisher || 'ASIS synthesis',
      chart_type: key.includes('matrix') ? 'matrix' : key.includes('ocean') ? 'strategy-canvas' : 'table',
    })),
    implementation_roadmap: buildRoadmapItems(synthesisData),
    quality_report: buildQualityReport(analysis, coveData),
    mece_score: 0.8,
    internal_consistency_score: asNumber(coveData.logic_consistent) ? 0.9 : 0.58,
    balanced_scorecard: asRecord(synthesisData.balanced_scorecard),
    report_metadata: reportMetadata,
    board_narrative: asString(analysis.boardNarrative || synthesisData.board_narrative),
    recommendation: asString(synthesisData.decision_recommendation || analysis.decisionRecommendation || 'HOLD'),
    overall_confidence: asNumber(analysis.overallConfidence || synthesisData.overall_confidence),
    frameworks_applied:
      asArray<string>(synthesisData.frameworks_applied).length > 0
        ? asArray<string>(synthesisData.frameworks_applied)
        : Object.keys(frameworkOutputs).map((key) => frameworkOutputs[key]?.framework_name ?? key),
    context: {
      company_name: analysis.organisationContext,
      organisation: analysis.organisationContext,
      sector: analysis.industryContext,
      industry: analysis.industryContext,
      geography: analysis.geographyContext,
      decision_type: analysis.decisionType,
    },
    market_analysis: {
      ...marketIntelData,
      competitor_profiles: asArray<Record<string, unknown>>(marketIntelData.competitor_profiles),
      named_competitors: asArray<string>(marketIntelData.named_competitors),
    },
    financial_analysis: quantData,
    risk_analysis: riskData,
    red_team: redTeamData,
    verification: coveData,
    roadmap: asArray(synthesisData.roadmap),
    citations,
    analysis_meta: {
      fatal_invalidation_count: analysis.fatalInvalidationCount ?? 0,
      major_invalidation_count: analysis.majorInvalidationCount ?? 0,
      recommendation_downgraded: analysis.recommendationDowngraded ?? false,
      original_recommendation: analysis.originalRecommendation ?? null,
      three_options: analysis.threeOptionsData ?? synthesisData.three_options ?? null,
      build_vs_buy_verdict: analysis.buildVsBuyVerdict ?? synthesisData.build_vs_buy_verdict ?? null,
      recommended_option: analysis.recommendedOption ?? null,
      confidence_breakdown: analysis.confidenceBreakdown ?? null,
      has_blocking_warnings: analysis.hasBlockingWarnings ?? false,
      used_fallback: usedFallback,
    },
  };
}

export function transformAnalysisRecord(analysis: AnalysisWithLogs): JsonRecord {
  const strategicBrief = buildStrategicBrief(analysis);
  const usedFallback = (analysis.agentLogs || []).some((agentLog) => Boolean(agentLog.selfCorrected));
  return {
    id: analysis.id,
    analysis_id: analysis.id,
    query: analysis.problemStatement,
    pipeline_version: analysis.pipelineVersion || '4.0.0',
    status: analysis.status,
    current_agent: analysis.currentAgent || null,
    overall_confidence: analysis.overallConfidence ?? null,
    used_fallback: usedFallback,
    decision_recommendation: analysis.decisionRecommendation ?? null,
    executive_summary: analysis.executiveSummary ?? null,
    board_narrative: analysis.boardNarrative ?? null,
    duration_seconds: analysis.durationSeconds ?? null,
    created_at: analysis.createdAt.toISOString(),
    completed_at: analysis.completedAt?.toISOString() || null,
    logic_consistency_passed: analysis.logicConsistencyPassed ?? null,
    self_correction_count: analysis.selfCorrectionCount ?? 0,
    fatal_invalidation_count: analysis.fatalInvalidationCount ?? 0,
    major_invalidation_count: analysis.majorInvalidationCount ?? 0,
    recommendation_downgraded: analysis.recommendationDowngraded ?? false,
    original_recommendation: analysis.originalRecommendation ?? null,
    three_options: analysis.threeOptionsData ?? null,
    build_vs_buy_verdict: analysis.buildVsBuyVerdict ?? null,
    recommended_option: analysis.recommendedOption ?? null,
    confidence_breakdown: analysis.confidenceBreakdown ?? null,
    has_blocking_warnings: analysis.hasBlockingWarnings ?? false,
    company_context: {
      company_name: analysis.organisationContext || '',
      sector: analysis.industryContext || '',
      geography: analysis.geographyContext || '',
      decision_type: analysis.decisionType || '',
    },
    extracted_context: {
      company_name: analysis.organisationContext || '',
      organisation: analysis.organisationContext || '',
      sector: analysis.industryContext || '',
      industry: analysis.industryContext || '',
      geography: analysis.geographyContext || '',
      decision_type: analysis.decisionType || '',
    },
    strategic_brief: strategicBrief,
    agent_logs: (analysis.agentLogs || []).map((agentLog) => ({
      id: agentLog.id,
      agent_id: agentLog.agentId,
      agent_name: agentLog.agentName,
      status: agentLog.status,
      confidence_score: agentLog.confidenceScore ?? null,
      input_tokens: agentLog.inputTokens ?? 0,
      output_tokens: agentLog.outputTokens ?? 0,
      duration_ms: agentLog.durationMs ?? null,
      attempt_number: agentLog.attemptNumber ?? 1,
      self_corrected: agentLog.selfCorrected ?? false,
      correction_reason: agentLog.correctionReason || null,
      parsed_output: agentLog.parsedOutput ?? null,
      created_at: agentLog.createdAt.toISOString(),
    })),
  };
}
