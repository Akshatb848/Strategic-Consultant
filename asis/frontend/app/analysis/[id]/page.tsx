"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, CheckCircle, RefreshCw, Shield, XCircle } from "lucide-react";

import { AuthGuard } from "@/components/auth-guard";
import { activeContext, confidenceColor, contextSummary, latestAgentOutput } from "@/lib/analysis";
import { analysesAPI, type Analysis, type AgentLog } from "@/lib/api";
import { subscribeToAnalysisEvents } from "@/lib/sse";

const AGENTS = [
  ["strategist", "Strategist"],
  ["quant", "Quant"],
  ["market_intel", "Market Intel"],
  ["risk", "Risk"],
  ["red_team", "Red Team"],
  ["ethicist", "Ethicist"],
  ["cove", "CoVe"],
  ["synthesis", "Synthesis"],
] as const;

function cardTitle(title: string, subtitle?: string) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{subtitle}</p>}
    </div>
  );
}

function card(children: React.ReactNode) {
  return <section style={{ background: "#0c1220", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 18 }}>{children}</section>;
}

function agentStatus(logs: AgentLog[], agentId: string): "pending" | "running" | "completed" | "failed" {
  const entries = logs.filter((log) => log.agent_id === agentId);
  if (entries.length === 0) return "pending";
  const latest = entries[entries.length - 1];
  if (latest.status === "failed") return "failed";
  if (latest.status === "completed" || latest.status === "self_corrected") return "completed";
  return "running";
}

export default function AnalysisDetailPage() {
  return <AuthGuard><AnalysisDetailContent /></AuthGuard>;
}

