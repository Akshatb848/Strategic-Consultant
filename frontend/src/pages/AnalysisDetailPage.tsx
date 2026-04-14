import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { analysesAPI, type ValidationWarning } from '../lib/apiClient';
import { subscribeToAnalysis, type PipelineEvent } from '../lib/socketClient';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle,
  Clock,
  Crosshair,
  Scale,
  Shield,
  Sparkles,
  Swords,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type AnalysisRecord = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  problemStatement: string;
  organisationContext?: string;
  industryContext?: string;
  geographyContext?: string;
  decisionType?: string;
  overallConfidence?: number | null;
  decisionRecommendation?: string | null;
  originalRecommendation?: string | null;
  recommendationDowngraded?: boolean;
  boardNarrative?: string | null;
  executiveSummary?: string | null;
  durationSeconds?: number | null;
  agentsCompleted?: number;
  agentsTotal?: number;
  selfCorrectionCount?: number | null;
  redTeamChallengeCount?: number | null;
  fatalInvalidationCount?: number | null;
  majorInvalidationCount?: number | null;
  logicConsistencyPassed?: boolean | null;
  currentAgent?: string | null;
  validationWarnings?: ValidationWarning[] | null;
  confidenceBreakdown?: ConfidenceBreakdown | null;
  threeOptionsData?: StrategicOption[] | null;
  agentLogs?: AgentLogRecord[];
  strategistData?: { confidence_score?: number } | null;
  quantData?: {
    confidence_score?: number;
    investment_scenarios?: Array<{ scenario: string; roi_3yr?: string; payback_months?: number; probability_of_success?: number }>;
    revenue_attribution_methodology?: {
      challenge: string;
      proposed_methodology: string;
      attribution_risk: string;
      precedent: string;
    };
    acquisition_premium_analysis?: {
      acquisition_premium: string;
      premium_justification_required: string;
      note: string;
    };
  } | null;
  marketIntelData?: { confidence_score?: number } | null;
  riskData?: { confidence_score?: number; heat_map_data?: Array<{ risk_id: string; label: string; severity: number }> } | null;
  redTeamData?: {
    confidence_score?: number;
    overall_threat_level?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    invalidated_claims?: InvalidatedClaim[];
    surviving_claims?: string[];
    pre_mortem_scenarios?: Array<{ scenario: string; probability: string; financial_impact: string; trigger_condition: string; mitigation: string }>;
    red_team_verdict?: string;
    talent_exodus_risk?: string | null;
  } | null;
  ethicistData?: { confidence_score?: number } | null;
  coveVerificationData?: { overall_verification_score?: number; confidence_breakdown?: ConfidenceBreakdown } | null;
  synthesisData?: {
    strategic_imperatives?: string[];
    risk_adjusted_recommendation?: string;
    competitive_benchmarks?: Array<{ dimension: string; our_score: number; industry_avg: number; leader_score: number; gap_to_leader: number; named_leader: string }>;
    red_team_response?: {
      fatal_count: number;
      major_count: number;
      minor_count: number;
      recommendation_changed: boolean;
      original_recommendation: string;
      final_recommendation: string;
      downgrade_reason: string;
    };
    three_options?: StrategicOption[];
    build_vs_buy_verdict?: string;
  } | null;
};

type AgentLogRecord = {
  agentId: string;
  durationMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  confidenceScore?: number | null;
  selfCorrected?: boolean | null;
};

type ConfidenceBreakdown = {
  lines: Array<{ agent: string; label: string; score: number; weight: number; contribution: number }>;
  weighted_base: number;
  adjustments: string[];
  final: number;
};

type InvalidatedClaim = {
  original_claim: string;
  source_agent: string;
  invalidation_reason: string;
  evidence: string;
  severity: 'Fatal' | 'Major' | 'Minor';
};

type StrategicOption = {
  option: 'A' | 'B' | 'C';
  label: string;
  description: string;
  total_cost: string;
  timeline_to_value: string;
  npv_3yr_base: string;
  npv_3yr_risk_adjusted: string;
  probability_of_achieving_roi_target: string;
  key_condition: string;
  recommended: boolean;
};

