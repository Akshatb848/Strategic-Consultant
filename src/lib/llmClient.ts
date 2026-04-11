import OpenAI from 'openai';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// ── Groq client (OpenAI-compatible SDK) ─────────────────────────────────────
let groqClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!groqClient) {
    if (!env.GROQ_API_KEY) {
      logger.warn('⚠️  GROQ_API_KEY not set — agents will use fallback data');
    }
    groqClient = new OpenAI({
      apiKey: env.GROQ_API_KEY || 'dummy-key-for-fallback',
      baseURL: env.GROQ_BASE_URL,
    });
  }
  return groqClient;
}

// ── Model routing — each agent gets the best model for its task ─────────────
export function getModelForAgent(agentId: string): string {
  const modelMap: Record<string, string> = {
    context_extractor: env.LLM_MODEL_CONTEXT_EXTRACTOR,
    strategist: env.LLM_MODEL_STRATEGIST,
    quant: env.LLM_MODEL_QUANT,
    market_intel: env.LLM_MODEL_MARKET_INTEL,
    risk: env.LLM_MODEL_RISK,
    red_team: env.LLM_MODEL_RED_TEAM,
    ethicist: env.LLM_MODEL_ETHICIST,
    cove: env.LLM_MODEL_COVE,
    synthesis: env.LLM_MODEL_SYNTHESIS,
  };
  return modelMap[agentId] || env.LLM_MODEL_STRATEGIST;
}

// ── 4-strategy JSON extraction ───────────────────────────────────────────────
export function robustJsonParse<T>(raw: string): T | null {
  if (!raw?.trim()) return null;

  // Strategy 1: direct parse
  try {
    return JSON.parse(raw.trim()) as T;
  } catch (_) { /* continue */ }

  // Strategy 2: extract from ```json ... ``` blocks
  const block = raw.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (block) {
    try {
      return JSON.parse(block[1].trim()) as T;
    } catch (_) { /* continue */ }
  }

  // Strategy 3: first { to last }
  const fi = raw.indexOf('{');
  const li = raw.lastIndexOf('}');
  if (fi !== -1 && li > fi) {
    try {
      return JSON.parse(raw.slice(fi, li + 1)) as T;
    } catch (_) { /* continue */ }
  }

  // Strategy 4: aggressive cleanup
  const cleaned = raw
    .replace(/```json?/g, '')
    .replace(/```/g, '')
    .replace(/,\s*([}\]])/g, '$1') // trailing commas
    .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // unquoted keys
    .replace(/:\s*'([^']*)'/g, ': "$1"') // single-quoted values
    .trim();
  const fi2 = cleaned.indexOf('{');
  const li2 = cleaned.lastIndexOf('}');
  if (fi2 !== -1 && li2 > fi2) {
    try {
      return JSON.parse(cleaned.slice(fi2, li2 + 1)) as T;
    } catch (_) { /* continue */ }
  }

  return null;
}

// ── Schema validation ────────────────────────────────────────────────────────
export function validateRequiredFields(
  data: Record<string, unknown>,
  required: string[]
): boolean {
  return required.every(
    (field) => data[field] !== undefined && data[field] !== null && data[field] !== ''
  );
}

// ── Main LLM call with retry + fallback ─────────────────────────────────────
export async function callLLMWithRetry<T extends Record<string, unknown>>(
  systemPrompt: string,
  userMessage: string,
  requiredFields: string[],
  fallback: T,
  agentId: string = 'strategist',
  maxAttempts: number = 3
): Promise<{
  data: T;
  usedFallback: boolean;
  attempts: number;
  tokenUsage: { input: number; output: number };
  durationMs: number;
}> {
  const startTime = Date.now();

  // If no API key, use fallback immediately
  if (!env.GROQ_API_KEY) {
    logger.warn('No GROQ_API_KEY — using structured fallback');
    return {
      data: fallback,
      usedFallback: true,
      attempts: 0,
      tokenUsage: { input: 0, output: 0 },
      durationMs: Date.now() - startTime,
    };
  }

  const client = getClient();
  const model = getModelForAgent(agentId);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.info({ agent: agentId, model, attempt }, `LLM call starting`);

      const response = await client.chat.completions.create({
        model,
        max_tokens: env.LLM_MAX_TOKENS,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `${userMessage}\n\nRETURN ONLY VALID JSON. NO TEXT BEFORE OR AFTER. NO MARKDOWN FENCES. NO <think> TAGS.`,
          },
        ],
      });

      const rawText = response.choices?.[0]?.message?.content || '';

      // Strip any <think>...</think> tags that some models emit
      const cleanedText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      const parsed = robustJsonParse<T>(cleanedText);

      if (parsed && validateRequiredFields(parsed as Record<string, unknown>, requiredFields)) {
        return {
          data: parsed,
          usedFallback: false,
          attempts: attempt,
          tokenUsage: {
            input: response.usage?.prompt_tokens || 0,
            output: response.usage?.completion_tokens || 0,
          },
          durationMs: Date.now() - startTime,
        };
      }

      if (attempt < maxAttempts) {
        logger.warn(
          { attempt, fields: requiredFields },
          'Agent schema validation failed, retrying...'
        );
        await sleep(attempt * 800);
      }
    } catch (err: any) {
      // Handle rate limiting (429) with backoff
      if (err?.status === 429) {
        const retryAfter = parseInt(err?.headers?.['retry-after'] || '10', 10);
        logger.warn({ attempt, retryAfter }, 'Rate limited by Groq — waiting...');
        await sleep(retryAfter * 1000);
        continue;
      }
      logger.error({ attempt, error: err.message }, 'LLM call error');
      if (attempt < maxAttempts) await sleep(attempt * 1000);
    }
  }

  // All attempts failed — use structured fallback
  logger.warn({ agentId }, 'All LLM attempts failed, using structured fallback');
  return {
    data: fallback,
    usedFallback: true,
    attempts: maxAttempts,
    tokenUsage: { input: 0, output: 0 },
    durationMs: Date.now() - startTime,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
