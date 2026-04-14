import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { runPipeline } from '../agents/pipeline.js';
import { extractProblemContext } from '../lib/contextExtractor.js';
import { validateProblemStatement } from '../lib/problemValidator.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────
const createAnalysisSchema = z.object({
  problemStatement: z
    .string()
    .min(20, 'Problem statement must be at least 20 characters')
    .max(5000, 'Problem statement too long'),
  acknowledgedWarnings: z.boolean().optional(),
});

const listQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// ── POST /api/analyses — Create + queue pipeline ─────────────────────────────
router.post(
  '/validate',
  requireAuth,
  validate(
    z.object({
      problemStatement: z
        .string()
        .min(20, 'Problem statement must be at least 20 characters')
        .max(5000, 'Problem statement too long'),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { problemStatement } = req.body;
      const validation = await validateProblemStatement(problemStatement);
      res.json({ validation });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  requireAuth,
  validate(createAnalysisSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { problemStatement, acknowledgedWarnings = false } = req.body;
      const validation = await validateProblemStatement(problemStatement);
      const blockingWarnings = validation.warnings.filter((warning) => warning.severity === 'BLOCKING');

      if (blockingWarnings.length > 0 && !acknowledgedWarnings) {
        res.status(422).json({
          code: 'VALIDATION_WARNINGS',
          warnings: validation.warnings,
          message: 'Problem statement has issues that may affect analysis quality.',
          requiresAcknowledgement: true,
        });
        return;
      }

      const extracted = await extractProblemContext(problemStatement);
      const organisationContext =
        validation.enrichedContext.organisation || extracted.organisationContext || '';
      const industryContext =
        validation.enrichedContext.industry || extracted.industryContext || '';
      const geographyContext =
        validation.enrichedContext.geography || extracted.geographyContext || '';
      const decisionType =
        validation.enrichedContext.decision_type || extracted.decisionType || '';

      const analysis = await prisma.analysis.create({
        data: {
          userId: req.user!.userId,
          organisationId: req.user!.organisationId || null,
          problemStatement,
          organisationContext,
          industryContext,
          geographyContext,
          decisionType,
          validationWarnings: JSON.stringify(validation.warnings),
          hasBlockingWarnings: blockingWarnings.length > 0,
          userAcknowledgedWarnings: acknowledgedWarnings,
          status: 'queued',
          agentsTotal: 8,
        },
      });

      // Increment user's analysis count
      await prisma.user.update({
        where: { id: req.user!.userId },
        data: { analysisCount: { increment: 1 } },
      });

      logger.info({ analysisId: analysis.id, userId: req.user!.userId }, 'Analysis created');

      // Run pipeline asynchronously (non-blocking)
      runPipeline(analysis.id).catch((err) => {
        logger.error({ analysisId: analysis.id, error: err.message }, 'Pipeline failed');
      });

      res.status(201).json({
        analysis: {
          ...analysis,
          validationWarnings: validation.warnings,
        },
        validationWarnings: validation.warnings,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ── GET /api/analyses — List user's analyses ─────────────────────────────────
router.get(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listQuerySchema.parse(req.query);

      const where: any = { userId: req.user!.userId };
      if (query.status) where.status = query.status;
      if (query.search) {
        where.problemStatement = { contains: query.search };
      }

      const [analyses, total] = await Promise.all([
        prisma.analysis.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: query.limit,
          skip: query.offset,
          select: {
            id: true,
            problemStatement: true,
            status: true,
            overallConfidence: true,
            decisionRecommendation: true,
            durationSeconds: true,
            createdAt: true,
            completedAt: true,
            agentsCompleted: true,
            agentsTotal: true,
            organisationContext: true,
            industryContext: true,
            geographyContext: true,
            decisionType: true,
            boardNarrative: true,
            executiveSummary: true,
            fatalInvalidationCount: true,
            majorInvalidationCount: true,
            recommendationDowngraded: true,
            originalRecommendation: true,
            recommendedOption: true,
            buildVsBuyVerdict: true,
            hasBlockingWarnings: true,
          },
        }),
        prisma.analysis.count({ where }),
      ]);

      res.json({ analyses, total, limit: query.limit, offset: query.offset });
    } catch (error) {
      next(error);
    }
  }
);

// ── GET /api/analyses/:id — Full analysis detail ─────────────────────────────
router.get(
  '/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const analysis = await prisma.analysis.findFirst({
        where: { id: req.params.id, userId: req.user!.userId },
        include: { agentLogs: { orderBy: { createdAt: 'asc' } } },
      });

      if (!analysis) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Analysis not found' });
        return;
      }

      // Parse JSON string fields back to objects for the response
      const parsed = {
        ...analysis,
        strategistData: safeJsonParse(analysis.strategistData),
        quantData: safeJsonParse(analysis.quantData),
        marketIntelData: safeJsonParse(analysis.marketIntelData),
        riskData: safeJsonParse(analysis.riskData),
        redTeamData: safeJsonParse(analysis.redTeamData),
        ethicistData: safeJsonParse(analysis.ethicistData),
        synthesisData: safeJsonParse(analysis.synthesisData),
        coveVerificationData: safeJsonParse(analysis.coveVerificationData),
        validationWarnings: safeJsonParse(analysis.validationWarnings),
        threeOptionsData: safeJsonParse(analysis.threeOptionsData),
        confidenceBreakdown: safeJsonParse(analysis.confidenceBreakdown),
        agentLogs: analysis.agentLogs.map((log) => ({
          ...log,
          parsedOutput: safeJsonParse(log.parsedOutput),
        })),
      };

      res.json({ analysis: parsed });
    } catch (error) {
      next(error);
    }
  }
);

// ── DELETE /api/analyses/:id ─────────────────────────────────────────────────
router.delete(
  '/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const analysis = await prisma.analysis.findFirst({
        where: { id: req.params.id, userId: req.user!.userId },
      });

      if (!analysis) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Analysis not found' });
        return;
      }

      await prisma.analysis.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// ── Helper ───────────────────────────────────────────────────────────────────
function safeJsonParse(value: unknown): any {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export default router;
