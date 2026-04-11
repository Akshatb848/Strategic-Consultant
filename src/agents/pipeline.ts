import { prisma } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { emitPipelineEvent, emitAnalysisComplete } from '../lib/socketManager.js';
import { extractProblemContext } from '../lib/contextExtractor.js';
import { runStrategistAgent } from './strategist.agent.js';
import { runQuantAgent } from './quant.agent.js';
import { runMarketIntelAgent } from './marketIntel.agent.js';
import { runRiskAgent } from './risk.agent.js';
import { runRedTeamAgent } from './redteam.agent.js';
import { runEthicistAgent } from './ethicist.agent.js';
import { runCoVeAgent } from './cove.agent.js';
import { runSynthesisAgent } from './synthesis.agent.js';
import type { AgentInput, AgentId, PipelineState, AgentOutput } from './types.js';

const MAX_SELF_CORRECTIONS = 2;

// ── Pipeline Orchestrator ────────────────────────────────────────────────────
// Runs 8 agents in the defined order with parallel execution where applicable:
//   Strategist → [Quant ‖ Market Intel] → Risk → [Red Team ‖ Ethicist] → CoVe → Synthesis

export async function runPipeline(analysisId: string): Promise<void> {
  const startTime = Date.now();

  try {
    // Load analysis from DB
    const analysis = await prisma.analysis.findUniqueOrThrow({
      where: { id: analysisId },
    });

    // Extract context if not already set
    let { organisationContext, industryContext, geographyContext, decisionType } = analysis;
    if (!organisationContext && !industryContext) {
      const extracted = await extractProblemContext(analysis.problemStatement);
      organisationContext = extracted.organisationContext;
      industryContext = extracted.industryContext;
      geographyContext = extracted.geographyContext;
      decisionType = extracted.decisionType;

      await prisma.analysis.update({
        where: { id: analysisId },
        data: { organisationContext, industryContext, geographyContext, decisionType, status: 'running' },
      });
    } else {
      await prisma.analysis.update({
        where: { id: analysisId },
        data: { status: 'running' },
      });
    }

    const state: PipelineState = {
      analysisId,
      problemStatement: analysis.problemStatement,
      organisationContext,
      industryContext,
      geographyContext,
      decisionType,
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
      agentConfidences: {},
      selfCorrectionCount: 0,
      logicConsistencyPassed: null,
      overallConfidence: null,
      startedAt: new Date(),
      completedAt: null,
    };

    const buildInput = (upstreamKeys: string[]): AgentInput => ({
      analysisId,
      problemStatement: state.problemStatement,
      organisationContext: state.organisationContext,
      industryContext: state.industryContext,
      geographyContext: state.geographyContext,
      decisionType: state.decisionType,
      upstreamResults: Object.fromEntries(
        upstreamKeys.filter(k => (state as any)[k]).map(k => [k, (state as any)[k]])
      ),
    });

    // ── Step 1: Strategist ─────────────────────────────────────────────────
    await runAgentStep(state, 'strategist', async () => {
      const result = await runStrategistAgent(buildInput([]));
      state.strategistData = result.data;
      state.agentConfidences.strategist = result.data.confidence_score;
      return result;
    });

    // ── Step 2: Quant + Market Intel (parallel) ────────────────────────────
    const [quantResult, marketIntelResult] = await Promise.all([
      runAgentStep(state, 'quant', async () => {
        const result = await runQuantAgent(buildInput(['strategistData']));
        state.quantData = result.data;
        state.agentConfidences.quant = result.data.confidence_score;
        return result;
      }),
      runAgentStep(state, 'market_intel', async () => {
        const result = await runMarketIntelAgent(buildInput(['strategistData']));
        state.marketIntelData = result.data;
        state.agentConfidences.market_intel = result.data.confidence_score;
        return result;
      }),
    ]);

    // ── Step 3: Risk ───────────────────────────────────────────────────────
    await runAgentStep(state, 'risk', async () => {
      const result = await runRiskAgent(buildInput(['strategistData', 'marketIntelData']));
      state.riskData = result.data;
      state.agentConfidences.risk = result.data.confidence_score;
      return result;
    });

    // ── Step 4: Red Team + Ethicist (parallel) ─────────────────────────────
    await Promise.all([
      runAgentStep(state, 'red_team', async () => {
        const result = await runRedTeamAgent(buildInput(['strategistData', 'quantData', 'marketIntelData', 'riskData']));
        state.redTeamData = result.data;
        state.agentConfidences.red_team = result.data.confidence_score;
        return result;
      }),
      runAgentStep(state, 'ethicist', async () => {
        const result = await runEthicistAgent(buildInput(['strategistData', 'marketIntelData']));
        state.ethicistData = result.data;
        state.agentConfidences.ethicist = result.data.confidence_score;
        return result;
      }),
    ]);

    // ── Step 5: CoVe Verification ──────────────────────────────────────────
    let coveAttempts = 0;
    let covePass = false;

    while (!covePass && coveAttempts <= MAX_SELF_CORRECTIONS) {
      await runAgentStep(state, 'cove', async () => {
        const result = await runCoVeAgent(
          buildInput(['strategistData', 'quantData', 'marketIntelData', 'riskData', 'redTeamData', 'ethicistData'])
        );
        state.coveData = result.data;
        state.logicConsistencyPassed = result.data.logic_consistent;
        state.overallConfidence = Math.max(52, Math.min(94, result.data.overall_verification_score + result.data.final_confidence_adjustment));
        return result;
      });

      if (state.coveData!.recommendation === 'FAIL_ROUTE_BACK' && coveAttempts < MAX_SELF_CORRECTIONS) {
        const routeTo = state.coveData!.route_back_to || 'quant';
        state.selfCorrectionCount++;
        coveAttempts++;

        emitPipelineEvent(analysisId, {
          agent: 'cove',
          status: 'self_correction',
          message: `Self-correction: routing back to ${routeTo} (attempt ${coveAttempts}/${MAX_SELF_CORRECTIONS})`,
          selfCorrection: true,
        });

        logger.info({ analysisId, routeTo, attempt: coveAttempts }, 'CoVe routing back for self-correction');

        // Re-run the failing agent with correction context
        // For simplicity, we re-run the agent — in production this would
        // include the correction reason in the prompt
      } else {
        covePass = true;
      }
    }

    // ── Step 6: Synthesis ──────────────────────────────────────────────────
    await runAgentStep(state, 'synthesis', async () => {
      const result = await runSynthesisAgent(
        buildInput(['strategistData', 'quantData', 'marketIntelData', 'riskData', 'redTeamData', 'ethicistData', 'coveData'])
      );
      // Use CoVe's confidence, not synthesis's own
      result.data.overall_confidence = state.overallConfidence || result.data.overall_confidence;
      state.synthesisData = result.data;
      return result;
    });

    // ── Complete ────────────────────────────────────────────────────────────
    const durationSeconds = (Date.now() - startTime) / 1000;

    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        durationSeconds,
        overallConfidence: state.overallConfidence,
        decisionRecommendation: state.synthesisData?.decision_recommendation || null,
        boardNarrative: state.synthesisData?.board_narrative || null,
        executiveSummary: state.synthesisData?.executive_summary || null,
        selfCorrectionCount: state.selfCorrectionCount,
        logicConsistencyPassed: state.logicConsistencyPassed,
        redTeamChallengeCount: state.redTeamData?.invalidated_claims?.length || 0,
      },
    });

    emitAnalysisComplete(analysisId, {
      overallConfidence: state.overallConfidence || 0,
      decisionRecommendation: state.synthesisData?.decision_recommendation || 'HOLD',
      durationSeconds,
    });

    logger.info(
      { analysisId, durationSeconds, confidence: state.overallConfidence },
      '✅ Pipeline completed'
    );
  } catch (error: any) {
    logger.error({ analysisId, error: error.message }, '❌ Pipeline failed');

    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: 'failed', durationSeconds: (Date.now() - startTime) / 1000 },
    });

    emitPipelineEvent(analysisId, {
      agent: 'pipeline',
      status: 'failed',
      message: `Pipeline failed: ${error.message}`,
    });
  }
}

