import { Router, Request, Response } from 'express';
import { requireAuth } from '../lib/auth';
import { prisma } from '../lib/database';
import { callLLMWithRetry } from '../lib/llmClient';
import { log } from '../lib/logger';

const router = Router();

const DISSERTATION_SYSTEM_PROMPT = `You are a senior academic research advisor with expertise in AI, strategic management, and human-computer interaction.

Your task: Generate a comprehensive dissertation/research framework for studying the AI system described.

Return ONLY valid JSON in this exact structure:
{
  "research_title": "Full dissertation title",
  "research_questions": [
    "RQ1: A clear, answerable research question",
    "RQ2: A second research question",
    "RQ3: A third research question"
  ],
  "hypotheses": [
    "H1: A falsifiable hypothesis",
    "H2: A falsifiable hypothesis"
  ],
  "methodology": "Research methodology description (mixed methods, experimental, case study, etc.)",
  "experiments": [
    {
      "name": "Experiment name",
      "hypothesis": "H1",
      "methodology": "How to run this experiment",
      "expected_outcome": "What you expect to find",
      "baseline": "What you compare against",
      "metrics": ["Metric 1", "Metric 2"],
      "estimated_duration": "X weeks"
    }
  ],
  "theoretical_framework": "Theoretical grounding (Actor-Network Theory, Situated Cognition, etc.)",
  "contribution_to_knowledge": "Specific contributions this research adds to the field",
  "expert_validation_plan": [
    "Expert 1: domain/institution",
    "Expert 2: domain/institution"
  ],
  "publication_targets": [
    "Journal/Conference 1 (impact factor/tier)",
    "Journal/Conference 2"
  ],
  "ethical_considerations": "Research ethics considerations",
  "timeline_months": 36,
  "chapter_outline": [
    "Chapter 1: Introduction and Research Context",
    "Chapter 2: Literature Review",
    "Chapter 3: Methodology",
    "Chapter 4: Results",
    "Chapter 5: Discussion and Conclusion"
  ]
}`;

const dissertationStore = new Map<string, Record<string, unknown>>();

