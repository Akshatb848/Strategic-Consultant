import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── GET /api/reports — List completed analyses as reports ────────────────────
router.get(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, limit = '20', offset = '0' } = req.query;

      const where: any = {
        userId: req.user!.userId,
        status: 'completed',
      };

      if (search) {
        where.problemStatement = { contains: search as string };
      }

      const [reports, total] = await Promise.all([
        prisma.analysis.findMany({
          where,
          orderBy: { completedAt: 'desc' },
          take: Number(limit),
          skip: Number(offset),
          select: {
            id: true,
            problemStatement: true,
            overallConfidence: true,
            decisionRecommendation: true,
            boardNarrative: true,
            executiveSummary: true,
            durationSeconds: true,
            organisationContext: true,
            industryContext: true,
            geographyContext: true,
            decisionType: true,
            agentsCompleted: true,
            agentsTotal: true,
            selfCorrectionCount: true,
            logicConsistencyPassed: true,
            redTeamChallengeCount: true,
            fatalInvalidationCount: true,
            majorInvalidationCount: true,
            recommendationDowngraded: true,
            originalRecommendation: true,
            recommendedOption: true,
            buildVsBuyVerdict: true,
            pipelineVersion: true,
            createdAt: true,
            completedAt: true,
          },
        }),
        prisma.analysis.count({ where }),
      ]);

      res.json({ reports, total });
    } catch (error) {
      next(error);
    }
  }
);

// ── GET /api/reports/:id — Full report detail ────────────────────────────────
router.get(
  '/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await prisma.analysis.findFirst({
        where: {
          id: req.params.id,
          userId: req.user!.userId,
          status: 'completed',
        },
        include: {
          agentLogs: { orderBy: { createdAt: 'asc' } },
        },
      });

      if (!report) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
        return;
      }

      // Parse JSON string fields
      const parsed = {
        ...report,
        strategistData: safeJsonParse(report.strategistData),
        quantData: safeJsonParse(report.quantData),
        marketIntelData: safeJsonParse(report.marketIntelData),
        riskData: safeJsonParse(report.riskData),
        redTeamData: safeJsonParse(report.redTeamData),
        ethicistData: safeJsonParse(report.ethicistData),
        synthesisData: safeJsonParse(report.synthesisData),
        coveVerificationData: safeJsonParse(report.coveVerificationData),
        validationWarnings: safeJsonParse(report.validationWarnings),
        threeOptionsData: safeJsonParse(report.threeOptionsData),
        confidenceBreakdown: safeJsonParse(report.confidenceBreakdown),
        agentLogs: report.agentLogs.map((log: { parsedOutput: unknown }) => ({
          ...log,
          parsedOutput: safeJsonParse(log.parsedOutput),
        })),
      };

      res.json({ report: parsed });
    } catch (error) {
      next(error);
    }
  }
);

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
