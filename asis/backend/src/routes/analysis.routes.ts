import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/database';
import { requireAuth } from '../lib/auth';
import { runPipeline } from '../agents/pipeline';
import { log } from '../lib/logger';
import Anthropic from '@anthropic-ai/sdk';
import { robustJsonParse } from '../lib/llmClient';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const createAnalysisSchema = z.object({ problemStatement: z.string().min(10).max(5000) });

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
    const context = await extractProblemContext(parsed.data.problemStatement);
    const analysis = await prisma.analysis.create({
      data: {
        userId: (req as any).user.id,
        organisationId: (req as any).user.organisationId,
        problemStatement: parsed.data.problemStatement,
        ...context,
        status: 'queued',
        agentsTotal: 8,
      }
    });
    await prisma.user.update({ where: { id: (req as any).user.id }, data: { analysisCount: { increment: 1 } } });
    log.info('Analysis created', { analysisId: analysis.id, userId: (req as any).user.id });
    runPipeline(analysis.id).catch(err => log.error('Pipeline error', { analysisId: analysis.id, error: String(err) }));
    res.status(201).json({ analysis });
  } catch (err) { next(err); }
});

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
        industryContext: true, geographyContext: true,
      }
    }),
    prisma.analysis.count({ where })
  ]);
  res.json({ analyses, total });
});

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const analysis = await prisma.analysis.findFirst({
    where: { id: req.params.id, userId: (req as any).user.id },
    include: { agentLogs: { orderBy: { createdAt: 'asc' } } }
  });
  if (!analysis) { res.status(404).json({ message: 'Analysis not found' }); return; }
  res.json({ analysis });
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const analysis = await prisma.analysis.findFirst({ where: { id: req.params.id, userId: (req as any).user.id } });
  if (!analysis) { res.status(404).json({ message: 'Not found' }); return; }
  await prisma.analysis.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