const AGENT_META: Record<string, { icon: typeof Brain; color: string; label: string; dataKey: keyof AnalysisRecord }> = {
  strategist: { icon: Brain, color: '#6366f1', label: 'Strategist', dataKey: 'strategistData' },
  quant: { icon: BarChart3, color: '#10b981', label: 'Quant', dataKey: 'quantData' },
  market_intel: { icon: Crosshair, color: '#3b82f6', label: 'Market Intel', dataKey: 'marketIntelData' },
  risk: { icon: Shield, color: '#f59e0b', label: 'Risk', dataKey: 'riskData' },
  red_team: { icon: Swords, color: '#ef4444', label: 'Red Team', dataKey: 'redTeamData' },
  ethicist: { icon: Scale, color: '#8b5cf6', label: 'Ethicist', dataKey: 'ethicistData' },
  cove: { icon: CheckCircle, color: '#14b8a6', label: 'CoVe', dataKey: 'coveVerificationData' },
  synthesis: { icon: Sparkles, color: '#ec4899', label: 'Synthesis', dataKey: 'synthesisData' },
};

const AGENT_ORDER = ['strategist', 'quant', 'market_intel', 'risk', 'red_team', 'ethicist', 'cove', 'synthesis'] as const;

function getConfidenceColor(score: number) {
  if (score >= 82) return '#10b981';
  if (score >= 70) return '#f59e0b';
  if (score >= 60) return '#f97316';
  return '#ef4444';
}

function getConfidenceLabel(score: number) {
  if (score >= 82) return 'High confidence - Strong evidence base';
  if (score >= 70) return 'Moderate confidence - Key assumptions present';
  if (score >= 60) return 'Low confidence - Significant assumptions';
  return 'Exploratory - High uncertainty; treat as directional only';
}

function parseLooseNumber(value: string | number | undefined) {
  if (typeof value === 'number') return value;
  const match = String(value || '').match(/-?[\d.]+/);
  return match ? Number(match[0]) : 0;
}

