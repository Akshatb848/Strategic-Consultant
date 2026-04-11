import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from '../components/AppLayout';
import { analysesAPI } from '../lib/apiClient';
import { Plus, Clock, CheckCircle, Activity, FileText, ArrowRight, Zap, TrendingUp } from 'lucide-react';

interface AnalysisSummary {
  id: string;
  problemStatement: string;
  status: string;
  overallConfidence: number | null;
  decisionRecommendation: string | null;
  agentsCompleted: number;
  agentsTotal: number;
  createdAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  organisationContext: string;
  industryContext: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadAnalyses();
  }, []);

  const loadAnalyses = async () => {
    try {
      const { data } = await analysesAPI.list({ limit: 20, offset: 0 });
      setAnalyses(data.analyses);
      setTotal(data.total);
    } catch {
      // Silently fail — user sees empty state
    } finally {
      setLoading(false);
    }
  };

  const completedCount = analyses.filter((a) => a.status === 'completed').length;
  const runningCount = analyses.filter((a) => a.status === 'running' || a.status === 'queued').length;

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      completed: 'badge-completed', running: 'badge-running', queued: 'badge-running',
      failed: 'badge-failed', pending: 'badge-pending',
    };
    return `badge ${map[status] || 'badge-pending'}`;
  };

  const decisionBadge = (rec: string | null) => {
    if (!rec) return '';
    const map: Record<string, string> = {
      PROCEED: 'badge-proceed', HOLD: 'badge-hold',
      ESCALATE: 'badge-escalate', REJECT: 'badge-reject',
    };
    return `badge ${map[rec] || 'badge-pending'}`;
  };

  const formatTime = (seconds: number | null) => {
    if (!seconds) return '—';
    return seconds < 60 ? `${Math.floor(seconds)}s` : `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  };

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">Welcome back, {user?.firstName} 👋</h1>
        <p className="page-subtitle">Your strategic intelligence dashboard</p>
      </div>

      {/* Stats Cards */}
      <motion.div className="grid-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
            <FileText size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Total Analyses</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{total}</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(52, 211, 153, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Completed</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{completedCount}</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(96, 165, 250, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
            <Activity size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Running</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{runningCount}</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(139, 92, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Plan</div>
            <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{user?.plan || 'Free'}</div>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div style={{ marginTop: 32, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Recent Analyses</h2>
        <Link to="/analysis/new" className="btn btn-primary">
          <Plus size={16} /> New Analysis
        </Link>
      </div>

      {/* Analysis List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      ) : analyses.length === 0 ? (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', padding: 60 }}
        >
          <Zap size={48} color="#6366f1" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No analyses yet</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            Enter your first strategic question and let 8 specialist AI agents build your board-ready recommendation.
          </p>
          <Link to="/analysis/new" className="btn btn-primary btn-lg">
            <Plus size={18} /> Start Your First Analysis
          </Link>
        </motion.div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {analyses.map((a, i) => (
            <motion.div
              key={a.id}
              className="card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/analysis/${a.id}`)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                  {a.problemStatement}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                  {a.organisationContext && <span>{a.organisationContext}</span>}
                  {a.industryContext && <span>· {a.industryContext}</span>}
                  <span>· {new Date(a.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {a.status === 'running' && (
                  <div style={{ fontSize: 11, color: 'var(--info)' }}>
                    {a.agentsCompleted}/{a.agentsTotal} agents
                  </div>
                )}
                {a.overallConfidence && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: a.overallConfidence > 80 ? 'var(--success)' : a.overallConfidence > 65 ? 'var(--warning)' : 'var(--danger)' }}>
                    {Math.round(a.overallConfidence)}%
                  </div>
                )}
                {a.decisionRecommendation && <span className={decisionBadge(a.decisionRecommendation)}>{a.decisionRecommendation}</span>}
                <span className={statusBadge(a.status)}>{a.status}</span>
                {a.durationSeconds && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} /> {formatTime(a.durationSeconds)}
                  </span>
                )}
                <ArrowRight size={16} color="var(--text-muted)" />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
