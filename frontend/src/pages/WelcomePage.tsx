import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, ArrowDown, Shield, Brain, BarChart3, Scale, Crosshair, CheckCircle } from 'lucide-react';

const TYPEWRITER_ROLES = [
  'a McKinsey Senior Partner',
  'a Board-Level Strategist',
  'a Chief Risk Officer',
  'a Strategy Director',
  'a Bain & Company Advisor',
];

const AGENT_NODES = [
  { id: 'strategist', name: 'Strategist', icon: Brain, framework: 'Minto Pyramid + MECE', color: '#6366f1' },
  { id: 'quant', name: 'Quant', icon: BarChart3, framework: 'Monte Carlo + NPV/IRR', color: '#10b981' },
  { id: 'market_intel', name: 'Market Intel', icon: Crosshair, framework: 'PESTLE + Porter\'s 5', color: '#3b82f6' },
  { id: 'risk', name: 'Risk', icon: Shield, framework: 'COSO ERM 2017', color: '#f59e0b' },
  { id: 'red_team', name: 'Red Team', icon: Crosshair, framework: 'Pre-mortem Analysis', color: '#ef4444' },
  { id: 'ethicist', name: 'Ethicist', icon: Scale, framework: 'ESG + Brand Guardrails', color: '#8b5cf6' },
  { id: 'cove', name: 'CoVe Verifier', icon: CheckCircle, framework: 'Chain-of-Verification', color: '#14b8a6' },
  { id: 'synthesis', name: 'Synthesis', icon: Zap, framework: 'Balanced Scorecard', color: '#ec4899' },
];

const FRAMEWORKS = [
  'McKinsey 7-S', 'COSO ERM', 'Porter\'s Five Forces', 'NIST CSF 2.0', 'Balanced Scorecard', 'Monte Carlo',
];

