import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Zap, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function LoginPage() {
  const { login, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthError, setOauthError] = useState('');

  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'google_failed') setOauthError('Google sign-in failed. Please try again or use email.');
    if (err === 'github_failed') setOauthError('GitHub sign-in failed. Please try again or use email.');
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setPassword('');
      // Focus password field after error
      setTimeout(() => document.getElementById('password-input')?.focus(), 100);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
      </div>

      <motion.div className="auth-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="auth-logo">
          <Zap size={28} color="#6366f1" />
          <h1>ASIS</h1>
          <span className="version-chip">v4.0</span>
        </div>

        <h2 className="auth-title">Welcome back</h2>
        <p className="auth-subtitle">Sign in to your Silicon Consultancy account</p>

        {(error || oauthError) && (
          <div className="auth-error">
            <AlertCircle size={16} />
            <span>{error || oauthError}</span>
          </div>
        )}

        {/* OAuth Buttons */}
        <div className="oauth-buttons">
          <button
            className="btn btn-google btn-full"
            onClick={() => window.location.href = `${API_URL}/api/auth/google`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
          <button
            className="btn btn-github btn-full"
            onClick={() => window.location.href = `${API_URL}/api/auth/github`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            Continue with GitHub
          </button>
        </div>

        <div className="auth-divider">
          <span>or sign in with email</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="email-input">Email</label>
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" />
              <input
                id="email-input"
                type="email"
                className="form-input"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError(); }}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">Password</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                id="password-input"
                type="password"
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearError(); }}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading || !email || !password}>
            {loading ? <span className="loading-spinner" style={{ width: 18, height: 18 }} /> : 'Sign In'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account? <Link to="/signup">Create one</Link>
        </p>
      </motion.div>

      <style>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        .auth-bg { position: absolute; inset: 0; pointer-events: none; }
        .auth-bg .gradient-orb { position: absolute; border-radius: 50%; filter: blur(120px); opacity: 0.06; }
        .auth-bg .orb-1 { width: 600px; height: 600px; background: #6366f1; top: -20%; right: -10%; }
        .auth-bg .orb-2 { width: 500px; height: 500px; background: #8b5cf6; bottom: -20%; left: -10%; }

        .auth-card {
          position: relative;
          width: 100%;
          max-width: 420px;
          background: rgba(22, 27, 34, 0.8);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(99, 102, 241, 0.15);
          border-radius: var(--radius-xl);
          padding: 40px;
        }

        .auth-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 32px;
        }

        .auth-logo h1 {
          font-size: 24px;
          font-weight: 800;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .auth-title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
        .auth-subtitle { font-size: 14px; color: var(--text-secondary); margin-bottom: 24px; }

        .auth-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: var(--danger-bg);
          border: 1px solid rgba(248, 113, 113, 0.2);
          border-radius: var(--radius-md);
          color: var(--danger);
          font-size: 13px;
          margin-bottom: 16px;
        }

        .oauth-buttons { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }

        .auth-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          color: var(--text-muted);
          font-size: 12px;
        }

        .auth-divider::before, .auth-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
        }

        .auth-form { display: flex; flex-direction: column; gap: 16px; }

        .input-with-icon {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }

        .input-with-icon .form-input { padding-left: 40px; width: 100%; }

        .auth-footer {
          text-align: center;
          margin-top: 24px;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .auth-footer a {
          color: var(--accent-secondary);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
