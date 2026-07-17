import OpenAI from 'openai';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// ── Groq client (OpenAI-compatible SDK) ─────────────────────────────────────
let groqClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!groqClient) {
    if (!env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured and LLM fallback is disabled.');
    }
    groqClient = new OpenAI({
      apiKey: env.GROQ_API_KEY,
      baseURL: env.GROQ_BASE_URL || env.GROQ_API_BASE || 'https://api.groq.com/openai/v1',
    });
  }
  return groqClient;
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value.trim() === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function isLiveLLMConfigured(): boolean {
  return Boolean(env.GROQ_API_KEY?.trim());
}

export function isLlmFallbackAllowed(): boolean {
  return parseBooleanEnv(env.ALLOW_LLM_FALLBACK, false);
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

// ── Main Groq LLM call with retry and fail-hard defaults ────────────────────
export async function callLLMWithRetry<T extends Record<string, unknown>>(
  systemPrompt: string,
  userMessage: string,
  requiredFields: string[],
  fallback: T,
  agentId: string = 'strategist',
  maxAttempts?: number
): Promise<{
  data: T;
  usedFallback: boolean;
  attempts: number;
  tokenUsage: { input: number; output: number };
  durationMs: number;
}> {
  const startTime = Date.now();
  const fallbackAllowed = isLlmFallbackAllowed();

  if (!isLiveLLMConfigured()) {
    if (fallbackAllowed) {
      logger.warn('No GROQ_API_KEY and ALLOW_LLM_FALLBACK is enabled; using structured fallback');
      return {
        data: fallback,
        usedFallback: true,
        attempts: 0,
        tokenUsage: { input: 0, output: 0 },
        durationMs: Date.now() - startTime,
      };
    }
    throw new Error('GROQ_API_KEY is not configured and LLM fallback is disabled.');
  }

  const client = getClient();
  const model = getModelForAgent(agentId);
  const retries = maxAttempts ?? env.LLM_MAX_RETRIES;
  const timeoutMs = env.LLM_REQUEST_TIMEOUT || 30000;
  const baseMs = env.LLM_RETRY_BASE_MS || 500;
  const jitterPct = Math.max(0, Math.min(1, env.LLM_RETRY_JITTER_PCT || 0.2));

  function backoffDelay(attempt: number) {
    const delay = baseMs * Math.pow(2, attempt - 1);
    const jitter = 1 + (Math.random() * 2 - 1) * jitterPct; // between (1-jitterPct) and (1+jitterPct)
    return Math.max(0, Math.floor(delay * jitter));
  }

  function timeoutPromise<Tp>(ms: number, p: Promise<Tp>) {
    return Promise.race([
      p,
      new Promise<Tp>((_, rej) => setTimeout(() => rej(new Error('LLM request timed out')), ms)),
    ]);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info({ agent: agentId, model, attempt }, `LLM call starting`);
      const createPromise = client.chat.completions.create({
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

      const response = await timeoutPromise(timeoutMs, createPromise as Promise<any>);

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

      if (attempt < retries) {
        logger.warn({ attempt, fields: requiredFields }, 'Agent schema validation failed, retrying...');
        await sleep(backoffDelay(attempt));
      }
    } catch (err: any) {
      // Handle rate limiting (429) with backoff
      if (err?.status === 429) {
        const retryAfterRaw =
          err?.headers?.['retry-after'] || err?.response?.headers?.['retry-after'] || err?.response?.headers?.get?.('retry-after');
        const retryAfter = parseInt(retryAfterRaw || '10', 10);
        logger.warn({ attempt, retryAfter }, 'Rate limited by Groq — waiting...');
        await sleep(retryAfter * 1000);
        continue;
      }

      // Timeout error thrown by our timeoutPromise
      if (err?.message && err.message.includes('timed out')) {
        logger.warn({ attempt }, 'LLM request timed out');
      } else {
        logger.error({ attempt, error: err?.message || String(err) }, 'LLM call error');
      }

      if (attempt < retries) await sleep(backoffDelay(attempt));
    }
  }

  if (fallbackAllowed) {
    logger.warn({ agentId }, 'All LLM attempts failed and ALLOW_LLM_FALLBACK is enabled; using structured fallback');
    return {
      data: fallback,
      usedFallback: true,
      attempts: maxAttempts,
      tokenUsage: { input: 0, output: 0 },
      durationMs: Date.now() - startTime,
    };
  }

  throw new Error(`Groq live response failed validation after ${maxAttempts} attempt(s); fallback is disabled.`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
