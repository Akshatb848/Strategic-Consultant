import OpenAI from 'openai';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { robustJsonParse } from './llmClient.js';
import type { EnrichedContext, ValidationResult, ValidationWarning } from '../agents/types.js';

const competitorStopWords = new Set([
  'Should',
  'And',
  'With',
  'Against',
  'Into',
  'India',
  'Global',
  'Market',
  'Board',
]);

function parseCurrencyMagnitude(value: string): number | null {
  const match = value.match(/([\d.]+)\s*(billion|bn|million|mn|crore|cr|lakh|m)?/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = (match[2] || '').toLowerCase();

  if (Number.isNaN(amount)) return null;
  if (unit === 'billion' || unit === 'bn') return amount * 1000;
  if (unit === 'million' || unit === 'mn' || unit === 'm') return amount;
  if (unit === 'crore' || unit === 'cr') return amount * 1.2;
  if (unit === 'lakh') return amount * 0.012;
  return amount;
}

function extractFirstNumber(pattern: RegExp, text: string): number | null {
  const match = text.match(pattern);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectNamedCompetitors(problemStatement: string): string[] {
  const matches = problemStatement.match(/\b([A-Z][A-Za-z0-9&.-]+(?:\s+[A-Z][A-Za-z0-9&.-]+)*)\b/g) || [];
  const unique = Array.from(
    new Set(
      matches
        .map((name) => name.trim())
        .filter((name) => name.length > 2 && !competitorStopWords.has(name))
    )
  );
  return unique.slice(0, 6);
}

function keywordDecisionType(problemStatement: string): string {
  const lower = problemStatement.toLowerCase();
  if (/(acquire|acquisition|buy|purchase|takeover|m&a|merger|take a stake|minority stake)/.test(lower)) {
    return 'ACQUIRE';
  }
  if (/(invest|investment|allocate capital)/.test(lower)) return 'INVEST';
  if (/(restructur|reorganiz|reorganis)/.test(lower)) return 'RESTRUCTURE';
  if (/(enter|expan(d|sion)|new market|greenfield|joint venture)/.test(lower)) return 'ENTER';
  if (/(exit|divest|sell)/.test(lower)) return 'EXIT';
  if (/(defend|protect|counter)/.test(lower)) return 'DEFEND';
  if (/(transform|reinvent|pivot)/.test(lower)) return 'TRANSFORM';
  return '';
}

function heuristicEnrichedContext(problemStatement: string): EnrichedContext {
  const lower = problemStatement.toLowerCase();
  const roiTarget = extractFirstNumber(/(\d+(?:\.\d+)?)\s*x\s+roi/i, problemStatement);
  const marketShareTarget = extractFirstNumber(/(\d+(?:\.\d+)?)\s*%\s*market share/i, problemStatement);
  const timeHorizonMonths =
    extractFirstNumber(/(\d+)\s*months?/i, problemStatement) ??
    (extractFirstNumber(/(\d+)\s*years?/i, problemStatement) !== null
      ? Number(extractFirstNumber(/(\d+)\s*years?/i, problemStatement)) * 12
      : null);
  const valuationRange =
    problemStatement.match(/\$([\d.]+\s*(?:m|mn|million|bn|billion))\s*[-–]\s*\$?([\d.]+\s*(?:m|mn|million|bn|billion))/i) ||
    problemStatement.match(/\$([\d.]+\s*(?:m|mn|million|bn|billion))/i);

  const acquisitionMin = valuationRange?.[1] ? parseCurrencyMagnitude(valuationRange[1]) : null;
  const acquisitionMax = valuationRange?.[2]
    ? parseCurrencyMagnitude(valuationRange[2])
    : acquisitionMin;

  const organisationMatch =
    problemStatement.match(/(?:should|would|can|could)\s+([A-Z][A-Za-z0-9&.-]+(?:\s+[A-Z][A-Za-z0-9&.-]+)*)/i) ||
    problemStatement.match(/for\s+([A-Z][A-Za-z0-9&.-]+(?:\s+[A-Z][A-Za-z0-9&.-]+)*)/i);

  const geographies = [
    'India',
    'South Asia',
    'Middle East',
    'Europe',
    'United States',
    'United Kingdom',
    'Singapore',
    'Australia',
    'Global',
  ];
  const geography = geographies.find((candidate) => lower.includes(candidate.toLowerCase())) || '';

  const industries = [
    'Professional Services',
    'Banking',
    'Financial Services',
    'Healthcare',
    'Technology',
    'Consulting',
    'Cybersecurity',
    'Insurance',
  ];
  const industry = industries.find((candidate) => lower.includes(candidate.toLowerCase())) || '';

  return {
    organisation: organisationMatch?.[1]?.trim() || '',
    industry,
    geography,
    decision_type: keywordDecisionType(problemStatement),
    time_horizon_months: timeHorizonMonths,
    roi_target_numeric: roiTarget,
    roi_horizon_months:
      lower.includes('by 202') || lower.includes('over')
        ? timeHorizonMonths
        : null,
    market_share_target_pct: marketShareTarget,
    named_competitors: detectNamedCompetitors(problemStatement),
    acquisition_valuation_min: acquisitionMin,
    acquisition_valuation_max: acquisitionMax,
  };
}

async function llmEnrichedContext(problemStatement: string): Promise<EnrichedContext | null> {
  if (!env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured; problem validation requires live Groq output.');
  }

  try {
    const client = new OpenAI({
      apiKey: env.GROQ_API_KEY,
      baseURL: env.GROQ_BASE_URL,
    });

    const response = await client.chat.completions.create({
      model: env.LLM_MODEL_CONTEXT_EXTRACTOR,
      max_tokens: 250,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: `Extract only the structured fields below from this strategic problem statement.
Return valid JSON only:
{
  "organisation": "",
  "industry": "",
  "geography": "",
  "decision_type": "",
  "time_horizon_months": null,
  "roi_target_numeric": null,
  "roi_horizon_months": null,
  "market_share_target_pct": null,
  "named_competitors": [],
  "acquisition_valuation_min": null,
  "acquisition_valuation_max": null
}

Problem statement: "${problemStatement}"`,
        },
      ],
    });

    const parsed = robustJsonParse<Partial<EnrichedContext>>(
      response.choices?.[0]?.message?.content || ''
    );

    if (!parsed) {
      throw new Error('Problem validation LLM returned invalid JSON.');
    }

    return {
      organisation: parsed.organisation || '',
      industry: parsed.industry || '',
      geography: parsed.geography || '',
      decision_type: parsed.decision_type || '',
      time_horizon_months:
        typeof parsed.time_horizon_months === 'number' ? parsed.time_horizon_months : null,
      roi_target_numeric:
        typeof parsed.roi_target_numeric === 'number' ? parsed.roi_target_numeric : null,
      roi_horizon_months:
        typeof parsed.roi_horizon_months === 'number' ? parsed.roi_horizon_months : null,
      market_share_target_pct:
        typeof parsed.market_share_target_pct === 'number' ? parsed.market_share_target_pct : null,
      named_competitors: Array.isArray(parsed.named_competitors)
        ? parsed.named_competitors.map(String).slice(0, 6)
        : [],
      acquisition_valuation_min:
        typeof parsed.acquisition_valuation_min === 'number'
          ? parsed.acquisition_valuation_min
          : null,
      acquisition_valuation_max:
        typeof parsed.acquisition_valuation_max === 'number'
          ? parsed.acquisition_valuation_max
          : null,
    };
  } catch (error: any) {
    logger.error({ error: error.message }, 'Problem validation LLM context extraction failed');
    throw new Error('Live Groq problem validation failed.');
  }
}

