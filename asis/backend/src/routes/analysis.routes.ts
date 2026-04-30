import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/database';
import { requireAuth } from '../lib/auth';
import { runPipeline } from '../agents/pipeline';
import { log } from '../lib/logger';
import Anthropic from '@anthropic-ai/sdk';
import { robustJsonParse } from '../lib/llmClient';
import { registerSseClient } from '../lib/socketio';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const createAnalysisSchema = z.object({
  problemStatement: z.string().min(10).max(5000).optional(),
  query: z.string().min(10).max(5000).optional(),
  company_context: z.record(z.unknown()).optional(),
}).refine(d => d.problemStatement || d.query, { message: 'problemStatement or query is required' });

async function extractProblemContext(problemStatement: string): Promise<{ organisationContext: string; industryContext: string; geographyContext: string; decisionType: string }> {
  try {
    const result = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: `Extract from this problem: return JSON with org, industry, geography, decision_type fields. Problem: "${problemStatement}"` }]
    });
    const parsed = robustJsonParse<any>(result.content[0].type === 'text' ? result.content[0].text : '');
    return {
      organisationContext: parsed?.organisation || '',
      industryContext: parsed?.industry || '',
      geographyContext: parsed?.geography || '',
      decisionType: parsed?.decision_type || '',
    };
  } catch { return { organisationContext: '', industryContext: '', geographyContext: '', decisionType: '' }; }
}

router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createAnalysisSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors }); return; }
    const problemStatement = parsed.data.problemStatement || parsed.data.query || '';
    const companyCtx = (parsed.data.company_context || {}) as Record<string, string>;
    const context = await extractProblemContext(problemStatement);
    // Override with explicit context from frontend if provided
    const finalContext = {
      organisationContext: companyCtx.company_name || context.organisationContext,
      industryContext: companyCtx.sector || context.industryContext,
      geographyContext: companyCtx.geography || context.geographyContext,
      decisionType: companyCtx.decision_type || context.decisionType,
    };
    const analysis = await prisma.analysis.create({
      data: {
        userId: (req as any).user.id,
        organisationId: (req as any).user.organisationId,
        problemStatement,
        ...finalContext,
        status: 'queued',
        agentsTotal: 8,
      }
    });
    await prisma.user.update({ where: { id: (req as any).user.id }, data: { analysisCount: { increment: 1 } } });
    log.info('Analysis created', { analysisId: analysis.id, userId: (req as any).user.id });
    runPipeline(analysis.id).catch(err => log.error('Pipeline error', { analysisId: analysis.id, error: String(err) }));
    res.status(201).json({ analysis: transformAnalysis(analysis) });
  } catch (err) { next(err); }
});

function transformAnalysis(a: any): Record<string, unknown> {
  return {
    id: a.id,
    query: a.problemStatement,
    pipeline_version: a.pipelineVersion || '4.0.0',
    status: a.status,
    current_agent: a.currentAgent || null,
    overall_confidence: a.overallConfidence || null,
    decision_recommendation: a.decisionRecommendation || null,
    executive_summary: a.executiveSummary || null,
    board_narrative: a.boardNarrative || null,
    duration_seconds: a.durationSeconds || null,
    created_at: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt || ''),
    completed_at: a.completedAt ? (a.completedAt instanceof Date ? a.completedAt.toISOString() : String(a.completedAt)) : null,
    logic_consistency_passed: a.logicConsistencyPassed ?? null,
    self_correction_count: a.selfCorrectionCount ?? 0,
    // ── M&A / Adversarial intelligence fields ─────────────────────────────
    fatal_invalidation_count: a.fatalInvalidationCount ?? 0,
    major_invalidation_count: a.majorInvalidationCount ?? 0,
    recommendation_downgraded: a.recommendationDowngraded ?? false,
    original_recommendation: a.originalRecommendation ?? null,
    three_options: a.threeOptionsData ?? null,
    build_vs_buy_verdict: a.buildVsBuyVerdict ?? null,
    recommended_option: a.recommendedOption ?? null,
    confidence_breakdown: a.confidenceBreakdown ?? null,
    has_blocking_warnings: a.hasBlockingWarnings ?? false,
    // ─────────────────────────────────────────────────────────────────────
    company_context: {},
    extracted_context: {
      organisation: a.organisationContext || '',
      industry: a.industryContext || '',
      geography: a.geographyContext || '',
      decision_type: a.decisionType || '',
    },
    strategic_brief: buildStrategicBrief(a),
    agent_logs: (a.agentLogs || []).map((al: any) => ({
      id: al.id,
      agent_id: al.agentId,
      agent_name: al.agentName,
      status: al.status,
      confidence_score: al.confidenceScore ?? null,
      input_tokens: al.inputTokens ?? 0,
      output_tokens: al.outputTokens ?? 0,
      duration_ms: al.durationMs ?? null,
      attempt_number: al.attemptNumber ?? 1,
      self_corrected: al.selfCorrected ?? false,
      correction_reason: al.correctionReason || null,
      created_at: al.createdAt instanceof Date ? al.createdAt.toISOString() : String(al.createdAt || ''),
    })),
  };
}

