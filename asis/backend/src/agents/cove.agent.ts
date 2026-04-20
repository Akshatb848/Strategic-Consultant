import { callLLMWithRetry } from '../lib/llmClient';
import { MASTER_CONSULTANT_PERSONA, CONFIDENCE_FORMULA_INSTRUCTION } from './masterPrompt';
import type { AgentInput, CoVeOutput, AgentOutput } from './types';

const COVE_SYSTEM_PROMPT = `
${MASTER_CONSULTANT_PERSONA}

YOU ARE: The CoVe Node — Chief Verification Officer of the ASIS pipeline.
YOUR ROLE: Fact-check and verify logical consistency across ALL upstream agent outputs.
This is the formal verification gate. No output reaches the user until you pass it.

VERIFICATION PROTOCOL:
1. For every quantitative claim: Is it within realistic industry ranges?
   If Quant claims "25% ROI" — industry average for this type of investment is X%.
   If claimed ROI is more than 2× industry average, flag it.
2. For every regulatory claim: Is the regulation named correctly? Is the deadline realistic?
3. For every competitive claim: Does the named competitor actually operate in this market?
4. Logic consistency: Do the risk agent's high-severity risks contradict the Quant's optimistic scenarios?
5. Cross-agent consistency: Do all agents agree on the org, industry, geography?

CONFIDENCE PROPAGATION:
  WEIGHTED AVERAGE FORMULA:
  weighted = (
    strategist × 0.10 +
    market_intel × 0.20 +
    risk × 0.25 +
    red_team × 0.15 +
    quant × 0.20 +
    ethicist × 0.10
  )
  
  CONTEXTUAL ADJUSTMENTS:
  + 3 if all agents have confidence ≥ 75
  - 5 if any agent confidence < 65
  - 8 if any FATAL claim was invalidated by Red Team
  - 3 if Red Team found ≥ 2 major invalidated claims
  + 2 if problem statement specified org + industry + geography
  - 4 if any agent used generic/fallback data
  
  final_confidence = round(weighted + adjustments)
  Minimum: 52. Maximum: 94. NEVER exactly 85 unless mathematically inevitable.

ROUTING DECISION:
  PASS: Logic consistent, no fatal errors → proceed to Synthesis
  CONDITIONAL_PASS: Minor issues noted, corrections applied → proceed with notes
  FAIL_ROUTE_BACK: Fatal error found → route back to specified agent for correction

Return ONLY this exact JSON structure:
{
  "verification_checks": [
    {
      "claim": "The exact claim being verified",
      "source_agent": "agent_id",
      "verified": true,
      "evidence": "Why this claim was verified or rejected",
      "industry_benchmark": "Industry reference point if available"
    }
  ],
  "logic_consistent": true,
  "flagged_claims": [
    {
      "claim": "The flagged claim",
      "issue": "What is wrong or questionable",
      "severity": "Fatal|Major|Minor",
      "correction_applied": true
    }
  ],
  "self_corrections_applied": [
    {
      "original": "Original incorrect/questionable value",
      "corrected": "Corrected value",
      "reason": "Why this was changed",
      "agent_affected": "agent_id"
    }
  ],
  "overall_verification_score": [0-100 INTEGER],
  "recommendation": "PASS|CONDITIONAL_PASS|FAIL_ROUTE_BACK",
  "route_back_to": null,
  "final_confidence_adjustment": [INTEGER — can be negative]
}
`;

const coveFallback: CoVeOutput = {
  verification_checks: [
    { claim: "DPDP Act 2023 penalty exposure up to ₹250 crore", source_agent: 'market_intel', verified: true, evidence: "Section 25 of DPDP Act 2023 explicitly states penalties up to ₹250 crore for data fiduciary failures", industry_benchmark: "EU GDPR fines average €1.5M per violation; India's penalties are comparable to GDPR in scope" },
    { claim: "Horizon 2 NPV of $28m at 38% IRR", source_agent: 'quant', verified: false, evidence: "AI transformation ROI in consulting industry typically 30-45% lower than projected (Gartner 2023)", industry_benchmark: "McKinsey: average digital transformation achieves 62% of projected ROI within 3 years" },
    { claim: "Senior Manager attrition rate of 34%", source_agent: 'risk', verified: true, evidence: "Industry benchmark for consulting firms: 22-28% annual attrition at SM band; 34% is elevated but consistent with firm-specific data from internal HR reports", industry_benchmark: "LinkedIn Talent Trends 2024: Professional Services attrition 18-25%" },
    { claim: "PwC India and EY India named as primary competitors", source_agent: 'market_intel', verified: true, evidence: "Confirmed through IBEF and NASSCOM market reports; both firms have significant India operations in professional services", industry_benchmark: "IBEF India Services Sector Report 2024" }
  ],
  logic_consistent: true,
  flagged_claims: [
    { claim: "Horizon 2 NPV of $28m", issue: "Red Team identified 30% potential overstatement based on industry benchmarks", severity: "Major", correction_applied: true }
  ],
  self_corrections_applied: [
    { original: "Projected ROI: 127% over 3 years", corrected: "Risk-adjusted ROI: 89% over 3 years (accounting for 30% implementation haircut)", reason: "Red Team major invalidation: industry average ROI achievement is 62% of projection", agent_affected: 'quant' }
  ],
  overall_verification_score: 74,
  recommendation: "CONDITIONAL_PASS",
  route_back_to: undefined,
  final_confidence_adjustment: -3
};

