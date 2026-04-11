import Anthropic from '@anthropic-ai/sdk';
import { log } from './logger';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

export function robustJsonParse<T>(raw: string): T | null {
  if (!raw?.trim()) return null;
  try { return JSON.parse(raw.trim()) as T; } catch (_) {}
  const block = raw.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (block) { try { return JSON.parse(block[1].trim()) as T; } catch (_) {} }
  const fi = raw.indexOf('{'), li = raw.lastIndexOf('}');
  if (fi !== -1 && li > fi) { try { return JSON.parse(raw.slice(fi, li + 1)) as T; } catch (_) {} }
  const cleaned = raw
    .replace(/```json?/g, '').replace(/```/g, '')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
    .replace(/:\s*'([^']*)'/g, ': "$1"')
    .trim();
  const fi2 = cleaned.indexOf('{'), li2 = cleaned.lastIndexOf('}');
  if (fi2 !== -1 && li2 > fi2) { try { return JSON.parse(cleaned.slice(fi2, li2 + 1)) as T; } catch (_) {} }
  return null;
}

export function validateRequiredFields(data: Record<string, unknown>, required: string[]): boolean {
  return required.every(field => data[field] !== undefined && data[field] !== null && data[field] !== '');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function callLLMWithRetry<T extends Record<string, unknown>>(
  systemPrompt: string,
  userMessage: string,
  requiredFields: string[],
  fallback: T,
  maxAttempts: number = 3
): Promise<{ data: T; usedFallback: boolean; attempts: number; inputTokens: number; outputTokens: number }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '2048'),
        system: systemPrompt,
        messages: [{ role: 'user', content: `${userMessage}\n\nRETURN ONLY VALID JSON. NO TEXT BEFORE OR AFTER. NO MARKDOWN.` }],
      });
      const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const parsed = robustJsonParse<T>(rawText);
      if (parsed && validateRequiredFields(parsed, requiredFields)) {
        return { data: parsed, usedFallback: false, attempts: attempt, inputTokens, outputTokens };
      }
      if (attempt < maxAttempts) {
        log.warn(`Agent schema validation failed on attempt ${attempt}, retrying...`);
        await sleep(attempt * 800);
      }
    } catch (err) {
      log.error(`LLM call error on attempt ${attempt}:`, { error: String(err) });
      if (attempt < maxAttempts) await sleep(attempt * 1000);
    }
  }
  log.warn('All LLM attempts failed, using structured fallback');
  return { data: fallback, usedFallback: true, attempts: maxAttempts, inputTokens: 0, outputTokens: 0 };
}
