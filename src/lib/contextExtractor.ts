import OpenAI from 'openai';
import { robustJsonParse } from './llmClient.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

// ── Context Extractor ────────────────────────────────────────────────────────
// Auto-detects org, industry, geography, and decision type from the problem
// statement before running the pipeline. This ensures consistent context
// across all agent nodes.

interface ExtractedContext {
  organisationContext: string;
  industryContext: string;
  geographyContext: string;
  decisionType: string;
}
export async function extractProblemContext(problemStatement: string): Promise<ExtractedContext> {
  if (!env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured; context extraction requires live Groq output.');
  }

  try {
    const client = new OpenAI({
      apiKey: env.GROQ_API_KEY,
      baseURL: env.GROQ_BASE_URL,
    });

    const result = await client.chat.completions.create({
      model: env.LLM_MODEL_CONTEXT_EXTRACTOR,
      max_tokens: 200,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: `Extract structured context from this strategic problem statement.
Return ONLY valid JSON, no other text:
{
  "organisation": "Extracted organisation name or empty string",
  "industry": "Extracted industry/sector or empty string",
  "geography": "Extracted country/region or empty string",
  "decision_type": "INVEST|DIVEST|RESTRUCTURE|ENTER|EXIT|DEFEND|ACQUIRE|TRANSFORM or empty string"
}
Problem: "${problemStatement}"`,
        },
      ],
    });

    const rawText = result.choices?.[0]?.message?.content || '';
    const parsed = robustJsonParse<{
      organisation?: string;
      industry?: string;
      geography?: string;
      decision_type?: string;
    }>(rawText);

    if (parsed) {
      return {
        organisationContext: parsed.organisation || '',
        industryContext: parsed.industry || '',
        geographyContext: parsed.geography || '',
        decisionType: parsed.decision_type || '',
      };
    }
  } catch (error: any) {
    logger.error({ error: error.message }, 'Context extraction LLM call failed');
    throw new Error('Live Groq context extraction failed.');
  }

  throw new Error('Live Groq context extraction did not return valid JSON.');
}