router.post('/scaffold/:analysisId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const analysis = await prisma.analysis.findFirst({
      where: { id: req.params.analysisId, userId },
      select: { id: true, problemStatement: true, synthesisData: true, overallConfidence: true, decisionRecommendation: true },
    });

    if (!analysis) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Analysis not found' });
      return;
    }

    const synthesisData = (analysis.synthesisData || {}) as Record<string, unknown>;
    const dissertationContribution = (synthesisData.dissertation_contribution as string) || '';

    const userMessage = `
Generate a comprehensive dissertation research framework for studying the following AI strategic decision system:

SYSTEM: ASIS (AI Strategic Intelligence System) — a multi-agent orchestration platform for strategic consulting.

KEY ASPECTS:
- 8-agent pipeline: Strategist, Quant, Market Intel, Risk, Red Team, Ethicist, CoVe, Synthesis
- Adversarial debate protocol (agents challenge each other's outputs)
- Chain-of-Verification quality gate with confidence propagation
- Frameworks: MECE/Minto Pyramid, COSO ERM 2017, Porter's Five Forces, McKinsey 3 Horizons
- Decision output: Board-ready recommendation with 52-94% confidence score

PRIOR DISSERTATION CONTRIBUTION IDENTIFIED:
"${dissertationContribution || 'Multi-agent adversarial debate produces materially different — and more conservative — strategic recommendations than single-agent analysis'}"

STRATEGIC PROBLEM ANALYSED: "${analysis.problemStatement}"
DECISION OUTCOME: ${analysis.decisionRecommendation || 'Not yet determined'} (confidence: ${analysis.overallConfidence || 0}%)

Generate research questions that can lead to a PhD-level contribution in AI, strategic management, or human-AI collaboration. Return ONLY valid JSON.
    `;

    const fallback = {
      research_title: 'Multi-Agent Adversarial Debate in AI-Powered Strategic Decision Support: A Study of Confidence Calibration and Decision Quality',
      research_questions: [
        'RQ1: To what extent does adversarial multi-agent debate reduce overconfidence bias in AI-generated strategic recommendations compared to single-agent approaches?',
        'RQ2: How does the Chain-of-Verification (CoVe) quality gate affect the accuracy and reliability of strategic confidence scores in multi-agent AI systems?',
        'RQ3: What factors determine the adoption and trust of AI-generated strategic recommendations by C-suite executives?',
      ],
      hypotheses: [
        'H1: Multi-agent adversarial debate (Debate-to-Verify protocol) produces strategic recommendations with lower overconfidence bias (measured as deviation from expert consensus) than single-agent LLM outputs.',
        'H2: The weighted confidence propagation formula in ASIS will correlate positively with expert-rated recommendation quality scores (r > 0.6, p < 0.05).',
      ],
      methodology: 'Mixed-methods research combining controlled experimental comparison (AI vs expert panel recommendations), qualitative interviews with C-suite decision-makers, and quantitative analysis of confidence calibration metrics.',
      experiments: [
        {
          name: 'Experiment 1: Overconfidence Bias Reduction',
          hypothesis: 'H1',
          methodology: 'Present identical strategic questions to ASIS (8-agent) vs single-agent LLM (Claude Sonnet alone). Compare outputs against expert panel consensus of 10 McKinsey/BCG alumni.',
          expected_outcome: 'ASIS outputs will show 25-40% lower overconfidence bias as measured by deviation from expert consensus.',
          baseline: 'Single-agent LLM (Claude Sonnet 4) without adversarial validation',
          metrics: ['Mean Absolute Deviation from expert consensus', 'Calibration score (Brier score)', 'Red Team invalidation rate'],
          estimated_duration: '8 weeks',
        },
        {
          name: 'Experiment 2: Confidence Score Calibration',
          hypothesis: 'H2',
          methodology: 'Run 50 strategic analyses through ASIS. Have expert panel rate recommendation quality 1-100. Compute Pearson correlation between ASIS confidence score and expert quality rating.',
          expected_outcome: 'Significant positive correlation (r > 0.6) between confidence score and expert quality.',
          baseline: 'Random confidence scores and naive averaging of agent outputs',
          metrics: ['Pearson correlation coefficient', 'RMSE between predicted and expert confidence', 'AUC-ROC for binary "high quality" classification'],
          estimated_duration: '12 weeks',
        },
        {
          name: 'Experiment 3: Executive Trust and Adoption',
          hypothesis: 'H2',
          methodology: 'Semi-structured interviews with 20 C-suite executives after using ASIS. Thematic analysis of trust factors, concerns, and adoption intent.',
          expected_outcome: 'Identification of key trust factors (transparency, specificity, confidence calibration) and barriers to adoption.',
          baseline: 'Traditional management consulting report (McKinsey-format)',
          metrics: ['Technology Acceptance Model (TAM) scores', 'Trust calibration index', 'Adoption intent rating'],
          estimated_duration: '10 weeks',
        },
      ],
      theoretical_framework: 'Bounded Rationality Theory (Simon, 1955) + Dual Process Theory (Kahneman, 2011) + Technology Acceptance Model (Davis, 1989) + Multi-Agent Systems Theory (Wooldridge, 2009)',
      contribution_to_knowledge: 'This research contributes: (1) empirical evidence on overconfidence bias reduction through adversarial AI debate; (2) a validated confidence calibration methodology for multi-agent strategic AI; (3) a theoretical model of C-suite trust in AI decision support systems.',
      expert_validation_plan: [
        'Professor of Strategic Management, London Business School — validate framework and research design',
        'Senior Partner (former), McKinsey & Company — validate against real consulting practice',
        'AI Systems Researcher, Oxford Future of Humanity Institute — validate technical novelty',
        'Chief Strategy Officer, Fortune 500 company — validate practical relevance and executive adoption model',
      ],
      publication_targets: [
        'Strategic Management Journal (Impact Factor: 8.9, FT50)',
        'Journal of Artificial Intelligence Research (JAIR, Impact Factor: 4.9)',
        'Academy of Management Annual Meeting (AOM, Tier 1 conference)',
        'Conference on Neural Information Processing Systems (NeurIPS) — Workshop on AI for Decision Making',
      ],
      ethical_considerations: 'Informed consent from executive participants, anonymisation of company-specific strategic data, IRB approval required for human subject research, responsible AI disclosure in publications.',
      timeline_months: 36,
      chapter_outline: [
        'Chapter 1: Introduction — The Problem of AI Overconfidence in Strategic Decision-Making',
        'Chapter 2: Literature Review — Multi-Agent AI Systems, Adversarial Debate, Strategic Decision Theory',
        'Chapter 3: Methodology — Mixed Methods Research Design and ASIS System Description',
        'Chapter 4: Experiment Results — Overconfidence Bias, Confidence Calibration, Executive Trust',
        'Chapter 5: Discussion — Theoretical Contributions, Practical Implications, Limitations',
        'Chapter 6: Conclusion — Future Research Directions and Real-World Deployment',
      ],
    };

    const result = await callLLMWithRetry(
      DISSERTATION_SYSTEM_PROMPT,
      userMessage,
      ['research_title', 'research_questions', 'hypotheses', 'experiments', 'methodology'],
      fallback
    );

    dissertationStore.set(req.params.analysisId, result.data);
    log.info('Dissertation scaffold generated', { analysisId: req.params.analysisId });
    res.json({ dissertation: result.data, analysis_id: req.params.analysisId });
  } catch (err) {
    log.error('Dissertation scaffold error', { error: String(err) });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to generate dissertation scaffold' });
  }
});

router.get('/status/:analysisId', requireAuth, async (req: Request, res: Response) => {
  const cached = dissertationStore.get(req.params.analysisId);
  if (cached) {
    res.json({ status: 'ready', dissertation: cached });
  } else {
    res.json({ status: 'not_generated', message: 'No dissertation scaffold found. POST to /scaffold/:id to generate.' });
  }
});

export default router;
