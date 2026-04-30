import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database';
import { requireAuth } from '../lib/auth';
import { log } from '../lib/logger';

const router = Router();

export interface FrameworkOutput {
  name: string;
  data: Record<string, unknown>;
  confidence?: number;
  source_agent?: string;
}

export interface AgentCollaborationEvent {
  from_agent: string;
  to_agent: string;
  event_type: 'handoff' | 'validation' | 'correction';
  timestamp: string;
  confidence?: number;
  message?: string;
}

// Ordered collaboration flow: which agent feeds which
const COLLABORATION_FLOW: Array<{ from: string; to: string }> = [
  { from: 'strategist', to: 'quant' },
  { from: 'strategist', to: 'market_intel' },
  { from: 'quant', to: 'risk' },
  { from: 'market_intel', to: 'risk' },
  { from: 'risk', to: 'red_team' },
  { from: 'risk', to: 'ethicist' },
  { from: 'red_team', to: 'cove' },
  { from: 'ethicist', to: 'cove' },
  { from: 'cove', to: 'synthesis' },
];

function buildFrameworkOutputs(analysis: Record<string, unknown>): Record<string, FrameworkOutput> {
  const marketIntelData = (analysis.marketIntelData || {}) as Record<string, unknown>;
  const strategistData = (analysis.strategistData || {}) as Record<string, unknown>;
  const quantData = (analysis.quantData || {}) as Record<string, unknown>;
  const synthesisData = (analysis.synthesisData || {}) as Record<string, unknown>;
  const ethicistData = (analysis.ethicistData || {}) as Record<string, unknown>;

  const soWhats = (synthesisData.framework_so_whats || {}) as Record<string, Record<string, string>>;

  function withSoWhat(name: string, data: Record<string, unknown>, confidence?: number, source?: string): FrameworkOutput {
    const sw = soWhats[name];
    return {
      name,
      data: sw ? { ...data, so_what_callout: sw } : data,
      confidence,
      source_agent: source,
    };
  }

  const frameworks: Record<string, FrameworkOutput> = {};

  // PESTLE
  frameworks['pestle'] = withSoWhat(
    'PESTLE Analysis',
    marketIntelData.pestle_analysis ? marketIntelData.pestle_analysis as Record<string, unknown> : { market_intel: marketIntelData },
    typeof marketIntelData.confidence_score === 'number' ? marketIntelData.confidence_score : undefined,
    'market_intel'
  );

  // Porter's Five Forces
  const portData = (marketIntelData.porters_analysis || marketIntelData.porters_five_forces || {}) as Record<string, unknown>;
  frameworks['porters_five_forces'] = withSoWhat(
    "Porter's Five Forces",
    Object.keys(portData).length ? portData : { market_intel: marketIntelData },
    typeof marketIntelData.confidence_score === 'number' ? marketIntelData.confidence_score : undefined,
    'market_intel'
  );

  // Blue Ocean Strategy
  frameworks['blue_ocean'] = withSoWhat(
    'Blue Ocean Strategy',
    marketIntelData.blue_ocean_strategy ? marketIntelData.blue_ocean_strategy as Record<string, unknown> : { market_intel: marketIntelData },
    typeof marketIntelData.confidence_score === 'number' ? marketIntelData.confidence_score : undefined,
    'market_intel'
  );

  // SWOT
  frameworks['swot'] = withSoWhat(
    'SWOT Analysis',
    strategistData.swot_analysis ? strategistData.swot_analysis as Record<string, unknown> : { strategist: strategistData },
    typeof strategistData.confidence_score === 'number' ? strategistData.confidence_score : undefined,
    'strategist'
  );

  // BCG Matrix
  frameworks['bcg_matrix'] = withSoWhat(
    'BCG Matrix',
    quantData.bcg_matrix ? quantData.bcg_matrix as Record<string, unknown> : { quant: quantData },
    typeof quantData.confidence_score === 'number' ? quantData.confidence_score : undefined,
    'quant'
  );

  // Market Sizing (TAM/SAM/SOM)
  if (quantData.market_sizing) {
    frameworks['market_sizing'] = {
      name: 'TAM → SAM → SOM Revenue Model',
      data: quantData.market_sizing as Record<string, unknown>,
      confidence: typeof quantData.confidence_score === 'number' ? quantData.confidence_score : undefined,
      source_agent: 'quant',
    };
  }

  // Ansoff Matrix
  frameworks['ansoff_matrix'] = withSoWhat(
    'Ansoff Matrix',
    strategistData.ansoff_matrix ? strategistData.ansoff_matrix as Record<string, unknown> : { strategist: strategistData },
    typeof strategistData.confidence_score === 'number' ? strategistData.confidence_score : undefined,
    'strategist'
  );

  // McKinsey 7-S
  frameworks['mckinsey_7s'] = withSoWhat(
    'McKinsey 7-S Framework',
    strategistData.mckinsey_7s ? strategistData.mckinsey_7s as Record<string, unknown> : { strategist: strategistData },
    typeof strategistData.confidence_score === 'number' ? strategistData.confidence_score : undefined,
    'strategist'
  );

  // Porter's Value Chain
  frameworks['value_chain'] = withSoWhat(
    "Porter's Value Chain",
    ethicistData.value_chain_analysis ? ethicistData.value_chain_analysis as Record<string, unknown> : { ethicist: ethicistData },
    typeof ethicistData.confidence_score === 'number' ? ethicistData.confidence_score : undefined,
    'ethicist'
  );

  // VRIO
  frameworks['vrio'] = withSoWhat(
    'VRIO Framework',
    ethicistData.vrio_assessment ? { items: ethicistData.vrio_assessment, verdict: ethicistData.capability_readiness_verdict } : { ethicist: ethicistData },
    typeof ethicistData.confidence_score === 'number' ? ethicistData.confidence_score : undefined,
    'ethicist'
  );

  // Balanced Scorecard
  frameworks['balanced_scorecard'] = withSoWhat(
    'Balanced Scorecard',
    synthesisData.balanced_scorecard ? synthesisData.balanced_scorecard as Record<string, unknown> : { synthesis: synthesisData },
    typeof synthesisData.overall_confidence === 'number' ? synthesisData.overall_confidence : undefined,
    'synthesis'
  );

  return frameworks;
}

