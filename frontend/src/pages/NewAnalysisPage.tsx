import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { analysesAPI, type ValidationWarning } from '../lib/apiClient';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle,
  Crosshair,
  Scale,
  Shield,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';

const EXAMPLE_QUESTIONS = [
  "Should Deloitte India invest in building an AI-powered audit platform to compete with PwC's existing offering in the South Asian market?",
  'Should HDFC Bank restructure its digital banking division to defend against Neobank competitors like Jupiter and Fi in India?',
  'Should Infosys acquire a mid-size European cybersecurity firm to strengthen its Security Services offering?',
  'Should a $500M professional services firm enter the Middle East market through a joint venture or greenfield operation?',
];

const PIPELINE_STEPS = [
  { icon: Brain, name: 'Strategist', desc: 'MECE decomposition' },
  { icon: BarChart3, name: 'Quant', desc: 'Financial models' },
  { icon: Crosshair, name: 'Market Intel', desc: "PESTLE + Porter's" },
  { icon: Shield, name: 'Risk', desc: 'COSO ERM register' },
  { icon: Crosshair, name: 'Red Team', desc: 'Adversarial review' },
  { icon: Scale, name: 'Ethicist', desc: 'ESG guardrails' },
  { icon: CheckCircle, name: 'CoVe', desc: 'Verification' },
  { icon: Sparkles, name: 'Synthesis', desc: 'Board report' },
];

function warningTone(severity: ValidationWarning['severity']) {
  if (severity === 'BLOCKING') {
    return {
      border: '1px solid rgba(239, 68, 68, 0.45)',
      background: 'rgba(239, 68, 68, 0.10)',
      titleColor: '#fca5a5',
      pillBackground: 'rgba(239, 68, 68, 0.18)',
      pillColor: '#fecaca',
    };
  }
  if (severity === 'MAJOR') {
    return {
      border: '1px solid rgba(245, 158, 11, 0.35)',
      background: 'rgba(245, 158, 11, 0.10)',
      titleColor: '#fcd34d',
      pillBackground: 'rgba(245, 158, 11, 0.18)',
      pillColor: '#fde68a',
    };
  }
  return {
    border: '1px solid rgba(59, 130, 246, 0.24)',
    background: 'rgba(59, 130, 246, 0.08)',
    titleColor: '#bfdbfe',
    pillBackground: 'rgba(59, 130, 246, 0.18)',
    pillColor: '#dbeafe',
  };
}