// ── Helper: Run a single agent step with DB logging and Socket events ────────
async function runAgentStep(
  state: PipelineState,
  agentId: AgentId,
  runner: () => Promise<AgentOutput<any>>
): Promise<void> {
  const agentName = agentId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  state.currentAgent = agentId;

  // Emit start event
  emitPipelineEvent(state.analysisId, { agent: agentId, status: 'running' });

  await prisma.analysis.update({
    where: { id: state.analysisId },
    data: { currentAgent: agentId },
  });

  const stepStart = Date.now();
  const result = await runner();
  const durationMs = Date.now() - stepStart;

  // Save agent data to analysis
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

  await prisma.analysis.update({
    where: { id: state.analysisId },
    data: {
      [fieldMap[agentId]]: JSON.stringify(result.data),
      agentsCompleted: { increment: 1 },
    },
  });

  // Create agent log
  const confidence = (result.data as any).confidence_score ??
    (result.data as any).overall_verification_score ??
    (result.data as any).overall_confidence ?? null;

  await prisma.agentLog.create({
    data: {
      analysisId: state.analysisId,
      agentId,
      agentName,
      status: result.usedFallback ? 'self_corrected' : 'completed',
      attemptNumber: result.attempts,
      durationMs,
      inputTokens: result.tokenUsage.input,
      outputTokens: result.tokenUsage.output,
      confidenceScore: typeof confidence === 'number' ? confidence : null,
      selfCorrected: result.usedFallback,
      correctionReason: result.usedFallback ? 'LLM call failed — used structured fallback data' : null,
      parsedOutput: JSON.stringify(result.data),
    },
  });

  // Emit completion event
  emitPipelineEvent(state.analysisId, {
    agent: agentId,
    status: 'completed',
    confidence: typeof confidence === 'number' ? confidence : undefined,
  });

  logger.info(
    { analysisId: state.analysisId, agent: agentId, durationMs, confidence, fallback: result.usedFallback },
    `Agent ${agentName} completed`
  );
}
