"use client";

import Link from "next/link";
import { BarChart3, Calendar, LogOut, Shield, User, Zap } from "lucide-react";

import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/contexts/AuthContext";

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}

function ProfileContent() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const initials = user.avatar_initials || (user.first_name[0] + user.last_name[0]).toUpperCase();
  const planColors: Record<string, string> = {
    free: "#64748b",
    pro: "#6366f1",
    enterprise: "#7c3aed",
    "white-label": "#10b981",
  };
  const planColor = planColors[user.plan] || "#64748b";

  return (
    <div style={{ minHeight: "100vh", background: "#070b14" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0c1220", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={16} color="white" />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700 }}>ASIS</span>
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(99,102,241,0.15)", color: "#818cf8", fontWeight: 600 }}>v4.0</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/dashboard" style={{ fontSize: 13, color: "#64748b", textDecoration: "none" }}>Dashboard</Link>
          <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 13 }}>
            <LogOut size={14} />Sign out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 80px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 28 }}>Profile</h1>

        <div style={{ background: "#0c1220", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 28, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "white", flexShrink: 0 }}>
              {initials}
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{user.first_name} {user.last_name}</h2>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>{user.email}</p>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, background: `${planColor}15`, color: planColor, fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>
                <Shield size={10} />{user.plan} plan
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { icon: User, label: "Role", value: user.role || "Analyst" },
              { icon: BarChart3, label: "Analyses Run", value: String(user.analysis_count || 0) },
              { icon: Calendar, label: "Member Since", value: user.created_at ? new Date(user.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "-" },
              { icon: Shield, label: "Auth Provider", value: user.auth_provider || "email" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <Icon size={16} style={{ color: "#475569", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{label}</div>
                  <div style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 500 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {user.organisation_name && (
          <div style={{ background: "#0c1220", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", marginBottom: 12 }}>Organisation</h3>
            <p style={{ fontSize: 14, color: "#94a3b8" }}>{user.organisation_name}</p>
          </div>
        )}

        <div style={{ background: "#0c1220", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", marginBottom: 12 }}>Account</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", color: "#94a3b8", fontSize: 13, textDecoration: "none" }}>
              View dashboard -&gt;
            </Link>
            <Link href="/analysis/new" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", color: "#94a3b8", fontSize: 13, textDecoration: "none" }}>
              Start new analysis -&gt;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
