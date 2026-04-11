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
  // If no API key, try basic keyword extraction
  if (!env.GROQ_API_KEY) {
    logger.warn('No API key — using keyword-based context extraction');
    return extractContextFromKeywords(problemStatement);
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
  }

  // Fallback to keyword extraction
  return extractContextFromKeywords(problemStatement);
}

// ── Keyword-based fallback extraction ────────────────────────────────────────
function extractContextFromKeywords(text: string): ExtractedContext {
  const lower = text.toLowerCase();

  // Geography detection
  const geoPatterns: Record<string, string> = {
    india: 'India', 'united states': 'United States', 'united kingdom': 'United Kingdom',
    europe: 'Europe', china: 'China', japan: 'Japan', singapore: 'Singapore',
    australia: 'Australia', canada: 'Canada', germany: 'Germany', france: 'France',
    'south asia': 'South Asia', 'southeast asia': 'Southeast Asia',
    'middle east': 'Middle East', africa: 'Africa', 'latin america': 'Latin America',
    global: 'Global',
  };

  // Industry detection
  const industryPatterns: Record<string, string> = {
    'financial services': 'Financial Services', banking: 'Banking', insurance: 'Insurance',
    healthcare: 'Healthcare', pharma: 'Pharmaceuticals', technology: 'Technology',
    'professional services': 'Professional Services', consulting: 'Consulting',
    manufacturing: 'Manufacturing', retail: 'Retail', 'e-commerce': 'E-commerce',
    telecom: 'Telecommunications', energy: 'Energy', 'real estate': 'Real Estate',
    automotive: 'Automotive', education: 'Education', media: 'Media',
    logistics: 'Logistics', agriculture: 'Agriculture', defense: 'Defence',
  };

  // Decision type detection
  const decisionPatterns: Record<string, string> = {
    invest: 'INVEST', 'should we invest': 'INVEST', 'capital allocation': 'INVEST',
    divest: 'DIVEST', sell: 'DIVEST', exit: 'EXIT', 'leave the market': 'EXIT',
    'enter the market': 'ENTER', expand: 'ENTER', 'new market': 'ENTER',
    restructure: 'RESTRUCTURE', reorganise: 'RESTRUCTURE', reorganize: 'RESTRUCTURE',
    acquire: 'ACQUIRE', merger: 'ACQUIRE', 'merge with': 'ACQUIRE',
    transform: 'TRANSFORM', 'digital transformation': 'TRANSFORM',
    defend: 'DEFEND', protect: 'DEFEND',
  };

  let geography = '';
  for (const [pattern, value] of Object.entries(geoPatterns)) {
    if (lower.includes(pattern)) { geography = value; break; }
  }

  let industry = '';
  for (const [pattern, value] of Object.entries(industryPatterns)) {
    if (lower.includes(pattern)) { industry = value; break; }
  }

  let decisionType = '';
  for (const [pattern, value] of Object.entries(decisionPatterns)) {
    if (lower.includes(pattern)) { decisionType = value; break; }
  }

  // Try to extract org name (capitalised words before common verbs)
  const orgMatch = text.match(/(?:for|at|of)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/);
  const organisation = orgMatch ? orgMatch[1] : '';

  return {
    organisationContext: organisation,
    industryContext: industry,
    geographyContext: geography,
    decisionType: decisionType,
  };
}
