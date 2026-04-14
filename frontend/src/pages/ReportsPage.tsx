import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { reportsAPI } from '../lib/apiClient';
import { Clock, FileText, Search, Swords } from 'lucide-react';

type ReportRecord = {
  id: string;
  problemStatement: string;
  overallConfidence?: number | null;
  decisionRecommendation?: string | null;
  originalRecommendation?: string | null;
  recommendationDowngraded?: boolean;
  boardNarrative?: string | null;
  organisationContext?: string;
  industryContext?: string;
  geographyContext?: string;
  decisionType?: string;
  fatalInvalidationCount?: number;
  majorInvalidationCount?: number;
  recommendedOption?: string | null;
  buildVsBuyVerdict?: string | null;
  completedAt?: string | null;
  pipelineVersion?: string | null;
};

function getConfidenceColor(score: number) {
  if (score >= 82) return 'var(--success)';
  if (score >= 70) return 'var(--warning)';
  if (score >= 60) return '#f97316';
  return 'var(--danger)';
}

function optionLabel(option?: string | null) {
  if (option === 'A') return 'A - Full Acquisition';
  if (option === 'B') return 'B - Minority';
  if (option === 'C') return 'C - Build';
  return null;
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    void loadReports();
  }, [search]);

  const loadReports = async () => {
    try {
      const { data } = await reportsAPI.list({ search: search || undefined, limit: 50 });
      setReports(data.reports as ReportRecord[]);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Pending';

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Completed strategic intelligence reports with challenge and option metadata</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ position: 'relative', maxWidth: 420 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" style={{ paddingLeft: 40, width: '100%' }} placeholder="Search reports..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((index) => <div key={index} className="skeleton" style={{ height: 90, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <FileText size={48} color="var(--text-muted)" style={{ marginBottom: 16 }} />
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>No reports yet</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Completed analyses will appear here as board-ready reports.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.map((report, index) => {
            const option = optionLabel(report.recommendedOption);
            const fatalCount = report.fatalInvalidationCount || 0;
            const majorCount = report.majorInvalidationCount || 0;
            return (
              <motion.div
                key={report.id}
                className="card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => navigate(`/analysis/${report.id}`)}
                style={{ cursor: 'pointer', padding: '18px 20px' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {report.problemStatement}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                      {report.organisationContext ? <span>{report.organisationContext}</span> : null}
                      {report.industryContext ? <span>{report.industryContext}</span> : null}
                      {report.geographyContext ? <span>{report.geographyContext}</span> : null}
                      <span><Clock size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />{formatDate(report.completedAt)}</span>
                      {report.pipelineVersion ? <span className="badge badge-accent" style={{ fontSize: 9 }}>v{report.pipelineVersion}</span> : null}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                      {fatalCount > 0 ? <span className="badge badge-reject"><Swords size={10} /> {fatalCount} fatal</span> : majorCount > 0 ? <span className="badge badge-hold"><Swords size={10} /> {majorCount} major</span> : <span className="badge badge-completed">Validated</span>}
                      {option ? <span className="badge badge-accent">{option}</span> : null}
                      {report.recommendationDowngraded && report.originalRecommendation && report.decisionRecommendation ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}><span style={{ textDecoration: 'line-through', opacity: 0.7 }}>{report.originalRecommendation}</span> → {report.decisionRecommendation}</span> : null}
                    </div>

                    {report.boardNarrative ? (
                      <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                        {report.boardNarrative}
                      </p>
                    ) : null}
                    {report.buildVsBuyVerdict ? (
                      <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        {report.buildVsBuyVerdict}
                      </p>
                    ) : null}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, minWidth: 96 }}>
                    {typeof report.overallConfidence === 'number' ? (
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 22, color: getConfidenceColor(report.overallConfidence) }}>
                        {Math.round(report.overallConfidence)}%
                      </div>
                    ) : null}
                    {report.decisionRecommendation ? (
                      <span className={`badge badge-${report.decisionRecommendation.toLowerCase()}`}>
                        {report.decisionRecommendation}
                      </span>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
