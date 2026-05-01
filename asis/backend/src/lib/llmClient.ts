import Anthropic from '@anthropic-ai/sdk';

import { log } from './logger';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
const MAX_TOKENS = parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096', 10);

interface FallbackContext {
  organisation: string;
  industry: string;
  geography: string;
  decisionType: string;
}

const FALLBACK_CONFIDENCE_RANGE: [number, number] = [56, 68];

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
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function isLlmFallbackAllowed(): boolean {
  return parseBooleanEnv(process.env.ALLOW_LLM_FALLBACK, process.env.NODE_ENV !== 'production');
}

function extractFallbackContext(userMessage: string): FallbackContext {
  const fromLine = (label: string) => {
    const match = userMessage.match(new RegExp(`${label}:\\s*(.+)`, 'i'));
    return match?.[1]?.trim() || '';
  };

  return {
    organisation: fromLine('Organisation'),
    industry: fromLine('Industry'),
    geography: fromLine('Geography'),
    decisionType: fromLine('Decision Type'),
  };
}

function hashedConfidence(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 1000003;
  }
  const [min, max] = FALLBACK_CONFIDENCE_RANGE;
  return min + (Math.abs(hash) % (max - min + 1));
}

function sanitizeFallbackString(value: string, context: FallbackContext): string {
  const organisation = context.organisation || 'the client organization';
  const industry = context.industry || 'the sector';
  const geography = context.geography || 'the target market';
  const decisionType = context.decisionType || 'the stated decision';

  return value
    .replace(/\bReliance Industries\b/gi, organisation)
    .replace(/\bReliance\b/gi, organisation)
    .replace(/\bJioAI Labs\b/gi, 'the implementation program')
    .replace(/\bJioAI\b/gi, 'the proposed capability')
    .replace(/\bJioCinema\b|\bJioFiber\b|\bMyJio\b|\bJio Payments Bank\b/gi, 'the client operating platform')
    .replace(/\bTCS\b|\bInfosys\b|\bWipro\b|\bGoogle DeepMind India\b|\bGoogle India\b|\bKrutrim AI\b/gi, 'named incumbent competitors')
    .replace(/\bHDFC Bank\b|\bAirtel\b|\bVodafone Idea\b|\bBSNL\b/gi, 'relevant enterprise counterparties')
    .replace(/\bDPDP Act 2023\b/gi, 'the governing data and regulatory framework')
    .replace(/\bCCI\b|\bCompetition Commission of India\b/gi, 'the competition regulator')
    .replace(/\bJamnagar\b/gi, geography)
    .replace(/\bIndia enterprise AI market\b/gi, `${geography} market`)
    .replace(/\bvernacular AI\b/gi, `${industry} whitespace`)
    .replace(/\b450M-user data lake\b/gi, 'the client data and platform asset')
    .replace(/\bAI startup acquisition\b/gi, `${decisionType.toLowerCase()} case`);
}

function sanitizeFallbackPayload<T>(value: T, context: FallbackContext, path = 'root'): T {
  if (typeof value === 'string') {
    return sanitizeFallbackString(value, context) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => sanitizeFallbackPayload(entry, context, `${path}[${index}]`)) as T;
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (['confidence_score', 'overall_confidence', 'overall_verification_score'].includes(key)) {
        output[key] = hashedConfidence(
          `${context.organisation}|${context.industry}|${context.geography}|${context.decisionType}|${path}.${key}`
        );
        continue;
      }

      if (key === 'decision_recommendation' && typeof entry === 'string') {
        output[key] = 'HOLD';
        continue;
      }

      if (key === 'risk_adjusted_recommendation' && typeof entry === 'string') {
        output[key] = `${context.organisation || 'The client'} should defer a binding decision until a live model run validates the strategic and financial assumptions.`;
        continue;
      }

      if (key === 'board_narrative' && typeof entry === 'string') {
        output[key] = `${context.organisation || 'The client'} requires a live LLM-backed synthesis run before this recommendation can be treated as board-ready.`;
        continue;
      }

      if (key === 'executive_summary' && typeof entry === 'string') {
        output[key] = `Fallback-mode summary for ${context.organisation || 'the client'} in ${context.geography || 'the target market'}: validate this report with a live model run before using it for strategic decisions.`;
        continue;
      }

      if (key === 'quality_grade' && typeof entry === 'string') {
        output[key] = 'C';
        continue;
      }

      output[key] = sanitizeFallbackPayload(entry, context, `${path}.${key}`);
    }
    return output as T;
  }

  return value;
}

export async function callLLMWithRetry<T extends Record<string, unknown>>(
  systemPrompt: string,
  userMessage: string,
  requiredFields: string[],
  fallback: T,
  maxAttempts = 3
): Promise<{ data: T; usedFallback: boolean; attempts: number; inputTokens: number; outputTokens: number }> {
  const fallbackAllowed = isLlmFallbackAllowed();
  const fallbackContext = extractFallbackContext(userMessage);
  let currentUserMessage = userMessage;

  if (!isLiveLLMConfigured()) {
    if (!fallbackAllowed) {
      throw new Error('ANTHROPIC_API_KEY is not configured and ALLOW_LLM_FALLBACK is disabled.');
    }
    log.warn('No ANTHROPIC_API_KEY — using structured fallback');
    return {
      data: sanitizeFallbackPayload(fallback, fallbackContext),
      usedFallback: true,
      attempts: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      log.info(`LLM call starting — attempt ${attempt}/${maxAttempts}`);

      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `${currentUserMessage}\n\nRETURN ONLY VALID JSON. NO TEXT BEFORE OR AFTER. NO MARKDOWN FENCES. NO <think> TAGS.`,
          },
        ],
      });

      const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;

      log.info(`LLM tokens — in: ${inputTokens}, out: ${outputTokens}`);

      const parsed = robustJsonParse<T>(rawText);
      if (parsed && validateRequiredFields(parsed as Record<string, unknown>, requiredFields)) {
        return { data: parsed, usedFallback: false, attempts: attempt, inputTokens, outputTokens };
      }

      if (attempt < maxAttempts) {
        log.warn(`Schema validation failed on attempt ${attempt} (required: ${requiredFields.join(', ')}) — retrying`);
        currentUserMessage = `The previous response could not be parsed or was missing required fields (${requiredFields.join(', ')}).
Repair it into valid JSON without changing the underlying facts.

Original request:
${userMessage}

Previous invalid response:
${rawText.slice(0, 6000)}`;
        await sleep(attempt * 800);
      }
    } catch (error: unknown) {
      const err = error as { status?: number; headers?: Record<string, string> };

      if (err?.status === 429) {
        const retryAfter = parseInt(err?.headers?.['retry-after'] || '15', 10);
        log.warn(`Rate limited by Anthropic — waiting ${retryAfter}s before retry (attempt ${attempt})`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (err?.status === 529) {
        log.warn(`Anthropic API overloaded — waiting 20s (attempt ${attempt})`);
        await sleep(20000);
        continue;
      }

      log.error(`LLM call error on attempt ${attempt}: ${String(error)}`);
      if (attempt < maxAttempts) {
        await sleep(attempt * 1200);
      }
    }
  }

  if (!fallbackAllowed) {
    throw new Error(`Anthropic live response failed validation after ${maxAttempts} attempt(s); fallback is disabled.`);
  }

  log.warn(`All LLM attempts failed — using structured fallback (required: ${requiredFields.join(', ')})`);
  return {
    data: sanitizeFallbackPayload(fallback, fallbackContext),
    usedFallback: true,
    attempts: maxAttempts,
    inputTokens: 0,
    outputTokens: 0,
  };
}