export default function NewAnalysisPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [question, setQuestion] = useState(searchParams.get('q') || '');
  const [loading, setLoading] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
  const [showReview, setShowReview] = useState(false);
  const charCount = question.length;

  const blockingWarnings = validationWarnings.filter((warning) => warning.severity === 'BLOCKING');
  const minorWarnings = validationWarnings.filter((warning) => warning.severity === 'MINOR');

  const createAnalysis = async (acknowledgedWarnings: boolean) => {
    const { data } = await analysesAPI.create(question.trim(), acknowledgedWarnings);
    toast.success('Analysis started.');
    navigate(`/analysis/${data.analysis.id}`);
  };

  const runValidation = async () => {
    const { data } = await analysesAPI.validate(question.trim());
    const warnings = data.validation?.warnings || [];
    setValidationWarnings(warnings);
    return warnings as ValidationWarning[];
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (question.trim().length < 20) {
      toast.error('Please enter a more detailed question (minimum 20 characters).');
      return;
    }

    setLoading(true);
    try {
      const warnings = await runValidation();
      const needsReview = warnings.some(
        (warning) => warning.severity === 'BLOCKING' || warning.severity === 'MAJOR'
      );

      if (needsReview) {
        setShowReview(true);
        setLoading(false);
        return;
      }

      await createAnalysis(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to validate the analysis prompt.');
      setLoading(false);
    }
  };

  const handleProceedWithCaveats = async () => {
    setLoading(true);
    try {
      await createAnalysis(true);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create analysis.');
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div
        className="page-header"
        style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto 32px' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <Zap size={28} color="#6366f1" />
          <h1 className="page-title">New Strategic Analysis</h1>
        </div>
        <p className="page-subtitle">
          Frame the board question, run a fast pre-flight sanity check, and then launch the
          8-agent pipeline with explicit caveats if the prompt itself is structurally weak.
        </p>
      </div>

      <motion.form
        onSubmit={handleSubmit}
        className="card-glass"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 760, margin: '0 auto', padding: 32 }}
      >
        <div className="form-group">
          <label className="form-label" style={{ fontSize: 14, fontWeight: 600 }}>
            Strategic Question
          </label>
          <textarea
            className="form-input"
            placeholder={`e.g., "Should Deloitte India invest in building an AI-powered audit platform to compete with PwC's existing offering in the South Asian market?"`}
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
              setShowReview(false);
            }}
            style={{ minHeight: 140, fontSize: 15, lineHeight: 1.7 }}
            autoFocus
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: charCount < 20 ? 'var(--danger)' : 'var(--text-muted)' }}>
              {charCount < 20 ? `${20 - charCount} more characters needed` : 'Ready for pre-flight review'}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>{charCount}/5000</span>
          </div>
        </div>

        <div
          style={{
            margin: '20px 0',
            padding: 16,
            background: 'rgba(99, 102, 241, 0.04)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(99, 102, 241, 0.1)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            For best results, include
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}
          >
            <div>- Organisation name</div>
            <div>- Industry or sector</div>
            <div>- Geography or market</div>
            <div>- Decision type (invest, acquire, exit...)</div>
          </div>
        </div>

        {minorWarnings.length > 0 && !showReview && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {minorWarnings.map((warning) => (
              <span
                key={warning.type}
                style={{
                  fontSize: 11,
                  color: '#bfdbfe',
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: 999,
                  padding: '6px 10px',
                }}
              >
                {warning.message}
              </span>
            ))}
          </div>
        )}

        {showReview && validationWarnings.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                border: '1px solid rgba(245, 158, 11, 0.35)',
                background:
                  blockingWarnings.length > 0
                    ? 'rgba(239, 68, 68, 0.10)'
                    : 'rgba(245, 158, 11, 0.10)',
                borderRadius: 'var(--radius-lg)',
                padding: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 8,
                  color: blockingWarnings.length > 0 ? '#fecaca' : '#fde68a',
                  fontWeight: 700,
                }}
              >
                <AlertTriangle size={18} />
                Ambiguous Analysis Parameters Detected
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                ASIS found structural issues in the problem statement that may weaken the final
                recommendation. You can edit the question now or proceed with caveats stored on the
                analysis record.
              </p>
            </div>

            {validationWarnings.map((warning) => {
              const tone = warningTone(warning.severity);
              return (
                <div
                  key={warning.type}
                  style={{
                    border: tone.border,
                    background: tone.background,
                    borderRadius: 'var(--radius-lg)',
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontWeight: 700,
                        color: tone.titleColor,
                      }}
                    >
                      {warning.severity === 'BLOCKING' ? <XCircle size={16} /> : <AlertTriangle size={16} />}
                      {warning.type}
                    </div>
                    <span
                      style={{
                        borderRadius: 999,
                        padding: '5px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        background: tone.pillBackground,
                        color: tone.pillColor,
                        letterSpacing: 0.4,
                      }}
                    >
                      {warning.severity}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                    {warning.message}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Suggested action: {warning.suggestion}
                  </div>
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowReview(false)}
                disabled={loading}
              >
                Edit Problem Statement
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleProceedWithCaveats}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="loading-spinner" style={{ width: 18, height: 18 }} />
                    Proceeding with caveats...
                  </>
                ) : (
                  <>Proceed with Caveats <ArrowRight size={16} /></>
                )}
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-full btn-lg"
          disabled={loading || charCount < 20}
        >
          {loading ? (
            <>
              <span className="loading-spinner" style={{ width: 18, height: 18 }} /> Running pre-flight...
            </>
          ) : (
            <>
              Launch Analysis <ArrowRight size={18} />
            </>
          )}
        </button>
      </motion.form>

      <div style={{ maxWidth: 760, margin: '32px auto 0' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 12,
          }}
        >
          Example strategic questions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {EXAMPLE_QUESTIONS.map((example, index) => (
            <motion.button
              key={index}
              className="card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              onClick={() => {
                setQuestion(example);
                setValidationWarnings([]);
                setShowReview(false);
              }}
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 13,
                color: 'var(--text-secondary)',
                transition: 'all 0.2s',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <Sparkles
                size={14}
                style={{ marginTop: 2, flexShrink: 0, color: 'var(--accent-secondary)' }}
              />
              <span>{example}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '40px auto 0' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 16,
          }}
        >
          8-agent pipeline
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PIPELINE_STEPS.map((step, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: 'rgba(99, 102, 241, 0.06)',
                borderRadius: 8,
                border: '1px solid rgba(99, 102, 241, 0.1)',
              }}
            >
              <step.icon size={14} color="var(--accent-secondary)" />
              <span
                style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-accent)' }}
              >
                {step.name}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>- {step.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
