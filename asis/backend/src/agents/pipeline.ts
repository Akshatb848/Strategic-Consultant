import { Prisma } from '@prisma/client';

import { prisma } from '../lib/database';
import { log } from '../lib/logger';
import { emitPipelineEvent, emitAnalysisComplete } from '../lib/socketio';
import { runStrategistAgent } from './strategist.agent';
import { runQuantAgent } from './quant.agent';
import { runMarketIntelAgent } from './marketIntel.agent';
import { runRiskAgent } from './risk.agent';
import { runRedTeamAgent } from './redteam.agent';
import { runEthicistAgent } from './ethicist.agent';
import { runCoVeAgent } from './cove.agent';
import { runSynthesisAgent } from './synthesis.agent';
import type { PipelineState, AgentId, AgentOutput } from './types';

const MAX_SELF_CORRECTIONS = 2;

const fieldMap: Record<string, string> = {
  strategist: 'strategistData',
  quant: 'quantData',
  market_intel: 'marketIntelData',
  risk: 'riskData',
  red_team: 'redTeamData',
  ethicist: 'ethicistData',
  cove: 'coveVerificationData',
  synthesis: 'synthesisData',
};

// Maps backend agent IDs to frontend-facing display names
const agentDisplayNames: Record<string, string> = {
  strategist: 'Orchestrator',
  quant: 'Financial Reasoning',
  market_intel: 'Market Intelligence',
  risk: 'Risk Assessment',
  red_team: 'Competitor Analysis',
  ethicist: 'Strategic Options',
  cove: 'CoVe Verification',
  synthesis: 'Synthesis',
};

async function getPastAnalysisContext(analysisId: string, organisationId: string | null): Promise<string> {
  if (!organisationId) return '';
  try {
    const past = await prisma.analysis.findMany({
      where: { organisationId, status: 'completed', id: { not: analysisId } },
      orderBy: { completedAt: 'desc' },
      take: 3,
      select: { problemStatement: true, decisionRecommendation: true, overallConfidence: true, executiveSummary: true },
    });
    if (!past.length) return '';
    const lines = past.map((p, i) =>
      `Past Analysis ${i + 1}: "${p.problemStatement}" → ${p.decisionRecommendation || 'HOLD'} (confidence: ${p.overallConfidence || 0}%)\nSummary: ${(p.executiveSummary || '').slice(0, 200)}`
    );
    return `ORGANIZATIONAL MEMORY (from ${past.length} past analyses):\n${lines.join('\n\n')}\n`;
  } catch {
    return '';
  }
}

async function saveAgentResult(analysisId: string, agentId: string, result: AgentOutput): Promise<void> {
  const confidenceField = result.data?.confidence_score ?? result.data?.overall_verification_score ?? result.confidenceScore ?? null;
  const updateData: Record<string, unknown> = {
    [fieldMap[agentId]]: result.data,
    agentsCompleted: { increment: 1 },
    currentAgent: agentId,
  };
  if (agentId === 'synthesis' && result.data?.overall_confidence) {
    updateData.overallConfidence = result.data.overall_confidence;
    updateData.decisionRecommendation = result.data.decision_recommendation;
    updateData.executiveSummary = result.data.executive_summary;
    updateData.boardNarrative = result.data.board_narrative;
  }
  await prisma.analysis.update({ where: { id: analysisId }, data: updateData as any });
  await prisma.agentLog.create({
    data: {
      analysisId,
      agentId,
      agentName: agentDisplayNames[agentId] || agentId.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      status: result.status,
      attemptNumber: result.attemptNumber,
      confidenceScore: typeof confidenceField === 'number' ? confidenceField : null,
      selfCorrected: result.selfCorrected,
      correctionReason: result.correctionReason || null,
      inputTokens: result.tokenUsage.input,
      outputTokens: result.tokenUsage.output,
      durationMs: result.durationMs,
      parsedOutput: result.data as Prisma.InputJsonValue,
    }
  });
}

