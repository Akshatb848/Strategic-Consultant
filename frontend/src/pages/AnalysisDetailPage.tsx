import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { analysesAPI } from '../lib/apiClient';
import { subscribeToAnalysis } from '../lib/socketClient';
import type { PipelineEvent } from '../lib/socketClient';
import { Brain, BarChart3, Shield, Crosshair, Scale, CheckCircle, Sparkles, Clock, AlertTriangle, Activity } from 'lucide-react';
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';

const AGENT_META: Record<string, { icon: any, color: string, label: string }> = {
  strategist: { icon: Brain, color: '#6366f1', label: 'Strategist' },
  quant: { icon: BarChart3, color: '#10b981', label: 'Quant' },
  market_intel: { icon: Crosshair, color: '#3b82f6', label: 'Market Intel' },
  risk: { icon: Shield, color: '#f59e0b', label: 'Risk' },
  red_team: { icon: Crosshair, color: '#ef4444', label: 'Red Team' },
  ethicist: { icon: Scale, color: '#8b5cf6', label: 'Ethicist' },
  cove: { icon: CheckCircle, color: '#14b8a6', label: 'CoVe Verifier' },
  synthesis: { icon: Sparkles, color: '#ec4899', label: 'Synthesis' },
};

const AGENT_ORDER = ['strategist', 'quant', 'market_intel', 'risk', 'red_team', 'ethicist', 'cove', 'synthesis'];

