"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import type { Analysis, AgentLog } from "@/lib/api";
import { normalizedPercent } from "@/lib/analysis";

interface Props {
  analysis: Analysis;
  agentLogs?: AgentLog[];
  onRetry?: () => void;
}

function AgentConfidenceBar({ log }: { log: AgentLog }) {
  const score = log.confidence_score != null ? normalizedPercent(log.confidence_score) : null;
  const failed = log.status === "failed" || log.status === "error";
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 truncate text-xs text-slate-300">{log.agent_name || log.agent_id}</div>
      <div className="flex-1">
        <div className="h-1.5 rounded-full bg-white/10">
          {score != null ? (
            <div
              className={`h-1.5 rounded-full transition-all ${failed ? "bg-rose-500" : score >= 70 ? "bg-emerald-400" : score >= 50 ? "bg-amber-400" : "bg-rose-400"}`}
              style={{ width: `${score}%` }}
            />
          ) : null}
        </div>
      </div>
      <div className={`w-12 text-right text-xs font-semibold ${failed ? "text-rose-400" : "text-slate-300"}`}>
        {score != null ? `${score}%` : failed ? "ERR" : "—"}
      </div>
      {failed ? (
        <XCircle size={13} className="text-rose-400 flex-none" />
      ) : score != null && score >= 70 ? (
        <CheckCircle2 size={13} className="text-emerald-400 flex-none" />
      ) : (
        <div className="w-[13px] flex-none" />
      )}
    </div>
  );
}

export function FailureDiagnosticsPanel({ analysis, agentLogs, onRetry }: Props) {
  const [expanded, setExpanded] = useState(true);

  const logs = agentLogs || analysis.agent_logs || [];
  const failedAgents = logs.filter((l) => l.status === "failed" || l.status === "error");
  const selfCorrectedLogs = logs.filter((l) => l.self_corrected);
  const selfCorrectionCount = analysis.self_correction_count ?? selfCorrectedLogs.length;

  // Unique logs per agent for confidence chart
  const latestByAgent = logs.reduce<Record<string, AgentLog>>((acc, log) => {
    if (!acc[log.agent_id] || new Date(log.created_at) > new Date(acc[log.agent_id].created_at)) {
      acc[log.agent_id] = log;
    }
    return acc;
  }, {});
  const agentEntries = Object.values(latestByAgent);

  const redTeamThreats: string[] = (() => {
    const rt = (analysis.strategic_brief as any)?.red_team;
    if (!rt) return [];
    if (Array.isArray(rt.unaddressed_threats)) return rt.unaddressed_threats as string[];
    if (Array.isArray(rt.threats)) return rt.threats as string[];
    return [];
  })();

  const coveClaims: string[] = (() => {
    const v = (analysis.strategic_brief as any)?.verification;
    if (!v) return [];
    if (Array.isArray(v.flagged_claims)) return v.flagged_claims as string[];
    return [];
  })();

  const suggestions = [
    "Rephrase the question to be more specific — include company name, geography, and timeframe.",
    "Add industry and revenue context to improve agent calibration.",
    "Break a broad strategic question into a more focused decision point.",
    "Ensure the question starts with an actionable verb ('Should we…', 'How should we…').",
  ];

  const isFailed = analysis.status === "failed";
  const isLowConfidence = (analysis.overall_confidence ?? 100) < 60;

  if (!isFailed && !isLowConfidence) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="rounded-3xl border border-rose-500/25 bg-[linear-gradient(180deg,rgba(220,38,38,0.08),rgba(8,16,29,0.95))] p-5"
    >
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-rose-500/15 p-2 text-rose-400">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-rose-100">Failure Diagnostics</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {isFailed ? "Analysis pipeline failed" : "Low-confidence result"} — review below for recovery steps
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {expanded ? (
        <div className="mt-5 space-y-5">
          {/* Failed agents */}
          {failedAgents.length > 0 ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-300">
                Failed Agents ({failedAgents.length})
              </div>
              <div className="space-y-3">
                {failedAgents.map((log) => (
                  <div key={log.id} className="rounded-xl border border-rose-500/15 bg-black/20 p-3">
                    <div className="flex items-center gap-2">
                      <XCircle size={13} className="text-rose-400 flex-none" />
                      <span className="text-sm font-semibold text-rose-100">{log.agent_name || log.agent_id}</span>
                      <span className="ml-auto rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-300">
                        {log.status}
                      </span>
                    </div>
                    {log.correction_reason ? (
                      <p className="mt-2 text-xs leading-5 text-slate-400">{log.correction_reason}</p>
                    ) : null}
                    {analysis.error_message && failedAgents.indexOf(log) === 0 ? (
                      <p className="mt-2 text-xs leading-5 text-rose-300/80">{analysis.error_message}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Confidence breakdown */}
          {agentEntries.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                Agent Confidence Breakdown
              </div>
              <div className="space-y-2.5">
                {agentEntries.map((log) => (
                  <AgentConfidenceBar key={log.id} log={log} />
                ))}
              </div>
            </div>
          ) : null}

          {/* Self-correction info */}
          {selfCorrectionCount > 0 ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                Self-Correction Log ({selfCorrectionCount} attempts)
              </div>
              <div className="space-y-2">
                {selfCorrectedLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-amber-400/10 bg-black/15 px-3 py-2">
                    <span className="text-xs font-semibold text-amber-200">{log.agent_name || log.agent_id}</span>
                    {log.correction_reason ? (
                      <p className="mt-1 text-xs leading-5 text-slate-400">{log.correction_reason}</p>
                    ) : null}
                  </div>
                ))}
                {selfCorrectedLogs.length === 0 ? (
                  <p className="text-xs text-slate-400">Self-correction metadata was not captured for this run.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Red team threats */}
          {redTeamThreats.length > 0 ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-300">
                <ShieldAlert size={12} />
                Unaddressed Red Team Threats
              </div>
              <ul className="space-y-1.5">
                {redTeamThreats.map((threat, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-5 text-slate-400">
                    <span className="mt-0.5 h-1.5 w-1.5 flex-none rounded-full bg-rose-400" />
                    {threat}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* CoVe flagged claims */}
          {coveClaims.length > 0 ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                CoVe Flagged Claims
              </div>
              <ul className="space-y-1.5">
                {coveClaims.map((claim, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-5 text-slate-400">
                    <span className="mt-0.5 h-1.5 w-1.5 flex-none rounded-full bg-amber-400" />
                    {claim}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Improvement suggestions */}
          <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Suggestions to Improve This Analysis
            </div>
            <ul className="space-y-2">
              {suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-5 text-slate-400">
                  <span className="mt-0.5 text-cyan-400 font-bold">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Retry button */}
          {onRetry ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400"
              >
                <RefreshCw size={14} />
                Retry Analysis
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}