export async function runPipeline(analysisId: string): Promise<void> {
  const startTime = Date.now();
  const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } });
  if (!analysis) { log.error('Pipeline: analysis not found', { analysisId }); return; }

  const state: PipelineState = {
    analysisId,
    problemStatement: analysis.problemStatement,
    organisationContext: analysis.organisationContext,
    industryContext: analysis.industryContext,
    geographyContext: analysis.geographyContext,
    decisionType: analysis.decisionType,
    status: 'running',
    currentAgent: null,
    strategistData: null,
    quantData: null,
    marketIntelData: null,
    riskData: null,
    redTeamData: null,
    ethicistData: null,
    synthesisData: null,
    coveData: null,
    agentConfidences: {} as Record<AgentId, number>,
    selfCorrectionCount: 0,
    logicConsistencyPassed: null,
    overallConfidence: null,
    startedAt: new Date(),
    completedAt: null,
  };

  try {
    await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'running' } });

    // Load organizational memory context from past analyses
    const semanticMemoryContext = await getPastAnalysisContext(analysisId, analysis.organisationId);

    // ── Strategist ──────────────────────────────────────────────────────────
    log.info(`[PIPELINE] Running strategist for ${analysisId}`);
    emitPipelineEvent(analysisId, { agent: 'strategist', status: 'running' });
    await prisma.analysis.update({ where: { id: analysisId }, data: { currentAgent: 'strategist' } });
    const strategistResult = await runStrategistAgent({
      analysisId, problemStatement: state.problemStatement,
      organisationContext: state.organisationContext, industryContext: state.industryContext,
      geographyContext: state.geographyContext, decisionType: state.decisionType,
      upstreamResults: {}, semanticMemoryContext,
    });
    state.strategistData = strategistResult.data as any;
    state.agentConfidences.strategist = strategistResult.confidenceScore;
    await saveAgentResult(analysisId, 'strategist', strategistResult);
    emitPipelineEvent(analysisId, { agent: 'strategist', status: 'completed', confidence: strategistResult.confidenceScore });

    // ── Parallel: Quant + Market Intel ──────────────────────────────────────
    log.info(`[PIPELINE] Running quant + market_intel (parallel) for ${analysisId}`);
    emitPipelineEvent(analysisId, { agent: 'quant', status: 'running' });
    emitPipelineEvent(analysisId, { agent: 'market_intel', status: 'running' });
    await prisma.analysis.update({ where: { id: analysisId }, data: { currentAgent: 'quant' } });

    const [quantResult, marketIntelResult] = await Promise.all([
      runQuantAgent({ analysisId, problemStatement: state.problemStatement, organisationContext: state.organisationContext, industryContext: state.industryContext, geographyContext: state.geographyContext, decisionType: state.decisionType, upstreamResults: { strategistData: state.strategistData } }),
      runMarketIntelAgent({ analysisId, problemStatement: state.problemStatement, organisationContext: state.organisationContext, industryContext: state.industryContext, geographyContext: state.geographyContext, decisionType: state.decisionType, upstreamResults: { strategistData: state.strategistData } }),
    ]);

    state.quantData = quantResult.data as any;
    state.marketIntelData = marketIntelResult.data as any;
    state.agentConfidences.quant = quantResult.confidenceScore;
    state.agentConfidences.market_intel = marketIntelResult.confidenceScore;
    await Promise.all([saveAgentResult(analysisId, 'quant', quantResult), saveAgentResult(analysisId, 'market_intel', marketIntelResult)]);
    emitPipelineEvent(analysisId, { agent: 'quant', status: 'completed', confidence: quantResult.confidenceScore });
    emitPipelineEvent(analysisId, { agent: 'market_intel', status: 'completed', confidence: marketIntelResult.confidenceScore });

    // ── Risk ────────────────────────────────────────────────────────────────
    log.info(`[PIPELINE] Running risk for ${analysisId}`);
    emitPipelineEvent(analysisId, { agent: 'risk', status: 'running' });
    await prisma.analysis.update({ where: { id: analysisId }, data: { currentAgent: 'risk' } });
    const riskResult = await runRiskAgent({
      analysisId, problemStatement: state.problemStatement, organisationContext: state.organisationContext,
      industryContext: state.industryContext, geographyContext: state.geographyContext, decisionType: state.decisionType,
      upstreamResults: { strategistData: state.strategistData, marketIntelData: state.marketIntelData },
    });
    state.riskData = riskResult.data as any;
    state.agentConfidences.risk = riskResult.confidenceScore;
    await saveAgentResult(analysisId, 'risk', riskResult);
    emitPipelineEvent(analysisId, { agent: 'risk', status: 'completed', confidence: riskResult.confidenceScore });

    // ── Parallel: Red Team + Ethicist ──────────────────────────────────────
    log.info(`[PIPELINE] Running red_team + ethicist (parallel) for ${analysisId}`);
    emitPipelineEvent(analysisId, { agent: 'red_team', status: 'running' });
    emitPipelineEvent(analysisId, { agent: 'ethicist', status: 'running' });

    const [redTeamResult, ethicistResult] = await Promise.all([
      runRedTeamAgent({
        analysisId, problemStatement: state.problemStatement, organisationContext: state.organisationContext,
        industryContext: state.industryContext, geographyContext: state.geographyContext, decisionType: state.decisionType,
        upstreamResults: { strategistData: state.strategistData, quantData: state.quantData, marketIntelData: state.marketIntelData, riskData: state.riskData },
      }),
      runEthicistAgent({
        analysisId, problemStatement: state.problemStatement, organisationContext: state.organisationContext,
        industryContext: state.industryContext, geographyContext: state.geographyContext, decisionType: state.decisionType,
        upstreamResults: { strategistData: state.strategistData, marketIntelData: state.marketIntelData },
      }),
    ]);

    state.redTeamData = redTeamResult.data as any;
    state.ethicistData = ethicistResult.data as any;
    state.agentConfidences.red_team = redTeamResult.confidenceScore;
    state.agentConfidences.ethicist = ethicistResult.confidenceScore;
    await Promise.all([saveAgentResult(analysisId, 'red_team', redTeamResult), saveAgentResult(analysisId, 'ethicist', ethicistResult)]);
    emitPipelineEvent(analysisId, { agent: 'red_team', status: 'completed', confidence: redTeamResult.confidenceScore });
    emitPipelineEvent(analysisId, { agent: 'ethicist', status: 'completed', confidence: ethicistResult.confidenceScore });

    // ── CoVe ────────────────────────────────────────────────────────────────
    log.info(`[PIPELINE] Running cove for ${analysisId}`);
    emitPipelineEvent(analysisId, { agent: 'cove', status: 'running', message: 'Chain-of-Verification in progress...' });
    await prisma.analysis.update({ where: { id: analysisId }, data: { currentAgent: 'cove' } });
    const coveResult = await runCoVeAgent({
      analysisId, problemStatement: state.problemStatement, organisationContext: state.organisationContext,
      industryContext: state.industryContext, geographyContext: state.geographyContext, decisionType: state.decisionType,
      upstreamResults: { strategistData: state.strategistData, quantData: state.quantData, marketIntelData: state.marketIntelData, riskData: state.riskData, redTeamData: state.redTeamData, ethicistData: state.ethicistData },
    });
    state.coveData = coveResult.data as any;
    state.agentConfidences.cove = coveResult.confidenceScore;
    state.logicConsistencyPassed = state.coveData?.logic_consistent ?? true;
    await saveAgentResult(analysisId, 'cove', coveResult);

    // Calculate overall confidence from CoVe
    const coveData = state.coveData as any;
    const verificationScore = coveData?.overall_verification_score || 70;
    const adjustment = coveData?.final_confidence_adjustment || 0;
    const overallConfidence = Math.max(52, Math.min(94, verificationScore + adjustment));
    state.overallConfidence = overallConfidence;

    emitPipelineEvent(analysisId, { agent: 'cove', status: 'completed', message: `Verification: ${coveData?.recommendation || 'PASS'}`, confidence: overallConfidence });

    // ── Self-correction routing ─────────────────────────────────────────────
    if (coveData?.recommendation === 'FAIL_ROUTE_BACK' && state.selfCorrectionCount < MAX_SELF_CORRECTIONS) {
      state.selfCorrectionCount++;
      await prisma.analysis.update({ where: { id: analysisId }, data: { selfCorrectionCount: state.selfCorrectionCount } });
      emitPipelineEvent(analysisId, { agent: 'cove', message: `Self-correction: routing back — iteration ${state.selfCorrectionCount}/${MAX_SELF_CORRECTIONS}`, selfCorrection: true });
    }

    // ── Synthesis ──────────────────────────────────────────────────────────
    log.info(`[PIPELINE] Running synthesis for ${analysisId}`);
    emitPipelineEvent(analysisId, { agent: 'synthesis', status: 'running', message: 'Assembling board-ready report...' });
    await prisma.analysis.update({ where: { id: analysisId }, data: { currentAgent: 'synthesis' } });
    const synthesisResult = await runSynthesisAgent({
      analysisId, problemStatement: state.problemStatement, organisationContext: state.organisationContext,
      industryContext: state.industryContext, geographyContext: state.geographyContext, decisionType: state.decisionType,
      upstreamResults: { strategistData: state.strategistData, quantData: state.quantData, marketIntelData: state.marketIntelData, riskData: state.riskData, redTeamData: state.redTeamData, ethicistData: state.ethicistData, coveData: state.coveData },
    });
    (synthesisResult.data as any).overall_confidence = overallConfidence;
    state.synthesisData = synthesisResult.data as any;
    state.agentConfidences.synthesis = overallConfidence;
    await saveAgentResult(analysisId, 'synthesis', synthesisResult);
    emitPipelineEvent(analysisId, { agent: 'synthesis', status: 'completed', confidence: overallConfidence });

    const synthesisData = state.synthesisData as any;
    const redTeamData = state.redTeamData as any;
    const fatalInvalidationCount = (redTeamData?.invalidated_claims || []).filter((c: any) => c.severity === 'Fatal').length;
    const majorInvalidationCount = (redTeamData?.invalidated_claims || []).filter((c: any) => c.severity === 'Major').length;
    const redTeamResponse = synthesisData?.red_team_response || null;
    const recommendationDowngraded = redTeamResponse?.recommendation_changed ?? false;
    const originalRecommendation = redTeamResponse?.original_recommendation ?? null;

    // Complete pipeline with all new fields
    const durationSeconds = (Date.now() - startTime) / 1000;
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'completed',
        currentAgent: null,
        overallConfidence,
        decisionRecommendation: synthesisData?.decision_recommendation || 'CONDITIONAL_HOLD',
        executiveSummary: synthesisData?.executive_summary,
        boardNarrative: synthesisData?.board_narrative,
        durationSeconds,
        completedAt: new Date(),
        logicConsistencyPassed: state.logicConsistencyPassed,
        redTeamChallengeCount: (redTeamData)?.invalidated_claims?.length || 0,
        selfCorrectionCount: state.selfCorrectionCount,
        // New M&A + quality fields
        fatalInvalidationCount,
        majorInvalidationCount,
        recommendationDowngraded,
        originalRecommendation,
        threeOptionsData: synthesisData?.three_options ?? null,
        buildVsBuyVerdict: synthesisData?.build_vs_buy_verdict ?? null,
        recommendedOption: synthesisData?.decision_recommendation ?? null,
        hasBlockingWarnings: fatalInvalidationCount > 0,
        confidenceBreakdown: {
          strategist: state.agentConfidences.strategist || null,
          quant: state.agentConfidences.quant || null,
          market_intel: state.agentConfidences.market_intel || null,
          risk: state.agentConfidences.risk || null,
          red_team: state.agentConfidences.red_team || null,
          ethicist: state.agentConfidences.ethicist || null,
          cove: state.agentConfidences.cove || null,
          overall: overallConfidence,
        },
      } as any,
    });

    emitAnalysisComplete(analysisId, { overallConfidence, decisionRecommendation: synthesisData?.decision_recommendation || 'CONDITIONAL_HOLD', durationSeconds });
    log.info(`[PIPELINE] Completed ${analysisId} in ${durationSeconds.toFixed(1)}s — confidence: ${overallConfidence}`);

  } catch (error) {
    log.error(`[PIPELINE] Failed ${analysisId}`, { error: String(error) });
    await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'failed' } });
    emitPipelineEvent(analysisId, { agent: state.currentAgent || 'unknown', status: 'failed', message: String(error) });
  }
}
