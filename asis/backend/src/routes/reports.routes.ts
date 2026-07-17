import { Router, type Request, type Response } from 'express';

import { requireAuth } from '../lib/auth';
import { prisma } from '../lib/database';
import { log } from '../lib/logger';
import {
  buildCollaborationTrace,
  buildFrameworkOutputs,
  buildStrategicBrief,
  transformAnalysisRecord,
} from '../lib/reportAdapter';

const router = Router();

function reportTheme(value: unknown): string {
  const normalized = String(value || 'mckinsey').toLowerCase();
  return ['mckinsey', 'bain', 'bcg', 'neutral'].includes(normalized) ? normalized : 'mckinsey';
}

function frontendPdfBaseUrl(): string {
  return (
    process.env.FRONTEND_INTERNAL_URL ||
    process.env.FRONTEND_URL ||
    'http://localhost:3001'
  ).replace(/\/$/, '');
}

function singleParam(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first : '';
  }
  return typeof value === 'string' ? value : '';
}

function buildPdfAppendix(agentLogs: Array<Record<string, unknown>>) {
  return {
    agent_execution_log: agentLogs.map((log) => ({
      agent: log.agent_name,
      model_used: log.model_used || null,
      tokens_in: log.input_tokens || null,
      tokens_out: log.output_tokens || null,
      latency_ms: log.duration_ms || null,
      tools_called: Array.isArray(log.tools_called) ? log.tools_called : [],
    })),
    trace_id:
      agentLogs.find((log) => typeof log.langfuse_trace_id === 'string' && log.langfuse_trace_id)?.langfuse_trace_id || null,
    trace_url: null,
  };
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const { limit = 20, offset = 0 } = req.query;

    const [analyses, total] = await Promise.all([
      prisma.analysis.findMany({
        where: { userId, status: 'completed' },
        orderBy: { completedAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
        include: { agentLogs: { orderBy: { createdAt: 'asc' } } },
      }),
      prisma.analysis.count({ where: { userId, status: 'completed' } }),
    ]);

    const reports = analyses.map((analysis: any) => {
      const transformed = transformAnalysisRecord(analysis);
      return {
        ...transformed,
        report_id: analysis.id,
        report_version: analysis.reportVersion ?? 1,
        pdf_url: analysis.pdfUrl ?? null,
        pdf_status: 'ready',
        pdf_progress: 100,
        created_at: analysis.createdAt.toISOString(),
        updated_at: analysis.updatedAt.toISOString(),
        user_id: analysis.userId,
      };
    });

    res.json({ reports, total });
  } catch (error) {
    log.error('Reports list error', { error: String(error) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to list reports' });
  }
});

router.get('/:analysisId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const analysisId = singleParam(req.params.analysisId);
    const analysis = await prisma.analysis.findFirst({
      where: { id: analysisId, userId },
      include: { agentLogs: { orderBy: { createdAt: 'asc' } } },
    });

    if (!analysis) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
      return;
    }

    const transformed = transformAnalysisRecord(analysis);
    res.json({
      report: {
        ...transformed,
        report_id: analysis.id,
        report_version: analysis.reportVersion ?? 1,
        pdf_url: analysis.pdfUrl ?? null,
        pdf_status: 'ready',
        pdf_progress: 100,
        created_at: analysis.createdAt.toISOString(),
        updated_at: analysis.updatedAt.toISOString(),
        user_id: analysis.userId,
      },
    });
  } catch (error) {
    log.error('Report get error', { error: String(error) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to get report' });
  }
});

router.get('/:analysisId/frameworks', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const analysisId = singleParam(req.params.analysisId);
    const analysis = await prisma.analysis.findFirst({
      where: { id: analysisId, userId },
      include: { agentLogs: { orderBy: { createdAt: 'asc' } } },
    });

    if (!analysis) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
      return;
    }

    const brief = buildStrategicBrief(analysis);
    res.json({
      framework_outputs: buildFrameworkOutputs(analysis),
      citations: brief?.citations || [],
      citation_count: Array.isArray(brief?.citations) ? brief.citations.length : 0,
      so_what_callouts: brief?.so_what_callouts || {},
    });
  } catch (error) {
    log.error('Framework extraction error', { error: String(error) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to extract frameworks' });
  }
});

router.get('/:analysisId/collaboration', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const analysisId = singleParam(req.params.analysisId);
    const analysis = await prisma.analysis.findFirst({
      where: { id: analysisId, userId },
      include: { agentLogs: { orderBy: { createdAt: 'asc' } } },
    });

    if (!analysis) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
      return;
    }

    res.json({ agent_collaboration_trace: buildCollaborationTrace(analysis.agentLogs || []) });
  } catch (error) {
    log.error('Collaboration trace error', { error: String(error) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to build collaboration trace' });
  }
});