function buildStrategicBrief(a: any): Record<string, unknown> | null {
  const synthesis = a.synthesisData as any;
  if (!synthesis?.executive_summary) return null;

  const market = (a.marketIntelData || {}) as any;
  const risk = (a.riskData || {}) as any;
  const redTeam = (a.redTeamData || {}) as any;
  const cove = (a.coveVerificationData || {}) as any;
  const quant = (a.quantData || {}) as any;

  return {
    decision_statement: synthesis.decision_recommendation || 'HOLD',
    decision_confidence: a.overallConfidence || synthesis.overall_confidence || 70,
    decision_rationale: synthesis.risk_adjusted_recommendation || synthesis.executive_summary || '',
    decision_evidence: synthesis.strategic_imperatives || [],
    framework_outputs: {},
    executive_summary: {
      headline: typeof synthesis.executive_summary === 'string' ? synthesis.executive_summary.split('.')[0] + '.' : synthesis.executive_summary || '',
      key_argument_1: synthesis.strategic_imperatives?.[0] || '',
      key_argument_2: synthesis.strategic_imperatives?.[1] || '',
      key_argument_3: synthesis.strategic_imperatives?.[2] || '',
      critical_risk: risk.critical_risks?.[0] || redTeam.red_team_verdict || '',
      next_step: synthesis.roadmap?.[0]?.key_actions?.[0]?.action || '',
    },
    section_action_titles: {},
    so_what_callouts: {},
    agent_collaboration_trace: [],
    exhibit_registry: [],
    implementation_roadmap: (synthesis.roadmap || []).map((p: any) => ({
      phase: p.phase,
      actions: (p.key_actions || []).map((ka: any) => `${ka.action} (${ka.owner}, ${ka.deadline})`),
      owner_function: p.key_actions?.[0]?.owner || 'CEO',
      success_metrics: [p.success_metric || ''],
      estimated_investment_usd: null,
    })),
    quality_report: {
      overall_grade: (a.overallConfidence || 0) >= 80 ? 'A' : (a.overallConfidence || 0) >= 65 ? 'B' : (a.overallConfidence || 0) >= 50 ? 'C' : 'FAIL',
      checks: cove.verification_checks?.map((vc: any) => ({
        id: vc.claim?.slice(0, 20) || 'check',
        description: vc.claim || '',
        level: 'WARN' as const,
        passed: vc.verified,
        notes: vc.evidence || null,
      })) || [],
      quality_flags: cove.flagged_claims?.map((fc: any) => fc.claim) || [],
      mece_score: 80,
      citation_density_score: 75,
      internal_consistency_score: cove.logic_consistent ? 90 : 55,
      context_specificity_score: 75,
      financial_grounding_score: 78,
      execution_specificity_score: 72,
      retry_count: a.selfCorrectionCount || 0,
    },
    mece_score: 80,
    internal_consistency_score: cove.logic_consistent ? 90 : 55,
    balanced_scorecard: synthesis.balanced_scorecard || {},
    report_metadata: {
      analysis_id: a.id,
      company_name: a.organisationContext || 'Organisation',
      query: a.problemStatement,
      generated_at: a.completedAt instanceof Date ? a.completedAt.toISOString() : new Date().toISOString(),
      asis_version: '4.0.0',
      confidentiality_level: 'Confidential',
      disclaimer: 'This analysis is generated by ASIS and is intended for internal strategic use only.',
    },
    board_narrative: synthesis.board_narrative || '',
    recommendation: synthesis.decision_recommendation || 'HOLD',
    overall_confidence: a.overallConfidence || synthesis.overall_confidence || 70,
    frameworks_applied: synthesis.frameworks_applied || ['McKinsey 7-S', 'COSO ERM 2017', "Porter's Five Forces", 'Balanced Scorecard'],
    context: {
      organisation: a.organisationContext,
      industry: a.industryContext,
      geography: a.geographyContext,
    },
    market_analysis: market,
    financial_analysis: quant,
    risk_analysis: risk,
    red_team: redTeam,
    verification: cove,
    roadmap: synthesis.roadmap || [],
    citations: market.data_sources?.map((s: string) => ({ source: s, type: 'report' })) || [],
  };
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { status, search, limit = 20, offset = 0 } = req.query;
  const where: any = { userId: (req as any).user.id };
  if (status) where.status = status as string;
  if (search) where.problemStatement = { contains: search as string, mode: 'insensitive' };
  const [analyses, total] = await Promise.all([
    prisma.analysis.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
      select: {
        id: true, problemStatement: true, status: true, overallConfidence: true,
        decisionRecommendation: true, durationSeconds: true, createdAt: true,
        agentsCompleted: true, agentsTotal: true, organisationContext: true,
        industryContext: true, geographyContext: true, pipelineVersion: true,
        currentAgent: true, executiveSummary: true, boardNarrative: true,
        completedAt: true, logicConsistencyPassed: true, selfCorrectionCount: true,
        decisionType: true,
      }
    }),
    prisma.analysis.count({ where })
  ]);
  res.json({ analyses: analyses.map(transformAnalysis), total });
});

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const analysis = await prisma.analysis.findFirst({
    where: { id: req.params.id, userId: (req as any).user.id },
    include: { agentLogs: { orderBy: { createdAt: 'asc' } } }
  });
  if (!analysis) { res.status(404).json({ message: 'Analysis not found' }); return; }
  res.json({ analysis: transformAnalysis(analysis) });
});

router.get('/:id/events', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id as string;
  const analysis = await prisma.analysis.findFirst({
    where: { id: req.params.id, userId },
    select: { id: true, status: true }
  });
  if (!analysis) { res.status(404).end(); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  if (analysis.status === 'completed' || analysis.status === 'failed') {
    const eventName = analysis.status === 'completed' ? 'analysis_complete' : 'analysis_failed';
    res.write(`event: ${eventName}\ndata: ${JSON.stringify({ status: analysis.status })}\n\n`);
    res.end();
    return;
  }

  const unregister = registerSseClient(req.params.id, res);
  req.on('close', unregister);
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const analysis = await prisma.analysis.findFirst({ where: { id: req.params.id, userId: (req as any).user.id } });
  if (!analysis) { res.status(404).json({ message: 'Not found' }); return; }
  await prisma.analysis.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
