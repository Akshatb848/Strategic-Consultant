import Anthropic from '@anthropic-ai/sdk';
import { log } from './logger';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// ── Max tokens — raised to 4096 so CoVe + Synthesis never truncate ────────────
const MAX_TOKENS = parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096');

// ── 4-strategy JSON extraction ────────────────────────────────────────────────
export function robustJsonParse<T>(raw: string): T | null {
  if (!raw?.trim()) return null;

  // Strip <think>...</think> tags emitted by extended-thinking models
  const stripped = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Strategy 1: direct parse
  try { return JSON.parse(stripped) as T; } catch (_) {}

  // Strategy 2: extract from ```json ... ``` block
  const block = stripped.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (block) { try { return JSON.parse(block[1].trim()) as T; } catch (_) {} }

  // Strategy 3: first { to last }
  const fi = stripped.indexOf('{');
  const li = stripped.lastIndexOf('}');
  if (fi !== -1 && li > fi) { try { return JSON.parse(stripped.slice(fi, li + 1)) as T; } catch (_) {} }

  // Strategy 4: aggressive cleanup (trailing commas, unquoted keys, single-quoted values)
  const cleaned = stripped
    .replace(/```json?/g, '').replace(/```/g, '')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
    .replace(/:\s*'([^']*)'/g, ': "$1"')
    .trim();
  const fi2 = cleaned.indexOf('{');
  const li2 = cleaned.lastIndexOf('}');
  if (fi2 !== -1 && li2 > fi2) { try { return JSON.parse(cleaned.slice(fi2, li2 + 1)) as T; } catch (_) {} }

  return null;
}

export function validateRequiredFields(data: Record<string, unknown>, required: string[]): boolean {
  return required.every(field => data[field] !== undefined && data[field] !== null && data[field] !== '');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Main LLM call with retry + 429 backoff + fallback ────────────────────────
export async function callLLMWithRetry<T extends Record<string, unknown>>(
  systemPrompt: string,
  userMessage: string,
  requiredFields: string[],
  fallback: T,
  maxAttempts: number = 3
): Promise<{ data: T; usedFallback: boolean; attempts: number; inputTokens: number; outputTokens: number }> {

  // Fast-exit if no API key configured
  if (!process.env.ANTHROPIC_API_KEY) {
    log.warn('No ANTHROPIC_API_KEY — using structured fallback');
    return { data: fallback, usedFallback: true, attempts: 0, inputTokens: 0, outputTokens: 0 };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log.info(`LLM call starting — attempt ${attempt}/${maxAttempts}`);

      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `${userMessage}\n\nRETURN ONLY VALID JSON. NO TEXT BEFORE OR AFTER. NO MARKDOWN FENCES. NO <think> TAGS.`,
        }],
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
        await sleep(attempt * 800);
      }
    } catch (err: any) {
      // Handle 429 rate limiting with Retry-After header
      if (err?.status === 429) {
        const retryAfter = parseInt(err?.headers?.['retry-after'] || '15', 10);
        log.warn(`Rate limited by Anthropic — waiting ${retryAfter}s before retry (attempt ${attempt})`);
        await sleep(retryAfter * 1000);
        continue;
      }

      // Handle overloaded errors (529)
      if (err?.status === 529) {
        log.warn(`Anthropic API overloaded — waiting 20s (attempt ${attempt})`);
        await sleep(20000);
        continue;
      }

      log.error(`LLM call error on attempt ${attempt}: ${String(err)}`);
      if (attempt < maxAttempts) await sleep(attempt * 1200);
    }
  }

  log.warn(`All LLM attempts failed — using structured fallback (required: ${requiredFields.join(', ')})`);
  return { data: fallback, usedFallback: true, attempts: maxAttempts, inputTokens: 0, outputTokens: 0 };
}
