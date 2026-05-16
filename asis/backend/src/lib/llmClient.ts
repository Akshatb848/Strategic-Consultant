import 'dotenv/config';

import { log } from './logger';

const DEFAULT_PRIMARY_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_FAST_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_API_BASE = 'https://api.groq.com/openai/v1';

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

export function robustJsonParse<T>(raw: string): T | null {
  if (!raw?.trim()) return null;

  const stripped = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  try {
    return JSON.parse(stripped) as T;
  } catch {
    // keep trying
  }

  const block = stripped.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (block) {
    try {
      return JSON.parse(block[1].trim()) as T;
    } catch {
      // keep trying
    }
  }

  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(stripped.slice(firstBrace, lastBrace + 1)) as T;
    } catch {
      // keep trying
    }
  }

  const cleaned = stripped
    .replace(/```json?/g, '')
    .replace(/```/g, '')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
    .replace(/:\s*'([^']*)'/g, ': "$1"')
    .trim();

  const cleanedFirstBrace = cleaned.indexOf('{');
  const cleanedLastBrace = cleaned.lastIndexOf('}');
  if (cleanedFirstBrace !== -1 && cleanedLastBrace > cleanedFirstBrace) {
    try {
      return JSON.parse(cleaned.slice(cleanedFirstBrace, cleanedLastBrace + 1)) as T;
    } catch {
      // give up
    }
  }

  return null;
}