function durationLabel(seconds?: number | null) {
  if (!seconds && seconds !== 0) return null;
  return seconds < 60 ? `${Math.round(seconds)}s` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export default function AnalysisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [pipelineEvents, setPipelineEvents] = useState<PipelineEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'agents' | 'visualizations'>('overview');
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadAnalysis();
  }, [id]);

  useEffect(() => {
    if (!id || analysis?.status === 'completed' || analysis?.status === 'failed') return;
    const unsubscribe = subscribeToAnalysis(
      id,
      (event) => {
        setPipelineEvents((previous) => {
          const last = previous[previous.length - 1];
          if (last && last.agent === event.agent && last.status === event.status && last.message === event.message) {
            return previous;
          }
          return [...previous, event];
        });
        if (event.status === 'completed') void loadAnalysis();
      },
      () => {
        void loadAnalysis();
      }
    );
    return unsubscribe;
  }, [id, analysis?.status]);

  useEffect(() => {
    const isRunning = analysis?.status === 'running' || analysis?.status === 'queued';
    if (activeTab === 'pipeline' && isRunning) {
      eventsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [pipelineEvents, activeTab, analysis?.status]);

  const loadAnalysis = async () => {
    if (!id) return;
    try {
      const { data } = await analysesAPI.get(id);
      setAnalysis(data.analysis as AnalysisRecord);
    } catch {
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  const derived = useMemo(() => {
    if (!analysis) return null;
    const invalidatedClaims = analysis.redTeamData?.invalidated_claims || [];
    const fatalCount = analysis.fatalInvalidationCount ?? invalidatedClaims.filter((claim) => claim.severity === 'Fatal').length;
    const majorCount = analysis.majorInvalidationCount ?? invalidatedClaims.filter((claim) => claim.severity === 'Major').length;
    const threeOptions = analysis.threeOptionsData || analysis.synthesisData?.three_options || [];
    const confidenceBreakdown = analysis.confidenceBreakdown || analysis.coveVerificationData?.confidence_breakdown || null;
    const radarData = AGENT_ORDER.map((agentId) => {
      const meta = AGENT_META[agentId];
      const payload = analysis[meta.dataKey] as { confidence_score?: number; overall_verification_score?: number } | null | undefined;
      return { agent: meta.label, confidence: payload?.confidence_score || payload?.overall_verification_score || 0 };
    }).filter((entry) => entry.confidence > 0);
    const investmentData = analysis.quantData?.investment_scenarios?.map((scenario) => ({
      name: scenario.scenario.replace(/\(.*\)/, '').trim().split(' ').slice(0, 2).join(' '),
      roi: parseLooseNumber(scenario.roi_3yr),
    })) || [];

    return {
      isRunning: analysis.status === 'running' || analysis.status === 'queued',
      isComplete: analysis.status === 'completed',
      fatalCount,
      majorCount,
      confidenceBreakdown,
      threeOptions,
      recommendedOption: threeOptions.find((option) => option.recommended),
      acquisitionOption: threeOptions.find((option) => option.option === 'A'),
      validationWarnings: analysis.validationWarnings || [],
      radarData,
      investmentData,
    };
  }, [analysis]);

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map((index) => <div key={index} className="skeleton" style={{ height: 88, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      </AppLayout>
    );
  }

  if (!analysis || !derived) {
    return (
      <AppLayout>
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <AlertTriangle size={40} color="var(--warning)" style={{ marginBottom: 16 }} />
          <h2>Analysis not found</h2>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <style>{`@keyframes asisPulse { 0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.32); } 70% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); } 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); } }`}</style>

      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <span className={`badge badge-${analysis.status}`}>{analysis.status}</span>
          {analysis.decisionRecommendation ? <span className={`badge badge-${analysis.decisionRecommendation.toLowerCase()}`}>{analysis.decisionRecommendation}</span> : null}
          {durationLabel(analysis.durationSeconds) ? <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={14} /> {durationLabel(analysis.durationSeconds)}</span> : null}
        </div>
        <h1 className="page-title" style={{ fontSize: 22 }}>{analysis.problemStatement}</h1>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          {analysis.organisationContext ? <span>{analysis.organisationContext}</span> : null}
          {analysis.industryContext ? <span>{analysis.industryContext}</span> : null}
          {analysis.geographyContext ? <span>{analysis.geographyContext}</span> : null}
          {analysis.decisionType ? <span>{analysis.decisionType}</span> : null}
        </div>
      </div>

      {derived.isComplete ? <BoardDecisionHero analysis={analysis} confidenceBreakdown={derived.confidenceBreakdown} fatalCount={derived.fatalCount} threeOptions={derived.threeOptions} recommendedOption={derived.recommendedOption} acquisitionOption={derived.acquisitionOption} /> : null}

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24, overflowX: 'auto' }}>
        {(['overview', 'pipeline', 'agents', 'visualizations'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', color: activeTab === tab ? 'var(--accent-secondary)' : 'var(--text-muted)', fontWeight: activeTab === tab ? 700 : 500, fontSize: 13, borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent', whiteSpace: 'nowrap' }}>
            {tab === 'agents' ? 'Agent Outputs' : tab === 'visualizations' ? 'Visualizations' : tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? <OverviewTab analysis={analysis} validationWarnings={derived.validationWarnings} fatalCount={derived.fatalCount} majorCount={derived.majorCount} threeOptions={derived.threeOptions} /> : null}
      {activeTab === 'pipeline' ? <PipelineTab analysis={analysis} pipelineEvents={pipelineEvents} isRunning={derived.isRunning} eventsEndRef={eventsEndRef} /> : null}
      {activeTab === 'agents' ? <AgentsTab analysis={analysis} /> : null}
      {activeTab === 'visualizations' ? <VisualizationsTab analysis={analysis} radarData={derived.radarData} investmentData={derived.investmentData} /> : null}
    </AppLayout>
  );
}

function OverviewTab(props: {
  analysis: AnalysisRecord;
  validationWarnings: ValidationWarning[];
  fatalCount: number;
  majorCount: number;
  threeOptions: StrategicOption[];
}) {
  const { analysis, validationWarnings, fatalCount, majorCount, threeOptions } = props;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {analysis.executiveSummary ? <div className="card"><h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Executive Summary</h3><p style={{ lineHeight: 1.8, color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>{analysis.executiveSummary}</p></div> : null}
      {analysis.synthesisData?.strategic_imperatives?.length ? <div className="card"><h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Strategic Imperatives</h3><ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>{analysis.synthesisData.strategic_imperatives.map((item, index) => <li key={index} style={{ padding: '12px 16px', background: 'rgba(99, 102, 241, 0.04)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.08)', fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{item}</li>)}</ul></div> : null}
      {analysis.synthesisData?.risk_adjusted_recommendation ? <div className="card"><h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Risk-Adjusted Recommendation</h3><p style={{ lineHeight: 1.8, color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>{analysis.synthesisData.risk_adjusted_recommendation}</p></div> : null}
      {validationWarnings.length ? <AssumptionsPanel warnings={validationWarnings} /> : null}
      <RedTeamPanel analysis={analysis} fatalCount={fatalCount} majorCount={majorCount} />
      {threeOptions.length ? <ThreeOptionsSection options={threeOptions} verdict={analysis.synthesisData?.build_vs_buy_verdict || ''} /> : null}
      {analysis.quantData?.revenue_attribution_methodology ? <div className="card"><h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Revenue Attribution Methodology</h3><div style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}><div><strong style={{ color: 'var(--text-primary)' }}>Challenge:</strong> {analysis.quantData.revenue_attribution_methodology.challenge}</div><div><strong style={{ color: 'var(--text-primary)' }}>Method:</strong> {analysis.quantData.revenue_attribution_methodology.proposed_methodology}</div><div><strong style={{ color: 'var(--text-primary)' }}>Attribution risk:</strong> {analysis.quantData.revenue_attribution_methodology.attribution_risk}</div><div><strong style={{ color: 'var(--text-primary)' }}>Precedent:</strong> {analysis.quantData.revenue_attribution_methodology.precedent}</div></div></div> : null}
      {analysis.quantData?.acquisition_premium_analysis ? <div className="card"><h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Acquisition Premium Challenge</h3><div style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}><MetricRow label="Premium" value={analysis.quantData.acquisition_premium_analysis.acquisition_premium} /><MetricRow label="Justification required" value={analysis.quantData.acquisition_premium_analysis.premium_justification_required} /><p style={{ margin: 0, lineHeight: 1.8 }}>{analysis.quantData.acquisition_premium_analysis.note}</p></div></div> : null}
    </div>
  );
}

function PipelineTab(props: {
  analysis: AnalysisRecord;
  pipelineEvents: PipelineEvent[];
  isRunning: boolean;
  eventsEndRef: RefObject<HTMLDivElement | null>;
}) {
  const { analysis, pipelineEvents, isRunning, eventsEndRef } = props;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {AGENT_ORDER.map((agentId, index) => {
        const meta = AGENT_META[agentId];
        const Icon = meta.icon;
        const log = analysis.agentLogs?.find((entry) => entry.agentId === agentId);
        const isActiveAgent = analysis.currentAgent === agentId && isRunning;
        return <motion.div key={agentId} className="card" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderColor: isActiveAgent ? meta.color : undefined, boxShadow: isActiveAgent ? `0 0 15px ${meta.color}22` : undefined }}><div style={{ width: 40, height: 40, borderRadius: 10, background: `${meta.color}18`, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} /></div><div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{meta.label}</div>{log ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.durationMs || 0}ms - {(log.inputTokens || 0) + (log.outputTokens || 0)} tokens</div> : null}</div><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{typeof log?.confidenceScore === 'number' ? <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: meta.color }}>{Math.round(log.confidenceScore)}%</span> : null}{isActiveAgent ? <span className="badge badge-running"><Activity size={10} /> Running</span> : log ? <span className={`badge ${log.selfCorrected ? 'badge-hold' : 'badge-completed'}`}>{log.selfCorrected ? 'Fallback' : 'Done'}</span> : <span className="badge badge-pending">Pending</span>}</div></motion.div>;
      })}
      {pipelineEvents.length ? <div className="card" style={{ marginTop: 16 }}><h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Live Events</h4><div style={{ maxHeight: 220, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>{pipelineEvents.map((event, index) => <div key={`${event.agent}-${event.timestamp}-${index}`} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}><span style={{ minWidth: 70 }}>{new Date(event.timestamp).toLocaleTimeString()}</span><span style={{ color: AGENT_META[event.agent]?.color || 'var(--text-secondary)' }}>{event.agent}</span><span>{event.status}{event.message ? ` - ${event.message}` : ''}</span>{event.confidence ? <span style={{ color: 'var(--success)' }}>{event.confidence}%</span> : null}</div>)}<div ref={eventsEndRef} /></div></div> : null}
    </div>
  );
}

function AgentsTab({ analysis }: { analysis: AnalysisRecord }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{AGENT_ORDER.map((agentId) => {
    const meta = AGENT_META[agentId];
    const payload = analysis[meta.dataKey];
    if (!payload) return null;
    return <details key={agentId} className="card" style={{ cursor: 'pointer' }}><summary style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}><meta.icon size={18} color={meta.color} />{meta.label} Output</summary><pre style={{ marginTop: 16, padding: 16, background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', overflow: 'auto', maxHeight: 400, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{JSON.stringify(payload, null, 2)}</pre></details>;
  })}</div>;
}

function VisualizationsTab(props: { analysis: AnalysisRecord; radarData: Array<{ agent: string; confidence: number }>; investmentData: Array<{ name: string; roi: number }> }) {
  const { analysis, radarData, investmentData } = props;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>{radarData.length ? <div className="card"><h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Agent Confidence Radar</h3><ResponsiveContainer width="100%" height={320}><RadarChart data={radarData}><PolarGrid stroke="var(--border)" /><PolarAngleAxis dataKey="agent" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} /><PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} /><Radar name="Confidence" dataKey="confidence" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} /></RadarChart></ResponsiveContainer></div> : null}{investmentData.length ? <div className="card"><h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Investment Scenarios</h3><ResponsiveContainer width="100%" height={280}><BarChart data={investmentData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="%" /><Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} /><Bar dataKey="roi" radius={[6, 6, 0, 0]}>{investmentData.map((_, index) => <Cell key={index} fill={['#6366f1', '#10b981', '#f59e0b', '#3b82f6'][index % 4]} />)}</Bar></BarChart></ResponsiveContainer></div> : null}{analysis.synthesisData?.competitive_benchmarks?.length ? <div className="card"><h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Competitive Benchmarks</h3><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr style={{ borderBottom: '1px solid var(--border)' }}><th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Dimension</th><th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Our Score</th><th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Industry Avg</th><th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Leader</th><th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Gap</th></tr></thead><tbody>{analysis.synthesisData.competitive_benchmarks.map((benchmark, index) => <tr key={index} style={{ borderBottom: '1px solid rgba(48, 54, 61, 0.3)' }}><td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{benchmark.dimension}</td><td style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 700, color: 'var(--accent-secondary)' }}>{benchmark.our_score}</td><td style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-secondary)' }}>{benchmark.industry_avg}</td><td style={{ textAlign: 'center', padding: '10px 12px' }}><span style={{ fontWeight: 700 }}>{benchmark.leader_score}</span><span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{benchmark.named_leader}</span></td><td style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--danger)', fontWeight: 700 }}>-{benchmark.gap_to_leader}</td></tr>)}</tbody></table></div></div> : null}</div>;
}