export default function WelcomePage() {
  const [currentRole, setCurrentRole] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Typewriter effect
  useEffect(() => {
    const role = TYPEWRITER_ROLES[currentRole];
    let timeout: number;

    if (!isDeleting && displayText === role) {
      timeout = window.setTimeout(() => setIsDeleting(true), 2500);
    } else if (isDeleting && displayText === '') {
      setIsDeleting(false);
      setCurrentRole((prev) => (prev + 1) % TYPEWRITER_ROLES.length);
    } else if (isDeleting) {
      timeout = window.setTimeout(() => setDisplayText(role.substring(0, displayText.length - 1)), 30);
    } else {
      timeout = window.setTimeout(() => setDisplayText(role.substring(0, displayText.length + 1)), 60);
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentRole]);

  const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.15 } } };
  const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };

  return (
    <div className="welcome-page">
      {/* â”€â”€ HERO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="hero-section">
        <div className="hero-bg">
          <div className="gradient-orb orb-1" />
          <div className="gradient-orb orb-2" />
          <div className="gradient-orb orb-3" />
          <div className="grid-overlay" />
        </div>

        <nav className="hero-nav">
          <div className="nav-left">
            <Zap size={22} color="#6366f1" />
            <span className="nav-brand">ASIS</span>
            <span className="nav-version">v4.0</span>
            <span className="nav-tagline">Strategic Intelligence Platform</span>
          </div>
          <div className="nav-right">
            <Link to="/login" className="btn btn-ghost">Sign in</Link>
            <Link to="/signup" className="btn btn-primary">Get Started <ArrowRight size={16} /></Link>
          </div>
        </nav>

        <motion.div className="hero-content" variants={stagger} initial="hidden" animate="visible">
          <motion.div className="hero-tag" variants={fadeUp}>
            POWERED BY MULTI-AGENT AI Â· TRUSTED BY GLOBAL STRATEGY FIRMS
          </motion.div>

          <motion.h1 className="hero-title" variants={fadeUp}>
            The AI That Thinks Like
          </motion.h1>

          <motion.h2 className="hero-typewriter" variants={fadeUp}>
            <span className="typewriter-text">{displayText}</span>
            <span className="typewriter-cursor">|</span>
          </motion.h2>

          <motion.p className="hero-description" variants={fadeUp}>
            Eight specialist AI agents â€” Strategist, Quant, Market Intelligence, Risk, Red Team,
            Ethicist, CoVe Verifier, and Synthesis â€” debate every strategic question through the
            Debate-to-Verify protocol, then deliver board-ready intelligence in under 60 seconds.
          </motion.p>

          <motion.div className="hero-ctas" variants={fadeUp}>
            <Link to="/signup" className="btn btn-primary btn-lg">
              Start Free Analysis <ArrowRight size={18} />
            </Link>
            <a href="#pipeline" className="btn btn-secondary btn-lg">
              See How It Works <ArrowDown size={18} />
            </a>
          </motion.div>

          <motion.div className="hero-frameworks" variants={fadeUp}>
            {FRAMEWORKS.map((fw) => (
              <span key={fw} className="framework-chip">{fw}</span>
            ))}
          </motion.div>
        </motion.div>

        <div className="scroll-indicator">
          <ArrowDown size={20} className="bounce" />
        </div>
      </section>

      {/* â”€â”€ PIPELINE VISUALIZATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section id="pipeline" className="pipeline-section">
        <div className="section-container">
          <motion.h2
            className="section-title"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            8 Specialist Agents. One Unified Intelligence.
          </motion.h2>
          <p className="section-subtitle">The ASIS debate-to-verify protocol for board-level strategy intelligence</p>

          <div className="pipeline-grid">
            {AGENT_NODES.map((node, i) => (
              <motion.div
                key={node.id}
                className="pipeline-node"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                style={{ '--node-color': node.color } as any}
              >
                <div className="node-icon">
                  <node.icon size={24} />
                </div>
                <h3 className="node-name">{node.name}</h3>
                <p className="node-framework">{node.framework}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* â”€â”€ COMPARISON â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="comparison-section">
        <div className="section-container">
          <motion.h2
            className="section-title"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            What Makes ASIS Different
          </motion.h2>

          <div className="comparison-table">
            <div className="comparison-col">
              <div className="col-header col-generic">Generic LLM</div>
              <div className="col-item">âŒ Single agent, single perspective</div>
              <div className="col-item">âŒ Hardcoded confidence (always "85%")</div>
              <div className="col-item">âŒ Generic placeholders ("Company A")</div>
              <div className="col-item">âŒ No adversarial challenge</div>
              <div className="col-item">âŒ No audit trail</div>
            </div>
            <div className="comparison-col">
              <div className="col-header col-consulting">Consulting Firm</div>
              <div className="col-item">âœ… Multiple analysts, diverse expertise</div>
              <div className="col-item">âœ… Calibrated analysis</div>
              <div className="col-item">âœ… Named specifics</div>
              <div className="col-item">âœ… Partner review / challenge</div>
              <div className="col-item">â° 4-6 weeks delivery</div>
            </div>
            <div className="comparison-col highlight">
              <div className="col-header col-asis">ASIS v4.0</div>
              <div className="col-item">âœ… 8 specialist agents, adversarial debate</div>
              <div className="col-item">âœ… Formula-driven, weighted confidence</div>
              <div className="col-item">âœ… Named competitors, regulations, KPIs</div>
              <div className="col-item">âœ… Red Team + CoVe verification</div>
              <div className="col-item">âš¡ Under 60 seconds</div>
            </div>
          </div>
        </div>
      </section>

      {/* â”€â”€ BOTTOM CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="cta-section">
        <div className="section-container">
          <motion.h2
            className="cta-title"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Ready for your first strategic analysis?
          </motion.h2>
          <p className="cta-subtitle">
            Enter your strategic question and let 8 specialist AI agents build your board-ready recommendation.
          </p>
          <Link to="/signup" className="btn btn-primary btn-lg" style={{ marginTop: '24px' }}>
            Get Started â€” It's Free <ArrowRight size={18} />
          </Link>
          <p className="cta-trust">Used by senior strategists at leading consulting firms</p>
        </div>
      </section>

      <style>{`
        .welcome-page { overflow-x: hidden; }

        /* â”€â”€ Hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        .hero-section {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 24px 40px;
          overflow: hidden;
        }

        .hero-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .gradient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.08;
          animation: float 20s ease-in-out infinite;
        }

        .orb-1 { width: 600px; height: 600px; background: #6366f1; top: -10%; left: -5%; }
        .orb-2 { width: 500px; height: 500px; background: #8b5cf6; bottom: 10%; right: -5%; animation-delay: -7s; }
        .orb-3 { width: 400px; height: 400px; background: #14b8a6; top: 40%; left: 50%; animation-delay: -14s; }

        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(30px, -20px); }
          50% { transform: translate(-20px, 30px); }
          75% { transform: translate(20px, 10px); }
        }

        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(99, 102, 241, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        .hero-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 32px;
          background: rgba(2, 4, 10, 0.8);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(99, 102, 241, 0.1);
        }

        .nav-left { display: flex; align-items: center; gap: 8px; }
        .nav-brand { font-size: 20px; font-weight: 800; color: var(--text-primary); }
        .nav-version {
          font-size: 10px; padding: 2px 6px;
          background: rgba(99, 102, 241, 0.15); color: var(--accent-secondary);
          border-radius: 4px; font-weight: 600;
        }
        .nav-tagline { font-size: 13px; color: var(--text-muted); margin-left: 8px; }
        .nav-right { display: flex; align-items: center; gap: 8px; }

        .hero-content { position: relative; z-index: 1; max-width: 800px; text-align: center; }

        .hero-tag {
          font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase;
          color: var(--accent-secondary); margin-bottom: 24px;
        }

        .hero-title {
          font-size: clamp(32px, 5vw, 56px); font-weight: 900;
          line-height: 1.1; margin-bottom: 8px;
        }

        .hero-typewriter {
          font-size: clamp(24px, 4vw, 44px); font-weight: 700;
          background: var(--accent-gradient);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          min-height: 60px; margin-bottom: 24px;
        }

        .typewriter-cursor {
          -webkit-text-fill-color: var(--accent-primary);
          animation: blink 1s step-end infinite;
        }

        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

        .hero-description {
          font-size: 16px; color: var(--text-secondary); line-height: 1.8;
          max-width: 640px; margin: 0 auto 32px;
        }

        .hero-ctas { display: flex; gap: 12px; justify-content: center; margin-bottom: 32px; flex-wrap: wrap; }

        .hero-frameworks { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }

        .framework-chip {
          padding: 4px 12px; border-radius: 100px; font-size: 11px; font-weight: 500;
          background: rgba(99, 102, 241, 0.08); color: var(--text-secondary);
          border: 1px solid rgba(99, 102, 241, 0.12);
        }

        .scroll-indicator {
          position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
          color: var(--text-muted);
        }

        .bounce { animation: bounceAnim 2s ease-in-out infinite; }
        @keyframes bounceAnim {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }

        /* â”€â”€ Pipeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        .pipeline-section, .comparison-section, .cta-section {
          padding: 100px 24px;
        }

        .section-container { max-width: 1100px; margin: 0 auto; text-align: center; }

        .section-title {
          font-size: clamp(24px, 3vw, 36px); font-weight: 800; margin-bottom: 12px;
        }

        .section-subtitle {
          color: var(--text-secondary); font-size: 16px; margin-bottom: 48px;
        }

        .pipeline-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
          max-width: 900px; margin: 0 auto;
        }

        @media (max-width: 768px) { .pipeline-grid { grid-template-columns: repeat(2, 1fr); } }

        .pipeline-node {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: 24px 16px;
          transition: all 0.3s; cursor: default;
        }

        .pipeline-node:hover {
          border-color: var(--node-color);
          box-shadow: 0 0 20px color-mix(in srgb, var(--node-color) 20%, transparent);
          transform: translateY(-4px);
        }

        .node-icon {
          width: 48px; height: 48px; border-radius: 12px; margin: 0 auto 12px;
          display: flex; align-items: center; justify-content: center;
          background: color-mix(in srgb, var(--node-color) 12%, transparent);
          color: var(--node-color);
        }

        .node-name { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
        .node-framework { font-size: 11px; color: var(--text-muted); }

        /* â”€â”€ Comparison â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        .comparison-table {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
          max-width: 900px; margin: 0 auto; text-align: left;
        }

        @media (max-width: 768px) { .comparison-table { grid-template-columns: 1fr; } }

        .comparison-col {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: var(--radius-lg); overflow: hidden;
        }

        .comparison-col.highlight { border-color: var(--accent-primary); box-shadow: var(--shadow-glow); }

        .col-header {
          padding: 16px 20px; font-weight: 700; font-size: 14px; text-transform: uppercase;
          letter-spacing: 1px; border-bottom: 1px solid var(--border);
        }

        .col-generic { background: rgba(248, 113, 113, 0.08); color: var(--danger); }
        .col-consulting { background: rgba(251, 191, 36, 0.08); color: var(--warning); }
        .col-asis { background: rgba(99, 102, 241, 0.12); color: var(--accent-secondary); }

        .col-item {
          padding: 12px 20px; font-size: 13px; color: var(--text-secondary);
          border-bottom: 1px solid rgba(48, 54, 61, 0.3);
        }

        .col-item:last-child { border-bottom: none; }

        /* â”€â”€ CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        .cta-section {
          background: linear-gradient(180deg, transparent, rgba(99, 102, 241, 0.03), transparent);
        }

        .cta-title { font-size: clamp(24px, 3vw, 36px); font-weight: 800; }
        .cta-subtitle { color: var(--text-secondary); font-size: 16px; margin-top: 8px; max-width: 600px; margin-left: auto; margin-right: auto; }
        .cta-trust { margin-top: 24px; font-size: 12px; color: var(--text-muted); }
      `}</style>
    </div>
  );
}