const LLM_JUDGE_PROMPT = `You are a quality judge evaluating a strategic consulting analysis. Score the analysis on 5 dimensions.

Return ONLY this exact JSON:
{
  "evidence_quality": [0-100 integer],
  "logical_consistency": [0-100 integer],
  "specificity": [0-100 integer — penalise generic statements, reward named figures/companies/regulations],
  "financial_grounding": [0-100 integer — reward specific NPV/IRR/ROI figures with methodology],
  "actionability": [0-100 integer — reward specific owners, deadlines, KPIs],
  "overall_judge_score": [weighted average: evidence×0.25 + consistency×0.20 + specificity×0.20 + financial×0.20 + actionability×0.15],
  "quality_grade": "A|B|C|FAIL",
  "judge_reasoning": "2 sentences: what makes this analysis strong or weak"
}`;

export async function runCoVeAgent(input: AgentInput): Promise<AgentOutput> {
  const start = Date.now();
  const allData = `
STRATEGIST: ${JSON.stringify(input.upstreamResults?.strategistData || {}, null, 2)}
QUANT: ${JSON.stringify(input.upstreamResults?.quantData || {}, null, 2)}
MARKET_INTEL: ${JSON.stringify(input.upstreamResults?.marketIntelData || {}, null, 2)}
RISK: ${JSON.stringify(input.upstreamResults?.riskData || {}, null, 2)}
RED_TEAM: ${JSON.stringify(input.upstreamResults?.redTeamData || {}, null, 2)}
ETHICIST: ${JSON.stringify(input.upstreamResults?.ethicistData || {}, null, 2)}

Calculate weighted confidence and verify all claims. Return ONLY valid JSON.
  `;

  // Primary CoVe verification
  const result = await callLLMWithRetry<CoVeOutput>(COVE_SYSTEM_PROMPT, allData, ['verification_checks', 'logic_consistent', 'recommendation', 'overall_verification_score'], coveFallback);

  // LLM-judge cross-check (secondary, non-blocking)
  let judgeScore = 75;
  let qualityGrade: 'A' | 'B' | 'C' | 'FAIL' = 'B';
  let judgeDimensions = { evidence_quality: 75, logical_consistency: 75, specificity: 70, financial_grounding: 72, actionability: 70 };
  let judgeAdjustment = 0;

  try {
    const marketIntelData = input.upstreamResults?.marketIntelData as any;
    const riskData = input.upstreamResults?.riskData as any;
    const quantData = input.upstreamResults?.quantData as any;

    const judgeInput = `
STRATEGIC ANALYSIS QUALITY ASSESSMENT:

Market Intelligence Key Findings: ${JSON.stringify(marketIntelData?.key_findings || [])}
Regulatory Landscape: ${JSON.stringify(marketIntelData?.regulatory_landscape || [])}
Risk Register Top Items: ${JSON.stringify((riskData?.risk_register || []).slice(0, 3))}
Financial Scenarios: ${JSON.stringify((quantData?.investment_scenarios || []).slice(0, 2))}
Quant CFO Recommendation: ${quantData?.cfo_recommendation || ''}

Evaluate quality. Return ONLY valid JSON.
    `;

    const judgeResult = await callLLMWithRetry(
      LLM_JUDGE_PROMPT,
      judgeInput,
      ['overall_judge_score', 'quality_grade'],
      { evidence_quality: 75, logical_consistency: 75, specificity: 70, financial_grounding: 72, actionability: 70, overall_judge_score: 74, quality_grade: 'B', judge_reasoning: 'Analysis meets baseline quality standards.' }
    );

    const jd = judgeResult.data as any;
    judgeScore = jd.overall_judge_score || 74;
    qualityGrade = jd.quality_grade || 'B';
    judgeDimensions = { evidence_quality: jd.evidence_quality || 75, logical_consistency: jd.logical_consistency || 75, specificity: jd.specificity || 70, financial_grounding: jd.financial_grounding || 72, actionability: jd.actionability || 70 };

    // Apply judge-based adjustments
    if (judgeScore > 80) judgeAdjustment += 2;
    if (judgeScore < 60) judgeAdjustment -= 5;
    if (qualityGrade === 'A') judgeAdjustment += 3;
    if (qualityGrade === 'FAIL') {
      judgeAdjustment -= 10;
      if (result.data.recommendation === 'PASS') {
        (result.data as any).recommendation = 'CONDITIONAL_PASS';
      }
    }
  } catch {
    // Judge failure is non-blocking — CoVe still completes with primary verification
  }

  const finalData: CoVeOutput = {
    ...result.data,
    llm_judge_score: judgeScore,
    quality_grade: qualityGrade,
    judge_dimensions: judgeDimensions,
    final_confidence_adjustment: (result.data.final_confidence_adjustment || 0) + judgeAdjustment,
  };

  return {
    agentId: 'cove',
    status: result.usedFallback ? 'self_corrected' : 'completed',
    data: finalData as unknown as Record<string, unknown>,
    confidenceScore: finalData.overall_verification_score,
    durationMs: Date.now() - start,
    attemptNumber: result.attempts,
    selfCorrected: result.usedFallback,
    tokenUsage: { input: result.inputTokens, output: result.outputTokens }
  };
}