export default function AnalysisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pipelineEvents, setPipelineEvents] = useState<PipelineEvent[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAnalysis();
  }, [id]);

  useEffect(() => {
    if (!id || analysis?.status === 'completed' || analysis?.status === 'failed') return;

    const unsub = subscribeToAnalysis(
      id,
      (event) => {
        setPipelineEvents((prev) => [...prev, event]);
        if (event.status === 'completed') {
          loadAnalysis(); // Reload to get latest agent data
        }
      },
      () => {
        loadAnalysis(); // Full reload on pipeline complete
      }
    );

    return unsub;
  }, [id, analysis?.status]);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pipelineEvents]);

  const loadAnalysis = async () => {
    if (!id) return;
    try {
      const { data } = await analysesAPI.get(id);
      setAnalysis(data.analysis);
    } catch { /* handled by empty state */ }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      </AppLayout>
    );
  }

  if (!analysis) {
    return (
      <AppLayout>
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <AlertTriangle size={40} color="var(--warning)" style={{ marginBottom: 16 }} />
          <h2>Analysis not found</h2>
        </div>
      </AppLayout>
    );
  }

  const isRunning = analysis.status === 'running' || analysis.status === 'queued';
  const isComplete = analysis.status === 'completed';

  // Build confidence radar data
  const radarData = AGENT_ORDER.filter(a => {
    const d = analysis[`${a === 'cove' ? 'coveVerification' : a}Data`];
    return d && (d.confidence_score || d.overall_verification_score || d.overall_confidence);
  }).map(a => {
    const d = analysis[`${a === 'cove' ? 'coveVerification' : a}Data`];
    return {
      agent: AGENT_META[a].label,
      confidence: d.confidence_score || d.overall_verification_score || d.overall_confidence || 0,
    };
  });

  // Heat map data from risk agent
  const heatMapData = analysis.riskData?.heat_map_data || [];

  // Investment scenarios from quant agent
  const investmentData = analysis.quantData?.investment_scenarios?.map((s: any) => ({
    name: s.scenario.replace(/\(.*\)/, '').trim().split(' ').slice(0, 2).join(' '),
    payback: s.payback_months,
    roi: parseFloat(s.roi_3yr),
    success: s.probability_of_success,
  })) || [];

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'agents', label: 'Agent Outputs' },
    { key: 'visualizations', label: 'Visualizations' },
  ];

  return (
    <AppLayout>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span className={`badge badge-${analysis.status}`}>{analysis.status}</span>
          {analysis.decisionRecommendation && (
            <span className={`badge badge-${analysis.decisionRecommendation?.toLowerCase()}`}>{analysis.decisionRecommendation}</span>
          )}
          {analysis.durationSeconds && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={14} /> {analysis.durationSeconds < 60 ? `${Math.round(analysis.durationSeconds)}s` : `${Math.floor(analysis.durationSeconds / 60)}m ${Math.round(analysis.durationSeconds % 60)}s`}
            </span>
          )}
        </div>
        <h1 className="page-title" style={{ fontSize: 22 }}>{analysis.problemStatement}</h1>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
          {analysis.organisationContext && <span>🏢 {analysis.organisationContext}</span>}
          {analysis.industryContext && <span>🏭 {analysis.industryContext}</span>}
          {analysis.geographyContext && <span>🌍 {analysis.geographyContext}</span>}
          {analysis.decisionType && <span>📋 {analysis.decisionType}</span>}
        </div>
      </div>

      {/* Confidence + Stats */}
      {isComplete && analysis.overallConfidence && (
        <motion.div className="grid-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <ConfidenceRing value={Math.round(analysis.overallConfidence)} />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Overall Confidence</div>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Agents Completed</span>
              <span style={{ fontWeight: 700 }}>{analysis.agentsCompleted}/{analysis.agentsTotal}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Self-Corrections</span>
              <span style={{ fontWeight: 700 }}>{analysis.selfCorrectionCount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Red Team Challenges</span>
              <span style={{ fontWeight: 700 }}>{analysis.redTeamChallengeCount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Logic Consistency</span>
              <span style={{ color: analysis.logicConsistencyPassed ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                {analysis.logicConsistencyPassed ? '✓ Passed' : '✗ Issues'}
              </span>
            </div>
          </div>
          <div className="card">
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>Board Narrative</div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              {analysis.boardNarrative || analysis.executiveSummary?.slice(0, 200)}
            </p>
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              color: activeTab === t.key ? 'var(--accent-secondary)' : 'var(--text-muted)',
              fontWeight: activeTab === t.key ? 700 : 500, fontSize: 13,
              borderBottom: activeTab === t.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {analysis.executiveSummary && (
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Executive Summary</h3>
              <p style={{ lineHeight: 1.8, color: 'var(--text-secondary)', fontSize: 14 }}>{analysis.executiveSummary}</p>
            </div>
          )}
          {analysis.synthesisData?.strategic_imperatives && (
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Strategic Imperatives</h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {analysis.synthesisData.strategic_imperatives.map((imp: string, i: number) => (
                  <li key={i} style={{ padding: '12px 16px', background: 'rgba(99, 102, 241, 0.04)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.08)', fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                    {imp}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analysis.synthesisData?.risk_adjusted_recommendation && (
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Risk-Adjusted Recommendation</h3>
              <p style={{ lineHeight: 1.8, color: 'var(--text-secondary)', fontSize: 14 }}>{analysis.synthesisData.risk_adjusted_recommendation}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'pipeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {AGENT_ORDER.map((agentId, i) => {
            const meta = AGENT_META[agentId];
            const Icon = meta.icon;
            const log = analysis.agentLogs?.find((l: any) => l.agentId === agentId);
            const isActiveAgent = analysis.currentAgent === agentId && isRunning;

            return (
              <motion.div
                key={agentId}
                className="card"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                  borderColor: isActiveAgent ? meta.color : undefined,
                  boxShadow: isActiveAgent ? `0 0 15px ${meta.color}22` : undefined,
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `${meta.color}18`, color: meta.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{meta.label}</div>
                  {log && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.durationMs}ms · {log.inputTokens + log.outputTokens} tokens</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {log?.confidenceScore && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: meta.color }}>
                      {Math.round(log.confidenceScore)}%
                    </span>
                  )}
                  {isActiveAgent ? (
                    <span className="badge badge-running"><Activity size={10} /> Running</span>
                  ) : log ? (
                    <span className={`badge ${log.selfCorrected ? 'badge-hold' : 'badge-completed'}`}>
                      {log.selfCorrected ? 'Fallback' : 'Done'}
                    </span>
                  ) : (
                    <span className="badge badge-pending">Pending</span>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Live pipeline events */}
          {pipelineEvents.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Live Events</h4>
              <div style={{ maxHeight: 200, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {pipelineEvents.map((e, i) => (
                  <div key={i} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                    <span style={{ color: 'var(--text-muted)', minWidth: 70 }}>{new Date(e.timestamp).toLocaleTimeString()}</span>
                    <span style={{ color: AGENT_META[e.agent]?.color || 'var(--text-secondary)' }}>{e.agent}</span>
                    <span>{e.status}{e.message ? ` — ${e.message}` : ''}</span>
                    {e.confidence && <span style={{ color: 'var(--success)' }}>{e.confidence}%</span>}
                  </div>
                ))}
                <div ref={eventsEndRef} />
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'agents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {AGENT_ORDER.map(agentId => {
            const dataKey = agentId === 'cove' ? 'coveVerificationData' : `${agentId}Data`;
            const agentData = analysis[dataKey];
            if (!agentData) return null;
            const meta = AGENT_META[agentId];

            return (
              <details key={agentId} className="card" style={{ cursor: 'pointer' }}>
                <summary style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
                  <meta.icon size={18} color={meta.color} />
                  {meta.label} Output
                  {agentData.confidence_score && <span className="badge badge-accent">{Math.round(agentData.confidence_score)}%</span>}
                </summary>
                <pre style={{
                  marginTop: 16, padding: 16, background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
                  overflow: 'auto', maxHeight: 400, fontSize: 12, fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)', lineHeight: 1.6,
                }}>
                  {JSON.stringify(agentData, null, 2)}
                </pre>
              </details>
            );
          })}
        </div>
      )}

      {activeTab === 'visualizations' && isComplete && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Confidence Radar */}
          {radarData.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Agent Confidence Radar</h3>
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="agent" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Radar name="Confidence" dataKey="confidence" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Investment Scenarios */}
          {investmentData.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Investment Scenarios — ROI Comparison</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={investmentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="%" />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="roi" name="ROI %" radius={[6, 6, 0, 0]}>
                    {investmentData.map((_: any, i: number) => (
                      <Cell key={i} fill={['#6366f1', '#10b981', '#f59e0b'][i % 3]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Risk Heat Map */}
          {heatMapData.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Risk Heat Map</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {heatMapData.map((r: any) => (
                  <div
                    key={r.risk_id}
                    style={{
                      padding: 16, borderRadius: 'var(--radius-md)', textAlign: 'center',
                      background: r.severity > 60 ? 'rgba(248, 113, 113, 0.15)' : r.severity > 30 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(52, 211, 153, 0.15)',
                      border: `1px solid ${r.severity > 60 ? 'rgba(248, 113, 113, 0.3)' : r.severity > 30 ? 'rgba(251, 191, 36, 0.3)' : 'rgba(52, 211, 153, 0.3)'}`,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 20, fontFamily: 'var(--font-mono)', color: r.severity > 60 ? 'var(--danger)' : r.severity > 30 ? 'var(--warning)' : 'var(--success)' }}>
                      {r.severity}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{r.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.risk_id}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitive Benchmarks */}
          {analysis.synthesisData?.competitive_benchmarks && (
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Competitive Benchmarks</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Dimension</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Our Score</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Industry Avg</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Leader</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.synthesisData.competitive_benchmarks.map((b: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(48, 54, 61, 0.3)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{b.dimension}</td>
                        <td style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-secondary)' }}>{b.our_score}</td>
                        <td style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-secondary)' }}>{b.industry_avg}</td>
                        <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                          <span style={{ fontWeight: 700 }}>{b.leader_score}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{b.named_leader}</span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--danger)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>-{b.gap_to_leader}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}

// ── Confidence Ring Component ────────────────────────────────────────────────
function ConfidenceRing({ value, size = 120 }: { value: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color = value >= 80 ? '#34d399' : value >= 65 ? '#fbbf24' : '#f87171';

  return (
    <div className="confidence-ring" style={{ width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={8} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={8} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <span className="value" style={{ color, fontSize: size / 4 }}>{value}</span>
    </div>
  );
}
