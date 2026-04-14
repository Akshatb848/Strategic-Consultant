import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Zap, Mail, Lock, User, Building2, ArrowRight, AlertCircle } from 'lucide-react';

export default function SignupPage() {
  const { signup, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillQuestion = searchParams.get('q');

  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    title: '',
    organisation: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await signup(form);
    setLoading(false);
    if (result.success) {
      navigate(prefillQuestion ? `/analysis/new?q=${encodeURIComponent(prefillQuestion)}` : '/dashboard');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="gradient-orb orb-1" style={{ background: '#8b5cf6' }} />
        <div className="gradient-orb orb-2" style={{ background: '#6366f1' }} />
      </div>

      <motion.div className="auth-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 460 }}>
        <div className="auth-logo">
          <Zap size={28} color="#6366f1" />
          <h1>ASIS</h1>
          <span className="version-chip">v4.0</span>
        </div>

        <h2 className="auth-title">Create your account</h2>
        <p className="auth-subtitle">Create your ASIS strategic workspace — free to start</p>

        {prefillQuestion && (
          <div style={{ padding: '12px 16px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: 13, color: 'var(--accent-secondary)' }}>
            Your analysis will run after signup: <strong style={{ color: 'var(--text-primary)' }}>"{prefillQuestion.slice(0, 100)}{prefillQuestion.length > 100 ? '...' : ''}"</strong>
          </div>
        )}

        {error && (
          <div className="auth-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">First Name</label>
              <div className="input-with-icon">
                <User size={16} className="input-icon" />
                <input className="form-input" style={{ paddingLeft: 40, width: '100%' }} placeholder="First name" value={form.firstName} onChange={handleChange('firstName')} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input className="form-input" style={{ width: '100%' }} placeholder="Last name" value={form.lastName} onChange={handleChange('lastName')} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Work Email</label>
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" />
              <input className="form-input" style={{ paddingLeft: 40, width: '100%' }} type="email" placeholder="you@company.com" value={form.email} onChange={handleChange('email')} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input className="form-input" style={{ paddingLeft: 40, width: '100%' }} type="password" placeholder="Min. 8 characters" value={form.password} onChange={handleChange('password')} required minLength={8} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Title (Optional)</label>
              <input className="form-input" style={{ width: '100%' }} placeholder="e.g. Senior Partner" value={form.title} onChange={handleChange('title')} />
            </div>
            <div className="form-group">
              <label className="form-label">Organisation (Optional)</label>
              <div className="input-with-icon">
                <Building2 size={16} className="input-icon" />
                <input className="form-input" style={{ paddingLeft: 40, width: '100%' }} placeholder="Company name" value={form.organisation} onChange={handleChange('organisation')} />
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <span className="loading-spinner" style={{ width: 18, height: 18 }} /> : 'Create Account'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
