"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { BarChart3, ChevronRight, Clock, FileText, LogOut, Plus, Shield, TrendingUp, Zap } from "lucide-react";

import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/contexts/AuthContext";
import { contextSummary, confidenceColor } from "@/lib/analysis";
import { analysesAPI, type Analysis } from "@/lib/api";

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "#10b981",
    running: "#6366f1",
    queued: "#f59e0b",
    failed: "#ef4444",
    pending: "#64748b",
  };
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors[status] || "#64748b", display: "inline-block", flexShrink: 0 }} />;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    completed: { bg: "rgba(16,185,129,0.1)", color: "#10b981" },
    running: { bg: "rgba(99,102,241,0.1)", color: "#818cf8" },
    queued: { bg: "rgba(245,158,11,0.1)", color: "#f59e0b" },
    failed: { bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
    pending: { bg: "rgba(100,116,139,0.1)", color: "#64748b" },
  };
  const style = styles[status] || styles.pending;
  return <span style={{ padding: "2px 8px", borderRadius: 4, background: style.bg, color: style.color, fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>{status}</span>;
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const { user, logout } = useAuth();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analysesAPI
      .list({ limit: 10 })
      .then((response) => {
        setAnalyses(response.data.analyses);
        setTotal(response.data.total);
      })
      .catch(() => setError("Could not load analyses right now."))
      .finally(() => setLoading(false));
  }, []);

  const completed = analyses.filter((analysis) => analysis.status === "completed").length;
  const withConfidence = analyses.filter((analysis) => analysis.overall_confidence != null);
  const withDuration = analyses.filter((analysis) => analysis.duration_seconds != null);
  const avgConfidence = (
    withConfidence.reduce((sum, analysis) => sum + (analysis.overall_confidence || 0), 0) /
    (withConfidence.length || 1)
  ).toFixed(0);
  const avgDuration = withDuration.length
    ? (
        withDuration.reduce((sum, analysis) => sum + (analysis.duration_seconds || 0), 0) /
        withDuration.length
      ).toFixed(0)
    : "-";

  const stats = [
    { icon: BarChart3, label: "Total Analyses", value: loading ? "-" : String(total), sub: "all time" },
    { icon: TrendingUp, label: "Completed", value: loading ? "-" : String(completed), sub: "successfully" },
    { icon: Shield, label: "Avg Confidence", value: loading ? "-" : `${avgConfidence}/100`, sub: "analysis confidence" },
    { icon: Clock, label: "Avg Duration", value: loading ? "-" : `${avgDuration}s`, sub: "per analysis" },
  ];

  const displayName = user ? `${user.first_name} ${user.last_name}` : "User";

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
          <Link href="/analysis/new" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #7c3aed)", color: "white", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            <Plus size={14} />New Analysis
          </Link>
          <Link href="/reports" style={{ fontSize: 13, color: "#64748b", textDecoration: "none" }}>Reports</Link>
          <Link href="/profile" style={{ fontSize: 13, color: "#64748b", textDecoration: "none" }}>Profile</Link>
          <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 13 }}>
            <LogOut size={14} />Sign out
          </button>
        </div>
      </header>

      <div style={{ padding: "32px 32px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>Welcome back, {displayName}</h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>Board-level analysis powered by 8 specialist AI agents.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 28 }}>
          {stats.map(({ icon: Icon, label, value, sub }) => (
            <div key={label} style={{ padding: "16px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "#0c1220" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} style={{ color: "#818cf8" }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.1 }}>{value}</div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sub}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: "#0c1220", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>Recent Analyses</span>
            <Link href="/reports" style={{ fontSize: 12, color: "#818cf8", textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}>
              View all <ChevronRight size={12} />
            </Link>
          </div>

          {loading && <div style={{ padding: "48px 20px", textAlign: "center", color: "#475569", fontSize: 13 }}>Loading...</div>}
          {error && <div style={{ padding: "48px 20px", textAlign: "center", color: "#ef4444", fontSize: 13 }}>{error}</div>}
          {!loading && !error && analyses.length === 0 && (
            <div style={{ padding: "64px 20px", textAlign: "center" }}>
              <FileText size={32} style={{ color: "#334155", margin: "0 auto 12px", display: "block" }} />
              <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>No analyses yet.</p>
              <Link href="/analysis/new" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#6366f1", color: "white", borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
                <Plus size={14} />Start your first analysis
              </Link>
            </div>
          )}
          {!loading && !error && analyses.length > 0 && (
            <div>
              {analyses.map((analysis, index) => (
                <Link
                  key={analysis.id}
                  href={`/analysis/${analysis.id}`}
                  style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: index < analyses.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", textDecoration: "none", transition: "background 0.15s" }}
                  onMouseEnter={(event) => ((event.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(event) => ((event.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
                >
                  <div style={{ marginRight: 12, flexShrink: 0 }}><StatusDot status={analysis.status} /></div>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{analysis.query}</p>
                    <p style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{contextSummary(analysis)}</p>
                    <p style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                      {formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true })}
                      {analysis.duration_seconds != null && <span> · {analysis.duration_seconds.toFixed(0)}s</span>}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    {analysis.overall_confidence != null && (
                      <span style={{ fontSize: 11, color: confidenceColor(analysis.overall_confidence), fontWeight: 600 }}>
                        {analysis.overall_confidence.toFixed(0)}/100
                      </span>
                    )}
                    <StatusBadge status={analysis.status} />
                    <ChevronRight size={14} style={{ color: "#334155" }} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
