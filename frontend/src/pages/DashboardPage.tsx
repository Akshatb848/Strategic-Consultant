import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3,
  ChevronRight,
  FileText,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import { analysesAPI } from '../lib/apiClient';

interface AnalysisSummary {
  id: string;
  problemStatement: string;
  status: string;
  overallConfidence: number | null;
  decisionRecommendation: string | null;
  originalRecommendation?: string | null;
  recommendationDowngraded?: boolean;
  fatalInvalidationCount?: number;
  majorInvalidationCount?: number;
  recommendedOption?: string | null;
  buildVsBuyVerdict?: string | null;
  createdAt: string;
  durationSeconds: number | null;
  organisationContext: string;
  industryContext: string;
  geographyContext?: string;
  decisionType?: string;
  agentsCompleted: number;
  agentsTotal: number;
}

function normalizedPercent(value: number | null | undefined) {
  if (value == null) return null;
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function confidenceColor(value: number | null | undefined) {
  const score = normalizedPercent(value);
  if (score == null) return '#94a3b8';
  if (score >= 82) return '#34d399';
  if (score >= 70) return '#fbbf24';
  if (score >= 60) return '#fb923c';
  return '#f87171';
}

function decisionColor(value: string | null | undefined) {
  if (value === 'PROCEED') return '#34d399';
  if (value === 'HOLD') return '#fbbf24';
  if (value === 'ESCALATE' || value === 'REJECT') return '#f87171';
  return '#94a3b8';
}

function contextSummary(analysis: AnalysisSummary) {
  return [analysis.organisationContext, analysis.industryContext, analysis.geographyContext, analysis.decisionType]
    .filter(Boolean)
    .join(' · ');
}

function formatRuntime(seconds: number | null) {
  if (seconds == null) return null;
  if (seconds < 60) return `${Math.round(seconds)}s runtime`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s runtime`;
}

function optionLabel(option: string | null | undefined) {
  if (!option) return null;
  if (option === 'A') return 'A — Full Acquisition';
  if (option === 'B') return 'B — Minority';
  if (option === 'C') return 'C — Build';
  return option;
}

function optionTone(option: string | null | undefined) {
  if (option === 'A') return { border: 'rgba(251, 191, 36, 0.32)', background: 'rgba(251, 191, 36, 0.12)', color: '#fde68a' };
  if (option === 'B') return { border: 'rgba(52, 211, 153, 0.32)', background: 'rgba(52, 211, 153, 0.12)', color: '#bbf7d0' };
  if (option === 'C') return { border: 'rgba(96, 165, 250, 0.32)', background: 'rgba(96, 165, 250, 0.12)', color: '#bfdbfe' };
  return { border: 'rgba(148, 163, 184, 0.24)', background: 'rgba(148, 163, 184, 0.10)', color: '#cbd5e1' };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;

    void analysesAPI
      .list({ limit: 50 })
      .then(({ data }) => {
        if (!active) return;
        setAnalyses(data.analyses || []);
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setError('Unable to load your analyses right now.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return analyses;
    const needle = search.trim().toLowerCase();
    return analyses.filter((analysis) => {
      return (
        analysis.problemStatement.toLowerCase().includes(needle) ||
        contextSummary(analysis).toLowerCase().includes(needle)
      );
    });
  }, [analyses, search]);

  const completed = analyses.filter((item) => item.status === 'completed').length;
  const confidenceValues = analyses
    .map((item) => normalizedPercent(item.overallConfidence))
    .filter((value): value is number => value != null);
  const avgConfidence = confidenceValues.length
    ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
    : null;
  const proceedCount = analyses.filter((item) => item.decisionRecommendation === 'PROCEED').length;

  const stats = [
    { label: 'Total analyses', value: String(analyses.length), detail: 'All strategic decisions', icon: FileText },
    { label: 'Completed', value: String(completed), detail: 'Finished briefs', icon: TrendingUp },
    { label: 'Avg confidence', value: avgConfidence != null ? `${avgConfidence}%` : '--', detail: 'Across completed runs', icon: BarChart3 },
    { label: 'PROCEED verdicts', value: String(proceedCount), detail: 'Positive recommendations', icon: Sparkles },
  ];

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Strategist';

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <section
          style={{
            borderRadius: 30,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(14, 23, 39, 0.95), rgba(10, 18, 34, 0.92))',
            padding: 24,
            boxShadow: '0 28px 80px rgba(0,0,0,0.38)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#94a3b8' }}>
                Strategic Dashboard
              </div>
              <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.05em', color: '#fff' }}>
                Welcome back, {displayName}
              </h1>
              <p style={{ maxWidth: 960, fontSize: 14, lineHeight: 1.9, color: '#94a3b8' }}>
                Search prior analyses, monitor verdict quality, and start a new board-level decision review from the workspace below.
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 360 }}>
                <Search size={15} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search analyses"
                  className="form-input"
                  style={{
                    width: '100%',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.04)',
                    borderColor: 'rgba(255,255,255,0.10)',
                    paddingLeft: 44,
                    color: '#e2e8f0',
                  }}
                />
              </div>

              <Link
                to="/analysis/new"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderRadius: 999,
                  background: '#fff',
                  color: '#020617',
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: 'none',
                  padding: '12px 20px',
                }}
              >
                <Plus size={16} />
                New Strategic Analysis
              </Link>
            </div>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
          <div className="grid-4" style={{ alignSelf: 'start' }}>
            {stats.map(({ label, value, detail, icon: Icon }) => (
              <article
                key={label}
                style={{
                  borderRadius: 26,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)',
                  padding: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#64748b' }}>
                      {label}
                    </div>
                    <div style={{ marginTop: 16, fontSize: 32, fontWeight: 700, letterSpacing: '-0.04em', color: '#fff' }}>
                      {value}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>{detail}</div>
                  </div>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 16,
                      display: 'grid',
                      placeItems: 'center',
                      background: 'rgba(103, 232, 249, 0.10)',
                      color: '#cffafe',
                    }}
                  >
                    <Icon size={18} />
                  </div>
                </div>
              </article>
            ))}
          </div>

          <Link
            to="/analysis/new"
            style={{
              borderRadius: 30,
              border: '1px solid rgba(103,232,249,0.18)',
              background: 'linear-gradient(145deg, rgba(16,171,231,0.20), rgba(10,18,34,0.95) 62%)',
              padding: 24,
              textDecoration: 'none',
              color: 'inherit',
              display: 'block',
              boxShadow: '0 25px 70px rgba(16,171,231,0.10)',
            }}
          >
            <div style={{ display: 'inline-flex', borderRadius: 999, border: '1px solid rgba(207,250,254,0.18)', background: 'rgba(103,232,249,0.10)', padding: '6px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#cffafe' }}>
              Launch
            </div>
            <h2 style={{ marginTop: 18, fontSize: 32, fontWeight: 700, letterSpacing: '-0.05em', color: '#fff' }}>New Strategic Analysis</h2>
            <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.9, color: '#cbd5e1' }}>
              Enter the question, organisation, industry, geography, and decision type. ASIS will run the full multi-agent debate and return a board-ready recommendation.
            </p>
            <div style={{ marginTop: 28, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#cffafe' }}>
              Start now
              <ChevronRight size={16} />
            </div>
          </Link>
        </section>

        <section
          style={{
            borderRadius: 30,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(7, 16, 27, 0.92)',
            padding: 24,
          }}
        >
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#64748b' }}>
                Recent analyses
              </div>
              <h2 style={{ marginTop: 8, fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', color: '#fff' }}>
                Your decision archive
              </h2>
            </div>
            <div style={{ fontSize: 14, color: '#64748b' }}>{filtered.length} visible</div>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {[1, 2, 3].map((index) => (
                <div key={index} className="skeleton" style={{ height: 112, borderRadius: 24 }} />
              ))}
            </div>
          ) : error ? (
            <div
              style={{
                borderRadius: 24,
                border: '1px solid rgba(248, 113, 113, 0.22)',
                background: 'rgba(248, 113, 113, 0.10)',
                padding: '20px 24px',
                fontSize: 14,
                color: '#fecaca',
              }}
            >
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                borderRadius: 24,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                padding: '48px 24px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>No matching analyses</div>
              <div style={{ marginTop: 8, fontSize: 14, color: '#94a3b8' }}>
                Start a new strategic review to populate the dashboard.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {filtered.map((analysis, index) => {
                const option = optionLabel(analysis.recommendedOption);
                const tone = optionTone(analysis.recommendedOption);
                const fatalCount = analysis.fatalInvalidationCount || 0;
                const majorCount = analysis.majorInvalidationCount || 0;
                const confidence = normalizedPercent(analysis.overallConfidence);
                return (
                  <motion.div
                    key={analysis.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <Link
                      to={`/analysis/${analysis.id}`}
                      style={{
                        display: 'block',
                        borderRadius: 26,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.03)',
                        padding: 20,
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                              <span className={`badge badge-${analysis.status}`}>{analysis.status}</span>
                              {analysis.decisionRecommendation ? (
                                <span
                                  style={{
                                    borderRadius: 999,
                                    border: `1px solid ${decisionColor(analysis.decisionRecommendation)}33`,
                                    background: `${decisionColor(analysis.decisionRecommendation)}14`,
                                    color: decisionColor(analysis.decisionRecommendation),
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: '0.14em',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {analysis.decisionRecommendation}
                                </span>
                              ) : null}
                              {analysis.recommendationDowngraded && analysis.originalRecommendation && analysis.decisionRecommendation ? (
                                <span style={{ fontSize: 12, color: '#cbd5e1' }}>
                                  <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>{analysis.originalRecommendation}</span> → {analysis.decisionRecommendation}
                                </span>
                              ) : null}
                            </div>

                            <h3 style={{ marginTop: 14, fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em', color: '#fff' }}>
                              {analysis.problemStatement}
                            </h3>

                            <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.8, color: '#94a3b8' }}>
                              {contextSummary(analysis) || 'Strategic review in progress'}
                            </p>

                            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: '#64748b' }}>
                              <span>{new Date(analysis.createdAt).toLocaleDateString()}</span>
                              {formatRuntime(analysis.durationSeconds) ? <span>{formatRuntime(analysis.durationSeconds)}</span> : null}
                              {analysis.status === 'running' || analysis.status === 'queued' ? (
                                <span>{analysis.agentsCompleted}/{analysis.agentsTotal} agents complete</span>
                              ) : null}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, minWidth: 180 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#64748b' }}>
                                Confidence
                              </div>
                              <div style={{ marginTop: 8, fontSize: 32, fontWeight: 700, letterSpacing: '-0.04em', color: confidenceColor(analysis.overallConfidence) }}>
                                {confidence != null ? `${confidence}%` : '--'}
                              </div>
                            </div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#cbd5e1' }}>
                              Open analysis
                              <ChevronRight size={16} />
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {fatalCount > 0 ? (
                            <span style={{ borderRadius: 999, padding: '6px 10px', background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.28)', color: '#fecaca', fontSize: 11, fontWeight: 700 }}>
                              ⚔ {fatalCount} fatal
                            </span>
                          ) : majorCount > 0 ? (
                            <span style={{ borderRadius: 999, padding: '6px 10px', background: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.28)', color: '#fde68a', fontSize: 11, fontWeight: 700 }}>
                              ⚔ {majorCount} major
                            </span>
                          ) : (
                            <span style={{ borderRadius: 999, padding: '6px 10px', background: 'rgba(52,211,153,0.14)', border: '1px solid rgba(52,211,153,0.28)', color: '#bbf7d0', fontSize: 11, fontWeight: 700 }}>
                              ✓ Validated
                            </span>
                          )}

                          {option ? (
                            <span
                              style={{
                                borderRadius: 999,
                                padding: '6px 10px',
                                border: `1px solid ${tone.border}`,
                                background: tone.background,
                                color: tone.color,
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {option}
                            </span>
                          ) : null}
                        </div>

                        {analysis.buildVsBuyVerdict ? (
                          <div
                            style={{
                              borderRadius: 18,
                              border: '1px solid rgba(255,255,255,0.08)',
                              background: 'rgba(255,255,255,0.03)',
                              padding: '14px 16px',
                              fontSize: 13,
                              lineHeight: 1.75,
                              color: '#cbd5e1',
                            }}
                          >
                            {analysis.buildVsBuyVerdict}
                          </div>
                        ) : null}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