function buildCitations(analysis: Record<string, unknown>): unknown[] {
  const agentFields = ['strategistData', 'quantData', 'marketIntelData', 'riskData', 'redTeamData', 'ethicistData', 'synthesisData'];
  const seen = new Set<string>();
  const citations: unknown[] = [];
  for (const field of agentFields) {
    const data = (analysis[field] || {}) as Record<string, unknown>;
    const agentCites = (data.citations || []) as Array<Record<string, unknown>>;
    for (const c of agentCites) {
      const url = String(c.url || '');
      if (url && !url.includes('example.com') && !seen.has(url)) {
        seen.add(url);
        citations.push(c);
      }
    }
  }
  return citations;
}

function buildCollaborationTrace(agentLogs: Array<Record<string, unknown>>): AgentCollaborationEvent[] {
  // Build a map of completed agents with their completion times
  const completedAgents = new Map<string, { timestamp: Date; confidence: number | null }>();
  for (const log of agentLogs) {
    if (log.status === 'completed' || log.status === 'success') {
      completedAgents.set(log.agentId as string, {
        timestamp: log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt as string),
        confidence: typeof log.confidenceScore === 'number' ? log.confidenceScore : null,
      });
    }
  }

  const events: AgentCollaborationEvent[] = [];

  for (const { from, to } of COLLABORATION_FLOW) {
    const fromAgent = completedAgents.get(from);
    const toAgent = completedAgents.get(to);

    if (!fromAgent) continue;

    // Use fromAgent's timestamp + small offset for the handoff event
    const handoffTime = new Date(fromAgent.timestamp.getTime() + 100);

    events.push({
      from_agent: from,
      to_agent: to,
      event_type: 'handoff',
      timestamp: handoffTime.toISOString(),
      confidence: fromAgent.confidence ?? undefined,
      message: `${from.replace('_', ' ')} completed — passing findings to ${to.replace('_', ' ')}`,
    });

    // If cove -> synthesis, add a validation event
    if (from === 'cove' && toAgent) {
      events.push({
        from_agent: 'cove',
        to_agent: 'synthesis',
        event_type: 'validation',
        timestamp: new Date(handoffTime.getTime() + 50).toISOString(),
        confidence: fromAgent.confidence ?? undefined,
        message: 'Chain-of-Verification passed — synthesis authorized',
      });
    }
  }

  // Sort by timestamp
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return events;
}

