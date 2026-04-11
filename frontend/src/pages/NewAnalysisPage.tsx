import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { analysesAPI } from '../lib/apiClient';
import { Zap, ArrowRight, Sparkles, Brain, BarChart3, Shield, Crosshair, Scale, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const EXAMPLE_QUESTIONS = [
  'Should Deloitte India invest in building an AI-powered audit platform to compete with PwC\'s existing offering in the South Asian market?',
  'Should HDFC Bank restructure its digital banking division to defend against Neobank competitors like Jupiter and Fi in India?',
  'Should Infosys acquire a mid-size European cybersecurity firm to strengthen its Security Services offering?',
  'Should a $500M professional services firm enter the Middle East market through a joint venture or greenfield operation?',
];

const PIPELINE_STEPS = [
  { icon: Brain, name: 'Strategist', desc: 'MECE decomposition' },
  { icon: BarChart3, name: 'Quant', desc: 'Financial models' },
  { icon: Crosshair, name: 'Market Intel', desc: 'PESTLE + Porter\'s' },
  { icon: Shield, name: 'Risk', desc: 'COSO ERM register' },
  { icon: Crosshair, name: 'Red Team', desc: 'Adversarial review' },
  { icon: Scale, name: 'Ethicist', desc: 'ESG guardrails' },
  { icon: CheckCircle, name: 'CoVe', desc: 'Fact-check' },
  { icon: Sparkles, name: 'Synthesis', desc: 'Board report' },
];

export default function NewAnalysisPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [question, setQuestion] = useState(searchParams.get('q') || '');
  const [loading, setLoading] = useState(false);
  const charCount = question.length;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (question.trim().length < 20) {
      toast.error('Please enter a more detailed question (min. 20 characters).');
      return;
    }

    setLoading(true);
    try {
      const { data } = await analysesAPI.create(question.trim());
      toast.success('Analysis started!');
      navigate(`/analysis/${data.analysis.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create analysis.');
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="page-header" style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
          <Zap size={28} color="#6366f1" />
          <h1 className="page-title">New Strategic Analysis</h1>
        </div>
        <p className="page-subtitle">
          Describe your strategic question and 8 specialist AI agents will produce a board-ready intelligence report.
        </p>
      </div>

      <motion.form
        onSubmit={handleSubmit}
        className="card-glass"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 700, margin: '0 auto', padding: 32 }}
      >
        <div className="form-group">
          <label className="form-label" style={{ fontSize: 14, fontWeight: 600 }}>Strategic Question</label>
          <textarea
            className="form-input"
            placeholder={`e.g., "Should Deloitte India invest in building an AI-powered audit platform to compete with PwC's existing offering in the South Asian market?"`}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            style={{ minHeight: 140, fontSize: 15, lineHeight: 1.7 }}
            autoFocus
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: charCount < 20 ? 'var(--danger)' : 'var(--text-muted)' }}>
              {charCount < 20 ? `${20 - charCount} more characters needed` : '✓ Ready'}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>{charCount}/5000</span>
          </div>
        </div>

        <div style={{ margin: '20px 0', padding: '16px', background: 'rgba(99, 102, 241, 0.04)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            For best results, include:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
            <div>✦ Organisation name</div>
            <div>✦ Industry/sector</div>
            <div>✦ Geography/market</div>
            <div>✦ Decision type (invest, acquire, exit...)</div>
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading || charCount < 20}>
          {loading ? (
            <><span className="loading-spinner" style={{ width: 18, height: 18 }} /> Deploying 8 Agents...</>
          ) : (
            <>Launch Analysis <ArrowRight size={18} /></>
          )}
        </button>
      </motion.form>

      {/* Example Questions */}
      <div style={{ maxWidth: 700, margin: '32px auto 0' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Example strategic questions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {EXAMPLE_QUESTIONS.map((q, i) => (
            <motion.button
              key={i}
              className="card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              onClick={() => setQuestion(q)}
              style={{ cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--text-secondary)', transition: 'all 0.2s', padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 10 }}
            >
              <Sparkles size={14} style={{ marginTop: 2, flexShrink: 0, color: 'var(--accent-secondary)' }} />
              <span>{q}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Pipeline Steps */}
      <div style={{ maxWidth: 700, margin: '40px auto 0' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
          8-agent pipeline
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PIPELINE_STEPS.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(99, 102, 241, 0.06)', borderRadius: 8, border: '1px solid rgba(99, 102, 241, 0.1)' }}>
              <s.icon size={14} color="var(--accent-secondary)" />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-accent)' }}>{s.name}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>· {s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
