import { Router, Request, Response } from 'express';
import { prisma } from '../db/client.js';
import { env } from '../config/env.js';
import { isLiveLLMConfigured, isLlmFallbackAllowed } from '../lib/llmClient.js';

const router = Router();

// ── GET /api/health ──────────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  const start = Date.now();

  let dbStatus = 'connected';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'disconnected';
  }

  res.json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    app: env.APP_NAME,
    version: env.APP_VERSION,
    environment: env.NODE_ENV,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: dbStatus,
    llmProvider: 'groq',
    groqConfigured: isLiveLLMConfigured(),
    llmFallbackAllowed: isLlmFallbackAllowed(),
    responseTimeMs: Date.now() - start,
  });
});

export default router;
