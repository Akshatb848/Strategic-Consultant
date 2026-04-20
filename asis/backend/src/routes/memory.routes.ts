import { Router, Request, Response } from 'express';
import { requireAuth } from '../lib/auth';
import { log } from '../lib/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

export interface MemoryEntry {
  id: string;
  scope: string;
  key: string;
  value: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// In-process memory store keyed by `${userId}:${scope}:${key}`
const memoryStore = new Map<string, MemoryEntry>();

function getUserEntries(userId: string): MemoryEntry[] {
  const prefix = `${userId}:`;
  const entries: MemoryEntry[] = [];
  for (const [k, v] of memoryStore.entries()) {
    if (k.startsWith(prefix)) entries.push(v);
  }
  return entries;
}

// GET / — list all memory entries for the authenticated user
router.get('/', requireAuth, (_req: Request, res: Response) => {
  const userId = (_req as any).user.id as string;
  const items = getUserEntries(userId);
  res.json({ items });
});

// POST / — upsert a memory entry
router.post('/', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).user.id as string;
  const { scope, key, value } = req.body as { scope?: string; key?: string; value?: Record<string, unknown> };

  if (!scope || !key || value === undefined || value === null) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'scope, key, and value are required' });
    return;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'value must be a plain object' });
    return;
  }

  const storeKey = `${userId}:${scope}:${key}`;
  const now = new Date().toISOString();
  const existing = memoryStore.get(storeKey);

  const entry: MemoryEntry = {
    id: existing?.id ?? uuidv4(),
    scope,
    key,
    value,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  memoryStore.set(storeKey, entry);
  log.debug('Memory upsert', { userId, scope, key });
  res.status(200).json(entry);
});

// DELETE / — clear all memory for the user
router.delete('/', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).user.id as string;
  const prefix = `${userId}:`;
  let deleted = 0;
  for (const k of memoryStore.keys()) {
    if (k.startsWith(prefix)) {
      memoryStore.delete(k);
      deleted++;
    }
  }
  log.debug('Memory cleared', { userId, deleted });
  res.status(200).json({ deleted });
});

// POST /semantic-search — simple text-based similarity search
router.post('/semantic-search', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).user.id as string;
  const { query, limit = 10 } = req.body as { query?: string; limit?: number };

  if (!query || typeof query !== 'string') {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'query is required' });
    return;
  }

  const entries = getUserEntries(userId);
  const queryLower = query.toLowerCase();
  const queryTokens = queryLower.split(/\s+/).filter(t => t.length > 2);

  // Score entries by substring/token match against serialized value
  const scored = entries
    .map(entry => {
      const text = JSON.stringify(entry.value).toLowerCase();
      let score = 0;
      // Exact substring match gets highest score
      if (text.includes(queryLower)) score += 10;
      // Token-level matches
      for (const token of queryTokens) {
        if (text.includes(token)) score += 1;
      }
      // Also match on scope/key
      if (entry.scope.toLowerCase().includes(queryLower)) score += 5;
      if (entry.key.toLowerCase().includes(queryLower)) score += 5;
      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Number(limit))
    .map(({ entry }) => entry);

  res.json({ items: scored, query, total: scored.length });
});

export default router;
