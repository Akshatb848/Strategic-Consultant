import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Zap, LayoutDashboard, Plus, FileText, LogOut } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Zap size={20} color="#6366f1" />
          <h1>ASIS</h1>
          <span className="version-chip">v4.0</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/dashboard">
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>
          <NavLink className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/analysis/new">
            <Plus size={18} /> New Analysis
          </NavLink>
          <NavLink className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/reports">
            <FileText size={18} /> Reports
          </NavLink>
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user?.avatarInitials || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.firstName} {user?.lastName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Sign out" style={{ padding: 6 }}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