function AnalysisDetailContent() {
  const params = useParams<{ id: string }>();
  const analysisId = String(params.id);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await analysesAPI.get(analysisId);
      setAnalysis(response.data.analysis);
      setError(null);
    } catch (caughtError: any) {
      setError(caughtError?.response?.data?.detail || "Failed to load analysis.");
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!analysis || analysis.status === "completed" || analysis.status === "failed") return;
    return subscribeToAnalysisEvents(analysisId, {
      onEvent: () => void load(),
      onError: (caughtError) => setStreamError(caughtError.message),
    });
  }, [analysis, analysisId, load]);

  if (loading) {
    return <div style={{ minHeight: "100vh", background: "#070b14", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>Loading analysis...</div>;
  }
  if (error || !analysis) {
    return <div style={{ minHeight: "100vh", background: "#070b14", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>{error || "Analysis not found"}</div>;
  }

  const logs = analysis.agent_logs || [];
  const brief = analysis.strategic_brief || {};
  const context = activeContext(analysis);
  const strategist = latestAgentOutput(analysis, "strategist");
  const quant = latestAgentOutput(analysis, "quant");
  const market = latestAgentOutput(analysis, "market_intel");
  const risk = latestAgentOutput(analysis, "risk");
  const redTeam = latestAgentOutput(analysis, "red_team");
  const ethicist = latestAgentOutput(analysis, "ethicist");
  const cove = latestAgentOutput(analysis, "cove");
  const confidence = analysis.overall_confidence ?? brief.overall_confidence ?? null;

  return (
    <div style={{ minHeight: "100vh", background: "#070b14" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 28px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0c1220" }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 12, textDecoration: "none" }}>
          <ArrowLeft size={14} />Dashboard
        </Link>
        <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.06)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#f8fafc", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{analysis.query}</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>{contextSummary(analysis)}</div>
        </div>
        {(analysis.status === "queued" || analysis.status === "running") && <RefreshCw size={14} style={{ color: "#818cf8", animation: "spin 1s linear infinite" }} />}
      </header>

      <div style={{ maxWidth: 1220, margin: "0 auto", padding: "24px 24px 80px", display: "grid", gap: 18 }}>
        {streamError && <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#fbbf24", fontSize: 12 }}>Live stream disconnected. Showing the latest persisted state.</div>}

        {card(
          <>
            {cardTitle("Board Summary", "Decision narrative and confidence propagated from CoVe")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 18 }}>
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 10 }}>{brief.executive_summary || analysis.executive_summary || "Strategic brief in progress"}</h1>
                <p style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.8 }}>{brief.board_narrative || analysis.board_narrative || "Synthesis is still assembling the board narrative."}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                  {(Array.isArray(brief.frameworks_applied) ? brief.frameworks_applied : []).map((framework: string) => (
                    <span key={framework} style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)", color: "#c4b5fd", fontSize: 11, fontWeight: 600 }}>{framework}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>Confidence</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: confidenceColor(confidence) }}>{confidence != null ? `${confidence.toFixed(0)}/100` : "-"}</div>
                </div>
                <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>Status</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc", textTransform: "capitalize" }}>{analysis.status}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true })}</div>
                </div>
              </div>
            </div>
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {card(
            <>
              {cardTitle("Pipeline Status", "Per-agent completion and confidence snapshots")}
              <div style={{ display: "grid", gap: 8 }}>
                {AGENTS.map(([agentId, label]) => {
                  const latest = logs.filter((log) => log.agent_id === agentId).at(-1);
                  const status = agentStatus(logs, agentId);
                  return (
                    <div key={agentId} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {status === "completed" ? <CheckCircle size={14} style={{ color: "#10b981" }} /> : status === "failed" ? <XCircle size={14} style={{ color: "#ef4444" }} /> : <Shield size={14} style={{ color: status === "running" ? "#818cf8" : "#475569" }} />}
                        <span style={{ fontSize: 12, color: "#f8fafc", fontWeight: 600 }}>{label}</span>
                      </div>
                      <span style={{ fontSize: 11, color: latest?.confidence_score != null ? confidenceColor(latest.confidence_score) : "#64748b" }}>{latest?.confidence_score != null ? `${latest.confidence_score.toFixed(0)}/100` : status}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {card(
            <>
              {cardTitle("Context Snapshot", "Structured and extracted company context")}
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  ["Company", context.company_name || "-"],
                  ["Sector", context.sector || "-"],
                  ["Geography", context.geography || "-"],
                  ["Decision Type", context.decision_type || "-"],
                  ["Revenue", context.annual_revenue || "-"],
                  ["Employees", context.employees || "-"],
                ].map(([label, value]) => (
                  <div key={label as string} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
                    <span style={{ fontSize: 12, color: "#f8fafc", fontWeight: 600 }}>{value as string}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {card(
            <>
              {cardTitle("Market And Risk", "Market sizing, Porter forces, and top enterprise risks")}
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 12, color: "#f8fafc", fontWeight: 700 }}>{market.market_size_summary?.headline || "Market thesis pending."}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>{market.market_size_summary?.growth_rate || "-"} · {market.market_size_summary?.regulatory_landscape || "-"}</div>
                </div>
                {(Array.isArray(market.named_competitors) ? market.named_competitors : []).map((competitor: string) => (
                  <div key={competitor} style={{ fontSize: 11, color: "#67e8f9" }}>{competitor}</div>
                ))}
                {(Array.isArray(risk.risk_register) ? risk.risk_register : []).slice(0, 4).map((item: any) => (
                  <div key={item.id} style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                    <div style={{ fontSize: 12, color: "#f8fafc", fontWeight: 700 }}>{item.id} · {item.risk}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{item.category} · {item.likelihood} likelihood · {item.impact} impact · {item.velocity} velocity</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {card(
            <>
              {cardTitle("Financial And Roadmap", "Monte Carlo ranges, scenarios, and execution phases")}
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  ["P10", quant.monte_carlo_summary?.p10_outcome || "-"],
                  ["P50", quant.monte_carlo_summary?.p50_outcome || "-"],
                  ["P90", quant.monte_carlo_summary?.p90_outcome || "-"],
                  ["Worst case", quant.monte_carlo_summary?.worst_case || "-"],
                ].map(([label, value]) => (
                  <div key={label as string} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                    <div style={{ fontSize: 10, color: "#64748b" }}>{label}</div>
                    <div style={{ fontSize: 12, color: "#f8fafc", fontWeight: 600, marginTop: 4 }}>{value as string}</div>
                  </div>
                ))}
                {(Array.isArray(brief.roadmap) ? brief.roadmap : []).map((phase: any) => (
                  <div key={phase.phase} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(99,102,241,0.08)" }}>
                    <div style={{ fontSize: 12, color: "#f8fafc", fontWeight: 700 }}>{phase.phase}</div>
                    <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4 }}>{phase.timeline} · {phase.success_metric}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {card(
            <>
              {cardTitle("Red Team And Ethicist", "Challenge findings and stakeholder guardrails")}
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
                  <div style={{ fontSize: 12, color: "#f8fafc", fontWeight: 700 }}>{redTeam.red_team_verdict || "Red Team verdict pending."}</div>
                </div>
                {(Array.isArray(redTeam.invalidated_claims) ? redTeam.invalidated_claims : []).map((claim: any, index: number) => (
                  <div key={index} style={{ fontSize: 11, color: "#fecaca" }}>{claim.severity} · {claim.original_claim}</div>
                ))}
                {(Array.isArray(ethicist.brand_guardrails) ? ethicist.brand_guardrails : []).map((item: string) => (
                  <div key={item} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(236,72,153,0.08)", color: "#fbcfe8", fontSize: 11 }}>{item}</div>
                ))}
              </div>
            </>
          )}

          {card(
            <>
              {cardTitle("CoVe Verification", "Verification checks and self-corrections")}
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {cove.logic_consistent ? <CheckCircle size={14} style={{ color: "#10b981" }} /> : <XCircle size={14} style={{ color: "#ef4444" }} />}
                    <span style={{ fontSize: 12, color: "#f8fafc", fontWeight: 700 }}>{cove.logic_consistent ? "Logic consistent" : "Logic challenged"}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>Verification score {cove.overall_verification_score || confidence || "-"}/100</div>
                </div>
                {(Array.isArray(cove.verification_checks) ? cove.verification_checks : []).map((check: any, index: number) => (
                  <div key={index} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                    <div style={{ fontSize: 12, color: "#f8fafc", fontWeight: 700 }}>{check.claim}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{check.evidence}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
