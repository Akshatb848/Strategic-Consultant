import { Router, type NextFunction, type Request, type Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import { runPipeline } from '../agents/pipeline';
import { requireAuth } from '../lib/auth';
import { prisma } from '../lib/database';
import { robustJsonParse } from '../lib/llmClient';
import { log } from '../lib/logger';
import { transformAnalysisRecord } from '../lib/reportAdapter';
import { registerSseClient } from '../lib/socketio';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const createAnalysisSchema = z
  .object({
    problemStatement: z.string().min(10).max(5000).optional(),
    query: z.string().min(10).max(5000).optional(),
    company_context: z.record(z.unknown()).optional(),
  })
  .refine((data) => data.problemStatement || data.query, {
    message: 'problemStatement or query is required',
  });

interface ExtractedProblemContext {
  organisationContext: string;
  industryContext: string;
  geographyContext: string;
  decisionType: string;
}

function singleParam(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first : '';
  }
  return typeof value === 'string' ? value : '';
}

async function extractProblemContext(problemStatement: string): Promise<ExtractedProblemContext> {
  try {
    const result = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Extract from this problem: return JSON with org, industry, geography, decision_type fields. Problem: "${problemStatement}"`,
        },
      ],
    });
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
    const parsed = robustJsonParse<Record<string, unknown>>(text);
    return {
      organisationContext: typeof parsed?.organisation === 'string' ? parsed.organisation : '',
      industryContext: typeof parsed?.industry === 'string' ? parsed.industry : '',
      geographyContext: typeof parsed?.geography === 'string' ? parsed.geography : '',
      decisionType: typeof parsed?.decision_type === 'string' ? parsed.decision_type : '',
    };
  } catch {
    return {
      organisationContext: '',
      industryContext: '',
      geographyContext: '',
      decisionType: '',
    };
  }
}

router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createAnalysisSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const problemStatement = parsed.data.problemStatement || parsed.data.query || '';
    const companyContext = (parsed.data.company_context || {}) as Record<string, string>;
    const extracted = await extractProblemContext(problemStatement);
    const finalContext = {
      organisationContext: companyContext.company_name || extracted.organisationContext,
      industryContext: companyContext.sector || extracted.industryContext,
      geographyContext: companyContext.geography || extracted.geographyContext,
      decisionType: companyContext.decision_type || extracted.decisionType,
    };

    const analysis = await prisma.analysis.create({
      data: {
        userId: (req as Request & { user: { id: string; organisationId?: string | null } }).user.id,
        organisationId:
          (req as Request & { user: { id: string; organisationId?: string | null } }).user.organisationId || null,
        problemStatement,
        ...finalContext,
        status: 'queued',
        agentsTotal: 8,
      },
      include: { agentLogs: { orderBy: { createdAt: 'asc' } } },
    });

    await prisma.user.update({
      where: { id: (req as Request & { user: { id: string } }).user.id },
      data: { analysisCount: { increment: 1 } },
    });

    log.info('Analysis created', {
      analysisId: analysis.id,
      userId: (req as Request & { user: { id: string } }).user.id,
    });

    runPipeline(analysis.id).catch((error: unknown) => {
      log.error('Pipeline error', { analysisId: analysis.id, error: String(error) });
    });

    res.status(201).json({ analysis: transformAnalysisRecord(analysis) });
  } catch (error) {
    next(error);
  }
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { status, search, limit = 20, offset = 0 } = req.query;
  const where: Record<string, unknown> = {
    userId: (req as Request & { user: { id: string } }).user.id,
  };
  const statusValue = singleParam(status);
  const searchValue = singleParam(search);
  if (statusValue) where.status = statusValue;
  if (searchValue) {
    where.problemStatement = { contains: searchValue, mode: 'insensitive' };
  }

  const [analyses, total] = await Promise.all([
    prisma.analysis.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
      include: { agentLogs: { orderBy: { createdAt: 'asc' } } },
    }),
    prisma.analysis.count({ where }),
  ]);

  res.json({
    analyses: analyses.map((analysis) => transformAnalysisRecord(analysis)),
    total,
  });
});

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const analysisId = singleParam(req.params.id);
  const analysis = await prisma.analysis.findFirst({
    where: {
      id: analysisId,
      userId: (req as Request & { user: { id: string } }).user.id,
    },
    include: { agentLogs: { orderBy: { createdAt: 'asc' } } },
  });

  if (!analysis) {
    res.status(404).json({ message: 'Analysis not found' });
    return;
  }

  res.json({ analysis: transformAnalysisRecord(analysis) });
});

router.get('/:id/events', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const analysisId = singleParam(req.params.id);
  const analysis = await prisma.analysis.findFirst({
    where: { id: analysisId, userId },
    select: { id: true, status: true },
  });

  if (!analysis) {
    res.status(404).end();
    return;
  }

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

  const unregister = registerSseClient(analysisId, res);
  req.on('close', unregister);
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const analysisId = singleParam(req.params.id);
  const analysis = await prisma.analysis.findFirst({
    where: {
      id: analysisId,
      userId: (req as Request & { user: { id: string } }).user.id,
    },
  });

  if (!analysis) {
    res.status(404).json({ message: 'Not found' });
    return;
  }

  await prisma.analysis.delete({ where: { id: analysisId } });
  res.status(204).send();
});

export default router;