router.get('/:analysisId/decision', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const analysisId = singleParam(req.params.analysisId);
    const analysis = await prisma.analysis.findFirst({
      where: { id: analysisId, userId },
      include: { agentLogs: { orderBy: { createdAt: 'asc' } } },
    });

    if (!analysis) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
      return;
    }

    const brief = buildStrategicBrief(analysis);
    if (!brief) {
      res.status(422).json({ code: 'REPORT_NOT_READY', message: 'Strategic brief is not available yet' });
      return;
    }

    const analysisMeta = (brief.analysis_meta || {}) as Record<string, unknown>;
    res.json({
      decision_statement: brief.decision_statement,
      decision_confidence: brief.decision_confidence,
      decision_rationale: brief.decision_rationale,
      executive_summary: brief.executive_summary,
      board_narrative: brief.board_narrative,
      strategic_imperatives: brief.decision_evidence || [],
      supporting_frameworks: brief.frameworks_applied || [],
      framework_so_whats: brief.so_what_callouts || {},
      red_team_response: (analysis.synthesisData as Record<string, unknown> | null)?.red_team_response || null,
      has_blocking_warnings: analysisMeta.has_blocking_warnings || false,
      fatal_invalidation_count: analysisMeta.fatal_invalidation_count || 0,
      major_invalidation_count: analysisMeta.major_invalidation_count || 0,
      recommendation_downgraded: analysisMeta.recommendation_downgraded || false,
      original_recommendation: analysisMeta.original_recommendation || null,
      three_options: analysisMeta.three_options || null,
      build_vs_buy_verdict: analysisMeta.build_vs_buy_verdict || null,
      recommended_option: analysisMeta.recommended_option || null,
    });
  } catch (error) {
    log.error('Decision payload error', { error: String(error) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to get decision' });
  }
});

router.post('/:analysisId/pdf', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const analysisId = singleParam(req.params.analysisId);
    const analysis = await prisma.analysis.findFirst({
      where: { id: analysisId, userId },
      include: { agentLogs: { orderBy: { createdAt: 'asc' } } },
    });

    if (!analysis) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
      return;
    }

    const brief = buildStrategicBrief(analysis);
    if (!brief) {
      res.status(422).json({ code: 'REPORT_NOT_READY', message: 'Strategic brief is not available yet' });
      return;
    }

    const theme = reportTheme(req.body?.theme);
    const pdfResponse = await fetch(`${frontendPdfBaseUrl()}/api/pdf/${analysis.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.authorization || '',
      },
      body: JSON.stringify({
        analysis_id: analysis.id,
        brief,
        appendix: buildPdfAppendix(transformAnalysisRecord(analysis).agent_logs as Array<Record<string, unknown>>),
        theme,
      }),
    });

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      log.error('PDF generation proxy failed', {
        analysisId: analysis.id,
        status: pdfResponse.status,
        body: errorText,
      });
      res.status(502).json({ code: 'PDF_PROXY_FAILED', message: 'PDF generation failed' });
      return;
    }

    const arrayBuffer = await pdfResponse.arrayBuffer();
    const contentType = pdfResponse.headers.get('content-type') || 'application/pdf';
    const disposition =
      pdfResponse.headers.get('content-disposition') ||
      `attachment; filename="ASIS_${analysis.id}.pdf"`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', disposition);
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    log.error('PDF generation error', { error: String(error) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to generate PDF' });
  }
});

router.get('/:analysisId/pdf/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const analysisId = singleParam(req.params.analysisId);
    const analysis = await prisma.analysis.findFirst({
      where: { id: analysisId, userId },
      select: { id: true, pdfUrl: true },
    });

    if (!analysis) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
      return;
    }

    res.json({
      status: 'ready',
      progress: 100,
      url: analysis.pdfUrl || null,
    });
  } catch (error) {
    log.error('PDF status error', { error: String(error) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to get PDF status' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const analysisId = singleParam(req.params.id);
    const analysis = await prisma.analysis.findFirst({
      where: { id: analysisId, userId },
    });

    if (!analysis) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
      return;
    }

    await prisma.analysis.delete({ where: { id: analysisId } });
    res.status(204).send();
  } catch (error) {
    log.error('Report delete error', { error: String(error) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to delete report' });
  }
});

export default router;