function BoardDecisionHero(props: { analysis: AnalysisRecord; confidenceBreakdown: ConfidenceBreakdown | null; fatalCount: number; threeOptions: StrategicOption[]; recommendedOption?: StrategicOption; acquisitionOption?: StrategicOption }) {
  const { analysis, confidenceBreakdown, fatalCount, threeOptions, recommendedOption, acquisitionOption } = props;
  const confidence = Math.round(analysis.overallConfidence || 0);
  const downgrade = analysis.recommendationDowngraded;
  return <div className="card" style={{ marginBottom: 24, padding: 24, borderColor: downgrade ? 'rgba(245, 158, 11, 0.35)' : undefined }}><div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}><ConfidenceRing value={confidence} breakdown={confidenceBreakdown} hasFatal={fatalCount > 0} /><div style={{ flex: 1, minWidth: 280 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}><div><div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Board decision</div>{downgrade && analysis.originalRecommendation ? <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 12, textDecoration: 'line-through' }}>Original assessment: {analysis.originalRecommendation}</div> : null}<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}><span style={{ fontSize: 32, fontWeight: 800 }}>{analysis.decisionRecommendation}</span>{downgrade ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'rgba(245, 158, 11, 0.18)', color: '#fde68a', fontSize: 12, fontWeight: 700 }}><Swords size={13} /> Downgraded after Red Team challenge</span> : null}</div></div><div style={{ minWidth: 220 }}><div style={{ fontSize: 12, color: getConfidenceColor(confidence), fontWeight: 700 }}>{confidence}% confidence</div><div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{getConfidenceLabel(confidence)}</div></div></div><div style={{ marginTop: 16, fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)' }}>{analysis.boardNarrative || analysis.executiveSummary}</div>{threeOptions.length && recommendedOption && acquisitionOption ? <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 16, paddingTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>BUILD-VS-BUY EVALUATED</span><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>3 options modelled - {recommendedOption.label} recommended - {recommendedOption.total_cost} vs {acquisitionOption.total_cost} full acquisition</span></div> : null}</div></div></div>;
}