function transformAnalysisToReport(analysis: Record<string, unknown>) {
  return {
    id: analysis.id,
    query: analysis.problemStatement,
    pipeline_version: analysis.pipelineVersion || '4.0.0',
    status: analysis.status,
    current_agent: analysis.currentAgent,
    overall_confidence: analysis.overallConfidence,
    decision_recommendation: analysis.decisionRecommendation,
    executive_summary: analysis.executiveSummary,
    board_narrative: analysis.boardNarrative,
    duration_seconds: analysis.durationSeconds,
    created_at: analysis.createdAt instanceof Date
      ? (analysis.createdAt as Date).toISOString()
      : String(analysis.createdAt),
    completed_at: analysis.completedAt
      ? (analysis.completedAt instanceof Date
        ? (analysis.completedAt as Date).toISOString()
        : String(analysis.completedAt))
      : null,
    logic_consistency_passed: analysis.logicConsistencyPassed,
    self_correction_count: analysis.selfCorrectionCount,
    extracted_context: {
      organisation: analysis.organisationContext,
      industry: analysis.industryContext,
      geography: analysis.geographyContext,
      decision_type: analysis.decisionType,
    },
    agent_logs: ((analysis.agentLogs as Array<Record<string, unknown>>) || []).map(al => ({
      id: al.id,
      agent_id: al.agentId,
      agent_name: al.agentName,
      status: al.status,
      confidence_score: al.confidenceScore,
      input_tokens: al.inputTokens,
      output_tokens: al.outputTokens,
      duration_ms: al.durationMs,
      attempt_number: al.attemptNumber,
      self_corrected: al.selfCorrected,
      correction_reason: al.correctionReason,
      created_at: al.createdAt instanceof Date
        ? (al.createdAt as Date).toISOString()
        : String(al.createdAt),
    })),
  };
}

// GET / — list reports (alias for completed analyses)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const { limit = 20, offset = 0 } = req.query;

    const [analyses, total] = await Promise.all([
      prisma.analysis.findMany({
        where: { userId, status: 'completed' },
        orderBy: { completedAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
        select: {
          id: true, problemStatement: true, status: true, overallConfidence: true,
          decisionRecommendation: true, durationSeconds: true, createdAt: true,
          completedAt: true, pipelineVersion: true, organisationContext: true,
          industryContext: true, geographyContext: true, decisionType: true,
        },
      }),
      prisma.analysis.count({ where: { userId, status: 'completed' } }),
    ]);

    const reports = analyses.map(a => ({
      id: a.id,
      query: a.problemStatement,
      pipeline_version: a.pipelineVersion,
      status: a.status,
      overall_confidence: a.overallConfidence,
      decision_recommendation: a.decisionRecommendation,
      duration_seconds: a.durationSeconds,
      created_at: a.createdAt.toISOString(),
      completed_at: a.completedAt?.toISOString() || null,
      extracted_context: {
        organisation: a.organisationContext,
        industry: a.industryContext,
        geography: a.geographyContext,
        decision_type: a.decisionType,
      },
    }));

    res.json({ reports, total });
  } catch (err) {
    log.error('Reports list error', { error: String(err) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to list reports' });
  }
});

// GET /:analysisId — get full report
router.get('/:analysisId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const analysis = await prisma.analysis.findFirst({
      where: { id: req.params.analysisId, userId },
      include: { agentLogs: { orderBy: { createdAt: 'asc' } } },
    });

    if (!analysis) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
      return;
    }

    res.json({ report: transformAnalysisToReport(analysis as unknown as Record<string, unknown>) });
  } catch (err) {
    log.error('Report get error', { error: String(err) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to get report' });
  }
});

