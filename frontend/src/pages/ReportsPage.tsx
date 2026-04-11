import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { reportsAPI } from '../lib/apiClient';
import { FileText, Search, Clock } from 'lucide-react';

export default function ReportsPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadReports();
  }, [search]);

  const loadReports = async () => {
    try {
      const { data } = await reportsAPI.list({ search: search || undefined, limit: 50 });
      setReports(data.reports);
    } catch { /* handled */ }
    finally { setLoading(false); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Completed strategic intelligence reports</p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ position: 'relative', maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 40, width: '100%' }}
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <FileText size={48} color="var(--text-muted)" style={{ marginBottom: 16 }} />
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>No reports yet</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Completed analyses will appear here as board-ready reports.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reports.map((r, i) => (
            <motion.div
              key={r.id}
              className="card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/analysis/${r.id}`)}
              style={{ cursor: 'pointer', padding: '18px 20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'start', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.problemStatement}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                    {r.organisationContext && <span>🏢 {r.organisationContext}</span>}
                    {r.industryContext && <span>🏭 {r.industryContext}</span>}
                    <span><Clock size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />{formatDate(r.completedAt!)}</span>
                    {r.pipelineVersion && <span className="badge badge-accent" style={{ fontSize: 9 }}>v{r.pipelineVersion}</span>}
                  </div>
                  {r.boardNarrative && (
                    <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                      {r.boardNarrative}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  {r.overallConfidence && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 22, color: r.overallConfidence > 80 ? 'var(--success)' : r.overallConfidence > 65 ? 'var(--warning)' : 'var(--danger)' }}>
                      {Math.round(r.overallConfidence)}%
                    </div>
                  )}
                  {r.decisionRecommendation && (
                    <span className={`badge badge-${r.decisionRecommendation.toLowerCase()}`}>{r.decisionRecommendation}</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