function buildWarnings(problemStatement: string, enrichedContext: EnrichedContext): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const lower = problemStatement.toLowerCase();

  if (
    enrichedContext.market_share_target_pct !== null &&
    enrichedContext.market_share_target_pct > 15 &&
    enrichedContext.time_horizon_months !== null &&
    enrichedContext.time_horizon_months < 24
  ) {
    warnings.push({
      type: 'TIMELINE_AMBITION_MISMATCH',
      severity: 'MAJOR',
      message:
        'A market share target above 15% inside 24 months is historically aggressive for professional-services capability builds and post-merger integrations.',
      suggestion:
        'Extend the timeline to 36-48 months or reduce the share target to a more realistic 8-12% first-wave objective.',
      displayToUser: true,
    });
  }

  if (enrichedContext.roi_target_numeric !== null && enrichedContext.roi_horizon_months === null) {
    warnings.push({
      type: 'UNDEFINED_ROI_HORIZON',
      severity: 'BLOCKING',
      message: `ROI target of ${enrichedContext.roi_target_numeric}x has no defined time horizon. A 3x return over 3 years is a very different thesis from 3x over 10 years.`,
      suggestion: "Specify the ROI horizon explicitly, for example 'by 2028' or 'over 5 years'.",
      displayToUser: true,
    });
  }

  const hasComplianceSignal = /(dpdp|gdpr|compliance|regulator|privacy|governance)/.test(lower);
  const hasCompetitiveSignal = /(market share|competitor|compete|defend|pre-empt|preempt|counter)/.test(lower);
  if (hasComplianceSignal && hasCompetitiveSignal) {
    warnings.push({
      type: 'CONFLATED_OBJECTIVES',
      severity: 'MINOR',
      message:
        'The prompt combines regulatory-compliance delivery with competitive-positioning objectives, which may require different targets, economics, and integration models.',
      suggestion:
        'Consider splitting the analysis into separate compliance-capability and market-positioning questions if the board needs a cleaner decision.',
      displayToUser: true,
    });
  }

  if (
    enrichedContext.acquisition_valuation_max !== null &&
    enrichedContext.roi_target_numeric !== null &&
    enrichedContext.roi_horizon_months !== null
  ) {
    const requiredRevenue =
      enrichedContext.acquisition_valuation_max * enrichedContext.roi_target_numeric;
    const assumedAddressableMarket =
      enrichedContext.decision_type === 'ACQUIRE' ? 300 : 180;
    const shareOfMarket = (requiredRevenue / assumedAddressableMarket) * 100;

    if (shareOfMarket > 20) {
      warnings.push({
        type: 'ACQUISITION_VALUATION_SANITY',
        severity: 'MAJOR',
        message: `The stated ROI ambition implies approximately $${requiredRevenue.toFixed(
          1
        )}M of attributable value creation, which is ${shareOfMarket.toFixed(
          0
        )}% of a typical addressable market for this type of advisory capability play.`,
        suggestion:
          'Pressure-test the valuation, the attributable revenue base, and the risk-adjusted payback case before presenting the acquisition as board-ready.',
        displayToUser: true,
      });
    }
  }

  if (!enrichedContext.organisation || !enrichedContext.industry || !enrichedContext.geography) {
    warnings.push({
      type: 'UNSPECIFIED_BASELINE',
      severity: 'MINOR',
      message:
        'Some baseline context is missing. Analyses without a named organisation, industry, and geography tend to produce weaker confidence and less comparable outputs.',
      suggestion:
        'Add the organisation, sector, and geography explicitly to improve benchmarking and risk calibration.',
      displayToUser: true,
    });
  }

  if (
    enrichedContext.roi_target_numeric !== null &&
    enrichedContext.market_share_target_pct !== null &&
    enrichedContext.decision_type === 'ACQUIRE'
  ) {
    warnings.push({
      type: 'OVERSPECIFIED_TARGET',
      severity: 'MINOR',
      message:
        'The prompt specifies an acquisition path and the target economics simultaneously, which can bias the analysis toward proving a pre-selected answer.',
      suggestion:
        'Allow the pipeline to test the acquisition thesis against partnership and organic-build alternatives before locking the board recommendation.',
      displayToUser: true,
    });
  }

  return warnings;
}

export async function validateProblemStatement(problemStatement: string): Promise<ValidationResult> {
  const heuristic = heuristicEnrichedContext(problemStatement);
  const llm = await llmEnrichedContext(problemStatement);
  const enrichedContext = {
    ...heuristic,
    ...llm,
    named_competitors: (llm?.named_competitors?.length ? llm.named_competitors : heuristic.named_competitors).slice(0, 6),
  };

  const warnings = buildWarnings(problemStatement, enrichedContext);
  return {
    isValid: !warnings.some((warning) => warning.severity === 'BLOCKING'),
    warnings,
    enrichedContext,
  };
}