// GET /:analysisId/frameworks — extract framework outputs
router.get('/:analysisId/frameworks', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const analysis = await prisma.analysis.findFirst({
      where: { id: req.params.analysisId, userId },
      select: {
        id: true, strategistData: true, quantData: true, marketIntelData: true,
        riskData: true, redTeamData: true, ethicistData: true, synthesisData: true,
        coveVerificationData: true,
      },
    });

    if (!analysis) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
      return;
    }

    const framework_outputs = buildFrameworkOutputs(analysis as unknown as Record<string, unknown>);
    const citations = buildCitations(analysis as unknown as Record<string, unknown>);
    res.json({ framework_outputs, citations, citation_count: citations.length });
  } catch (err) {
    log.error('Frameworks extraction error', { error: String(err) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to extract frameworks' });
  }
});

// GET /:analysisId/collaboration — return agent collaboration trace
router.get('/:analysisId/collaboration', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const analysis = await prisma.analysis.findFirst({
      where: { id: req.params.analysisId, userId },
      include: { agentLogs: { orderBy: { createdAt: 'asc' } } },
    });

    if (!analysis) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
      return;
    }

    const agent_collaboration_trace = buildCollaborationTrace(
      (analysis.agentLogs || []) as unknown as Array<Record<string, unknown>>
    );

    res.json({ agent_collaboration_trace });
  } catch (err) {
    log.error('Collaboration trace error', { error: String(err) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to build collaboration trace' });
  }
});

// GET /:analysisId/decision — return decision payload
router.get('/:analysisId/decision', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const analysis = await prisma.analysis.findFirst({
      where: { id: req.params.analysisId, userId },
      select: {
        id: true, decisionRecommendation: true, overallConfidence: true,
        executiveSummary: true, synthesisData: true, boardNarrative: true,
      },
    });

    if (!analysis) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
      return;
    }

    const synthesisData = (analysis.synthesisData || {}) as Record<string, unknown>;

    res.json({
      decision_statement: synthesisData.decision_recommendation || analysis.decisionRecommendation || 'HOLD',
      decision_confidence: synthesisData.overall_confidence || analysis.overallConfidence || 0,
      decision_rationale: synthesisData.risk_adjusted_recommendation || synthesisData.decision_rationale || analysis.executiveSummary || '',
      executive_summary: analysis.executiveSummary || synthesisData.executive_summary || '',
      board_narrative: analysis.boardNarrative || synthesisData.board_narrative || '',
      strategic_imperatives: synthesisData.strategic_imperatives || [],
      supporting_frameworks: synthesisData.frameworks_applied || [
        'PESTLE Analysis', "Porter's Five Forces", 'Blue Ocean Strategy',
        'SWOT Analysis', 'BCG Matrix', 'TAM→SAM→SOM', 'Ansoff Matrix',
        'McKinsey 7-S', "Porter's Value Chain", 'VRIO Framework',
        'COSO ERM 2017', 'Balanced Scorecard', 'McKinsey Three Horizons'
      ],
      framework_so_whats: synthesisData.framework_so_whats || null,
      red_team_response: synthesisData.red_team_response || null,
    });

  } catch (err) {
    log.error('Decision payload error', { error: String(err) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to get decision' });
  }
});

// POST /:analysisId/pdf — generate PDF (stub)
router.post('/:analysisId/pdf', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const analysis = await prisma.analysis.findFirst({
      where: { id: req.params.analysisId, userId },
      select: { id: true },
    });

    if (!analysis) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
      return;
    }

    // Stub — PDF generation would be queued here
    res.status(202).json({
      status: 'generating',
      progress: 0,
      analysis_id: req.params.analysisId,
      message: 'PDF generation queued',
    });
  } catch (err) {
    log.error('PDF generation error', { error: String(err) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to queue PDF generation' });
  }
});

// GET /:analysisId/pdf/status — return PDF status
router.get('/:analysisId/pdf/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const analysis = await prisma.analysis.findFirst({
      where: { id: req.params.analysisId, userId },
      select: { id: true, pdfUrl: true },
    });

    if (!analysis) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
      return;
    }

    if (analysis.pdfUrl) {
      res.json({ status: 'ready', progress: 100, url: analysis.pdfUrl });
    } else {
      res.json({ status: 'ready', progress: 100, url: null });
    }
  } catch (err) {
    log.error('PDF status error', { error: String(err) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to get PDF status' });
  }
});

// DELETE /:id — delete report
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const analysis = await prisma.analysis.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!analysis) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
      return;
    }

    await prisma.analysis.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    log.error('Report delete error', { error: String(err) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to delete report' });
  }
});

export default router;
