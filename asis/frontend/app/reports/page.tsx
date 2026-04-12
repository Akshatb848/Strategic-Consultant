"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Download, FileText, LogOut, Plus, Search, Zap } from "lucide-react";

import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/contexts/AuthContext";
import { confidenceColor, toCsv } from "@/lib/analysis";
import { reportsAPI, type Report } from "@/lib/api";

function reportContext(report: Report): string {
  const context = report.strategic_brief?.context || {};
  const company = context.company_name || "Unnamed organisation";
  const sector = context.sector || "sector not specified";
  const geography = context.geography || "geography not specified";
  return `${company} - ${sector} - ${geography}`;
}

function recommendationBucket(value: unknown): string {
  const normalized = String(value || "").toUpperCase();
  if (normalized.includes("CONDITIONAL PROCEED")) return "conditional";
  if (normalized.includes("DO NOT PROCEED")) return "no-proceed";
  if (normalized.includes("PROCEED")) return "proceed";
  if (normalized.includes("HOLD")) return "hold";
  if (normalized.includes("ESCALATE")) return "escalate";
  return "other";
}

export default function ReportsPage() {
  return (
    <AuthGuard>
      <ReportsContent />
    </AuthGuard>
  );
}

function ReportsContent() {
  const { logout } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    reportsAPI
      .list()
      .then((response) => setReports(response.data.reports))
      .catch(() => setError("Unable to load reports right now."))
      .finally(() => setLoading(false));
  }, []);

  const filteredReports = useMemo(
    () =>
      reports.filter((report) => {
        const brief = report.strategic_brief || {};
        const recommendation = recommendationBucket(brief.recommendation);
        const haystack = [brief.executive_summary, brief.board_narrative, reportContext(report)].join(" ").toLowerCase();
        if (filter !== "all" && recommendation !== filter) return false;
        if (search && !haystack.includes(search.toLowerCase())) return false;
        return true;
      }),
    [filter, reports, search]
  );

  const exportCsv = () => {
    const csv = toCsv(
      filteredReports.map((report) => ({
        id: report.id,
        analysis_id: report.analysis_id,
        recommendation: report.strategic_brief?.recommendation,
        overall_confidence: report.strategic_brief?.overall_confidence,
        company_name: report.strategic_brief?.context?.company_name,
        sector: report.strategic_brief?.context?.sector,
        geography: report.strategic_brief?.context?.geography,
        created_at: report.created_at,
        updated_at: report.updated_at,
      }))
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "asis-reports.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

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
          <button onClick={exportCsv} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13 }}>
            <Download size={14} />Export CSV
          </button>
          <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 13 }}>
            <LogOut size={14} />Sign out
          </button>
        </div>
      </header>

      <div style={{ padding: "32px 32px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>All Reports</h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>{reports.length} board-ready briefs</p>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search board briefs..."
              style={{ width: "100%", padding: "9px 14px 9px 36px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0c1220", color: "#f1f5f9", fontSize: 13, outline: "none" }}
            />
          </div>
          {[
            ["all", "All"],
            ["proceed", "Proceed"],
            ["conditional", "Conditional"],
            ["no-proceed", "Do Not Proceed"],
            ["hold", "Hold"],
            ["escalate", "Escalate"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid", borderColor: filter === value ? "#6366f1" : "rgba(255,255,255,0.08)", background: filter === value ? "rgba(99,102,241,0.1)" : "transparent", color: filter === value ? "#818cf8" : "#64748b", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ background: "#0c1220", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {["Board Summary", "Context", "Confidence", "Decision", "Version", "Updated"].map((header) => (
                  <th key={header} style={{ textAlign: "left", padding: "12px 16px", color: "#475569", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ padding: 48, textAlign: "center", color: "#475569", fontSize: 13 }}>Loading...</td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={6} style={{ padding: 48, textAlign: "center", color: "#ef4444", fontSize: 13 }}>{error}</td>
                </tr>
              )}
              {!loading && !error && filteredReports.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 64, textAlign: "center" }}>
                    <FileText size={32} style={{ color: "#334155", margin: "0 auto 12px", display: "block" }} />
                    <p style={{ color: "#64748b", fontSize: 13 }}>No reports found.</p>
                  </td>
                </tr>
              )}
              {!loading && !error && filteredReports.map((report, index) => (
                <tr
                  key={report.id}
                  style={{ borderBottom: index < filteredReports.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none", transition: "background 0.15s" }}
                  onMouseEnter={(event) => ((event.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(event) => ((event.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
                >
                  <td style={{ padding: "12px 16px", maxWidth: 340 }}>
                    <Link href={`/analysis/${report.analysis_id}`} style={{ fontSize: 13, color: "#f1f5f9", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {report.strategic_brief?.executive_summary || "Board brief"}
                    </Link>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{report.strategic_brief?.board_narrative || "Narrative pending."}</div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 11, color: "#94a3b8" }}>{reportContext(report)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {report.strategic_brief?.overall_confidence != null ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: confidenceColor(Number(report.strategic_brief.overall_confidence)) }}>
                        {Number(report.strategic_brief.overall_confidence).toFixed(0)}/100
                      </span>
                    ) : (
                      <span style={{ color: "#475569" }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {report.strategic_brief?.recommendation && (
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "rgba(99,102,241,0.1)", color: "#c4b5fd" }}>
                        {report.strategic_brief.recommendation}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#475569" }}>v{report.report_version}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#475569" }}>
                    {formatDistanceToNow(new Date(report.updated_at), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