function ConfidenceRing(props: { value: number; breakdown: ConfidenceBreakdown | null; hasFatal: boolean }) {
  const { value, breakdown, hasFatal } = props;
  const [open, setOpen] = useState(false);
  const size = 128;
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = getConfidenceColor(value);
  return <div style={{ position: 'relative', width: size, flexShrink: 0 }}><button type="button" onClick={() => setOpen((previous) => !previous)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} style={{ width: size, height: size, border: 'none', background: 'transparent', cursor: 'pointer', position: 'relative', padding: 0, borderRadius: '50%', animation: value < 72 ? 'asisPulse 2s infinite' : undefined }}><svg width={size} height={size}><circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={8} fill="none" /><circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={8} fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.9s ease' }} /></svg><span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: size / 4, fontWeight: 800 }}>{value}</span>{hasFatal ? <span style={{ position: 'absolute', right: 12, top: 12, width: 12, height: 12, borderRadius: '50%', background: '#ef4444', border: '2px solid rgba(15, 23, 42, 0.8)' }} /> : null}</button>{open && breakdown ? <div style={{ position: 'absolute', top: size + 12, left: 0, zIndex: 10, width: 320, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-lg)', padding: 14, boxShadow: '0 18px 40px rgba(0, 0, 0, 0.35)' }}><div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Confidence breakdown</div><div style={{ display: 'grid', gap: 6, fontSize: 12 }}><div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 0.7fr 0.9fr', color: 'var(--text-muted)', fontWeight: 600 }}><span>Agent</span><span>Score</span><span>Weight</span><span>Contribution</span></div>{breakdown.lines.map((line) => <div key={line.agent} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 0.7fr 0.9fr', color: 'var(--text-secondary)' }}><span>{line.label}</span><span>{line.score}</span><span>{Math.round(line.weight * 100)}%</span><span>{line.contribution.toFixed(2)}</span></div>)}<div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 4 }}><div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}><span>Base weighted average</span><strong>{breakdown.weighted_base.toFixed(2)}</strong></div><div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 11 }}>Adjustments: {breakdown.adjustments.length ? breakdown.adjustments.join(' | ') : 'None'}</div><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}><span style={{ fontWeight: 700 }}>Final</span><strong>{breakdown.final}</strong></div></div></div></div> : null}</div>;
}