export function validateRequiredFields(data: Record<string, unknown>, required: string[]): boolean {
  return required.every((field) => data[field] !== undefined && data[field] !== null && data[field] !== '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value.trim() === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function isLiveLLMConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function isLlmFallbackAllowed(): boolean {
  return parseBooleanEnv(process.env.ALLOW_LLM_FALLBACK, false);
}

function getGroqApiBase(): string {
  return (process.env.GROQ_API_BASE || process.env.GROQ_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, '');
}

function modelForAgent(agentId: string): string {
  const primary = process.env.GROQ_MODEL_PRIMARY || DEFAULT_PRIMARY_MODEL;
  const fast = process.env.GROQ_MODEL_FAST || DEFAULT_FAST_MODEL;
  const reasoning = process.env.GROQ_MODEL_REASONING || primary;
  const configured: Record<string, string | undefined> = {
    strategist: process.env.LLM_MODEL_STRATEGIST,
    quant: process.env.LLM_MODEL_QUANT || reasoning,
    market_intel: process.env.LLM_MODEL_MARKET_INTEL || primary,
    risk: process.env.LLM_MODEL_RISK || primary,
    red_team: process.env.LLM_MODEL_RED_TEAM || primary,
    ethicist: process.env.LLM_MODEL_ETHICIST || primary,
    cove: process.env.LLM_MODEL_COVE || reasoning,
    synthesis: process.env.LLM_MODEL_SYNTHESIS || primary,
    patent: primary,
    dissertation: primary,
  };
  return configured[agentId] || primary || fast;
}

function inferAgentId(systemPrompt: string): string {
  const lower = systemPrompt.toLowerCase();
  if (lower.includes('patent attorney')) return 'patent';
  if (lower.includes('academic research advisor')) return 'dissertation';
  if (lower.includes('cove') || lower.includes('verification officer')) return 'cove';
  if (lower.includes('quant') || lower.includes('financial')) return 'quant';
  if (lower.includes('market')) return 'market_intel';
  if (lower.includes('red team') || lower.includes('adversarial')) return 'red_team';
  if (lower.includes('ethic') || lower.includes('esg')) return 'ethicist';
  if (lower.includes('risk')) return 'risk';
  if (lower.includes('synthesis') || lower.includes('report assembler')) return 'synthesis';
  return 'strategist';
}

function normalizeContent(content: string | Array<{ text?: string }> | undefined): string {
  if (Array.isArray(content)) {
    return content.map((part) => part.text || '').join('');
  }
  return typeof content === 'string' ? content : '';
}

async function callGroq(model: string, systemPrompt: string, userMessage: string): Promise<GroqChatResponse> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured and LLM fallback is disabled.');
  }

  const response = await fetch(`${getGroqApiBase()}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: Number(process.env.GROQ_MAX_TOKENS || process.env.LLM_MAX_TOKENS || 4096),
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `${userMessage}\n\nRETURN ONLY VALID JSON. NO TEXT BEFORE OR AFTER. NO MARKDOWN FENCES. NO <think> TAGS.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Groq API request failed with HTTP ${response.status}: ${body.slice(0, 240)}`);
    (error as Error & { status?: number; retryAfter?: number }).status = response.status;
    const retryAfter = Number(response.headers.get('retry-after') || 0);
    if (retryAfter > 0) {
      (error as Error & { retryAfter?: number }).retryAfter = retryAfter;
    }
    throw error;
  }

  return (await response.json()) as GroqChatResponse;
}

export async function callLLMWithRetry<T extends Record<string, unknown>>(
  systemPrompt: string,
  userMessage: string,
  requiredFields: string[],
  fallback: T,
  agentIdOrMaxAttempts: string | number = 'strategist',
  maybeMaxAttempts = 3
): Promise<{ data: T; usedFallback: boolean; attempts: number; inputTokens: number; outputTokens: number }> {
  const fallbackAllowed = isLlmFallbackAllowed();
  const agentId = typeof agentIdOrMaxAttempts === 'string' ? agentIdOrMaxAttempts : inferAgentId(systemPrompt);
  const maxAttempts = typeof agentIdOrMaxAttempts === 'number' ? agentIdOrMaxAttempts : maybeMaxAttempts;
  let currentUserMessage = userMessage;

  if (!isLiveLLMConfigured()) {
    if (fallbackAllowed) {
      log.warn('No GROQ_API_KEY and ALLOW_LLM_FALLBACK is enabled; using structured fallback');
      return { data: fallback, usedFallback: true, attempts: 0, inputTokens: 0, outputTokens: 0 };
    }
    throw new Error('GROQ_API_KEY is not configured and LLM fallback is disabled.');
  }

  const model = modelForAgent(agentId);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      log.info(`Groq LLM call starting - agent=${agentId} model=${model} attempt=${attempt}/${maxAttempts}`);
      const response = await callGroq(model, systemPrompt, currentUserMessage);
      const rawText = normalizeContent(response.choices?.[0]?.message?.content || '');
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      const parsed = robustJsonParse<T>(rawText);

      if (parsed && validateRequiredFields(parsed as Record<string, unknown>, requiredFields)) {
        return { data: parsed, usedFallback: false, attempts: attempt, inputTokens, outputTokens };
      }

      if (attempt < maxAttempts) {
        log.warn(`Schema validation failed on attempt ${attempt} (required: ${requiredFields.join(', ')}) - retrying`);
        currentUserMessage = `The previous response could not be parsed or was missing required fields (${requiredFields.join(', ')}).
Repair it into valid JSON without changing the underlying facts.

Original request:
${userMessage}

Previous invalid response:
${rawText.slice(0, 6000)}`;
        await sleep(attempt * 800);
      }
    } catch (error: unknown) {
      const err = error as Error & { status?: number; retryAfter?: number };
      if (err.status === 429) {
        const retryAfter = err.retryAfter || 15;
        log.warn(`Groq rate limit - waiting ${retryAfter}s before retry (attempt ${attempt})`);
        await sleep(retryAfter * 1000);
        continue;
      }
      log.error(`Groq LLM call error on attempt ${attempt}: ${err.message || String(error)}`);
      if (attempt < maxAttempts) {
        await sleep(attempt * 1200);
      }
    }
  }

  if (fallbackAllowed) {
    log.warn(`All Groq attempts failed and ALLOW_LLM_FALLBACK is enabled (required: ${requiredFields.join(', ')})`);
    return { data: fallback, usedFallback: true, attempts: maxAttempts, inputTokens: 0, outputTokens: 0 };
  }

  throw new Error(`Groq live response failed validation after ${maxAttempts} attempt(s); fallback is disabled.`);
}
