import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Home, LogOut, Plus, Sparkles } from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Dashboard' },
  { to: '/analysis/new', icon: Plus, label: 'New Analysis' },
  { to: '/reports', icon: FileText, label: 'Reports' },
];

const decisionStack = [
  'Orchestrator',
  'Market Intel',
  'Risk Assessment',
  'Competitor Analysis',
  'Geo Intel',
  'Financial Reasoning',
  'Strategic Options',
  'Synthesis',
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Strategist';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #040914 0%, #07101d 38%, #081423 100%)',
        color: 'var(--text-primary)',
      }}
    >
      <div
        className="app-layout-responsive"
        style={{
          margin: '0 auto',
          maxWidth: 1600,
          display: 'grid',
          minHeight: '100vh',
          gridTemplateColumns: '272px minmax(0,1fr)',
        }}
      >
        <aside
          style={{
            borderRight: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(7, 16, 27, 0.9)',
            backdropFilter: 'blur(18px)',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 18,
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(135deg, #204df0, #17b8e6 60%, #84f1cf)',
                color: '#fff',
                fontWeight: 900,
                fontSize: 18,
              }}
            >
              A
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.22em', color: '#e2e8f0' }}>ASIS</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Strategic workspace</div>
            </div>
          </div>

          <nav style={{ display: 'grid', gap: 8 }}>
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 18,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#020617' : '#94a3b8',
                  boxShadow: isActive ? '0 16px 30px rgba(255,255,255,0.08)' : 'none',
                  transition: 'all 0.2s ease',
                })}
              >
                <Icon size={17} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div
            style={{
              borderRadius: 26,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              padding: 16,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#cffafe',
              }}
            >
              <Sparkles size={13} />
              Decision stack
            </div>
            <div style={{ marginTop: 14, display: 'grid', gap: 8, fontSize: 13, color: '#94a3b8' }}>
              {decisionStack.map((agent) => (
                <div key={agent} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: 'rgba(103, 232, 249, 0.9)',
                      boxShadow: '0 0 12px rgba(103, 232, 249, 0.28)',
                    }}
                  />
                  {agent}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: 'auto',
              borderRadius: 22,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(135deg, #204df0, #17b8e6 60%, #84f1cf)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {user?.avatarInitials || 'U'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#f8fafc',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#64748b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.email}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              title="Sign out"
              style={{
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: '#94a3b8',
                borderRadius: 999,
                width: 34,
                height: 34,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </aside>

        <main className="app-layout-main" style={{ padding: '24px 24px 32px 40px' }}>{children}</main>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .app-layout-responsive {
            grid-template-columns: 1fr;
          }

          .app-layout-responsive aside {
            display: none !important;
          }

          .app-layout-main {
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