function AssumptionsPanel({ warnings }: { warnings: ValidationWarning[] }) {
  return <div className="card"><h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Pre-flight Assumptions and Caveats</h3><div style={{ display: 'grid', gap: 10 }}>{warnings.map((warning) => <div key={warning.type} style={{ borderRadius: 'var(--radius-md)', padding: 14, border: warning.severity === 'BLOCKING' ? '1px solid rgba(239, 68, 68, 0.35)' : warning.severity === 'MAJOR' ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(59, 130, 246, 0.20)', background: warning.severity === 'BLOCKING' ? 'rgba(239, 68, 68, 0.08)' : warning.severity === 'MAJOR' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(59, 130, 246, 0.06)' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><strong>{warning.type}</strong><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{warning.severity}</span></div><p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{warning.message}</p><p style={{ margin: '8px 0 0', color: 'var(--text-muted)', lineHeight: 1.6 }}>Suggested action: {warning.suggestion}</p></div>)}</div></div>;
}

function MetricRow(props: { label: string; value: string; color?: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{props.label}</span><span style={{ fontWeight: 700, color: props.color || 'var(--text-primary)' }}>{props.value}</span></div>;
}

function ChallengePill(props: { label: string; tone: 'fatal' | 'major' | 'minor' | 'validated' }) {
  const palette = props.tone === 'fatal' ? { background: 'rgba(239, 68, 68, 0.18)', color: '#fecaca' } : props.tone === 'major' ? { background: 'rgba(245, 158, 11, 0.18)', color: '#fde68a' } : props.tone === 'minor' ? { background: 'rgba(250, 204, 21, 0.18)', color: '#fef08a' } : { background: 'rgba(16, 185, 129, 0.18)', color: '#bbf7d0' };
  return <span style={{ padding: '6px 10px', borderRadius: 999, background: palette.background, color: palette.color, fontSize: 11, fontWeight: 700 }}>{props.label}</span>;
}

function RedTeamPanel(props: { analysis: AnalysisRecord; fatalCount: number; majorCount: number }) {
  const invalidatedClaims = props.analysis.redTeamData?.invalidated_claims || [];
  const survivingClaims = props.analysis.redTeamData?.surviving_claims || [];
  const preMortems = props.analysis.redTeamData?.pre_mortem_scenarios || [];
  const threatLevel = props.analysis.redTeamData?.overall_threat_level || 'MEDIUM';
  const minorCount = Math.max(0, invalidatedClaims.length - props.fatalCount - props.majorCount);
  const threatTone = threatLevel === 'CRITICAL' ? { background: 'rgba(239, 68, 68, 0.18)', color: '#fecaca' } : threatLevel === 'HIGH' ? { background: 'rgba(249, 115, 22, 0.18)', color: '#fdba74' } : threatLevel === 'MEDIUM' ? { background: 'rgba(245, 158, 11, 0.18)', color: '#fde68a' } : { background: 'rgba(16, 185, 129, 0.18)', color: '#bbf7d0' };
  return <div className="card"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}><div><h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Red Team Challenge</h3><p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>Adversarial review of the board case, including invalidations, pre-mortem scenarios, and talent-retention failure modes.</p></div><span style={{ padding: '8px 12px', borderRadius: 999, background: threatTone.background, color: threatTone.color, fontSize: 12, fontWeight: 700 }}>{threatLevel}</span></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}><ChallengePill label={`${invalidatedClaims.length} challenged`} tone="major" /><ChallengePill label={`${survivingClaims.length} survived`} tone="validated" /><ChallengePill label={`${props.fatalCount} fatal`} tone="fatal" /><ChallengePill label={`${props.majorCount} major`} tone="major" /><ChallengePill label={`${minorCount} minor`} tone="minor" /></div>{props.fatalCount > 0 ? <div style={{ marginBottom: 16, background: 'rgba(239, 68, 68, 0.10)', border: '1px solid #ef4444', borderRadius: 'var(--radius-lg)', padding: 16, color: '#fecaca', fontWeight: 700 }}>Fatal invalidation - recommendation downgraded from {props.analysis.synthesisData?.red_team_response?.original_recommendation || 'PROCEED'} to {props.analysis.synthesisData?.red_team_response?.final_recommendation || 'HOLD'}</div> : null}{invalidatedClaims.length ? <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>{invalidatedClaims.map((claim, index) => <details key={`${claim.original_claim}-${index}`} style={{ borderLeft: `4px solid ${claim.severity === 'Fatal' ? '#ef4444' : claim.severity === 'Major' ? '#f59e0b' : '#facc15'}`, background: 'rgba(255,255,255,0.03)', borderRadius: '0 var(--radius-md) var(--radius-md) 0', padding: 12 }}><summary style={{ cursor: 'pointer', display: 'grid', gap: 8, color: 'var(--text-secondary)', fontSize: 12 }}><span style={{ color: claim.severity === 'Fatal' ? '#ef4444' : claim.severity === 'Major' ? '#f59e0b' : '#facc15', fontWeight: 700 }}>{claim.severity}</span><span>{claim.original_claim}</span><span>{claim.evidence}</span><span>{claim.source_agent}</span></summary><div style={{ marginTop: 12, color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 13 }}>{claim.invalidation_reason}</div></details>)}</div> : null}{survivingClaims.length ? <div style={{ marginBottom: 20 }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Claims that survived adversarial scrutiny</div><div style={{ display: 'grid', gap: 8 }}>{survivingClaims.map((claim, index) => <div key={`${claim}-${index}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.18)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: 13 }}><CheckCircle size={14} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} /><span>{claim}</span></div>)}</div></div> : null}{preMortems.length ? <div style={{ marginBottom: 20 }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Pre-mortem scenarios</div><div style={{ display: 'grid', gap: 10 }}>{preMortems.map((scenario, index) => <details key={`${scenario.scenario}-${index}`} className="card" style={{ padding: 14 }}><summary style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><span style={{ fontWeight: 600 }}>{scenario.scenario}</span><span className="badge badge-hold">{scenario.probability}</span></summary><div style={{ marginTop: 12, display: 'grid', gap: 8, color: 'var(--text-secondary)', fontSize: 13 }}><div><strong style={{ color: 'var(--text-primary)' }}>Financial impact:</strong> {scenario.financial_impact}</div><div><strong style={{ color: 'var(--text-primary)' }}>Trigger:</strong> {scenario.trigger_condition}</div><div><strong style={{ color: 'var(--text-primary)' }}>Mitigation:</strong> {scenario.mitigation}</div></div></details>)}</div></div> : null}{props.analysis.redTeamData?.talent_exodus_risk ? <div style={{ marginBottom: 20, padding: 16, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.22)', borderRadius: 'var(--radius-lg)' }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Talent Retention Risk</div><div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 13 }}>{props.analysis.redTeamData.talent_exodus_risk}</div></div> : null}{props.analysis.redTeamData?.red_team_verdict ? <div style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.18)', fontSize: 15, fontStyle: 'italic', lineHeight: 1.8 }}><div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, fontStyle: 'normal' }}>RED TEAM VERDICT</div>{props.analysis.redTeamData.red_team_verdict}</div> : null}</div>;
}

function ThreeOptionsSection(props: { options: StrategicOption[]; verdict: string }) {
  const chartData = props.options.map((option) => ({ name: `${option.option} - ${option.label}`, npv: parseLooseNumber(option.npv_3yr_risk_adjusted), fill: option.option === 'A' ? '#f59e0b' : option.option === 'B' ? '#10b981' : '#3b82f6' }));
  return <div className="card"><div style={{ marginBottom: 16 }}><h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Strategic Options Analysis</h3><p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>Build vs. buy vs. invest - comparative evaluation for the board.</p></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 18 }}>{props.options.map((option) => <div key={option.option} style={{ borderRadius: 'var(--radius-lg)', border: option.recommended ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255,255,255,0.08)', background: option.recommended ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.03)', padding: 16, display: 'grid', gap: 10 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><span style={{ borderRadius: 999, padding: '6px 10px', background: option.option === 'A' ? 'rgba(245, 158, 11, 0.18)' : option.option === 'B' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(59, 130, 246, 0.18)', color: option.option === 'A' ? '#fde68a' : option.option === 'B' ? '#bbf7d0' : '#bfdbfe', fontSize: 11, fontWeight: 700 }}>Option {option.option}</span>{option.recommended ? <span className="badge badge-completed">Recommended</span> : null}</div><div><div style={{ fontSize: 16, fontWeight: 700 }}>{option.label}</div><div style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>{option.description}</div></div><MetricRow label="Total cost" value={option.total_cost} /><MetricRow label="Timeline to value" value={option.timeline_to_value} /><MetricRow label="Risk-adjusted NPV" value={option.npv_3yr_risk_adjusted} /><MetricRow label="Probability of ROI target" value={option.probability_of_achieving_roi_target} color={option.recommended ? 'var(--success)' : 'var(--text-secondary)'} /><div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>Key condition: {option.key_condition}</div></div>)}</div><div style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: props.options.find((option) => option.recommended)?.option === 'B' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)', border: props.options.find((option) => option.recommended)?.option === 'B' ? '1px solid rgba(16, 185, 129, 0.24)' : '1px solid rgba(245, 158, 11, 0.24)', marginBottom: 18 }}><div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>ASIS RECOMMENDATION</div><div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>{props.verdict}</div></div><div style={{ height: 280 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="M" /><Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} /><Bar dataKey="npv" radius={[6, 6, 0, 0]}>{chartData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div></div>;
}
