"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, TrendingUp, TrendingDown, Minus } from "lucide-react";

import type { Analysis } from "@/lib/api";
import { normalizedPercent, decisionColor } from "@/lib/analysis";

interface Props {
  currentAnalysis: Analysis;
  allAnalyses: Analysis[];
}

function DeltaBadge({ delta, unit = "" }: { delta: number; unit?: string }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
        <Minus size={10} /> Same
      </span>
    );
  }
  const positive = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
        positive
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-rose-500/30 bg-rose-500/10 text-rose-400"
      }`}
    >
      {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {positive ? "+" : ""}
      {delta}
      {unit}
    </span>
  );
}

function DecisionBadge({ decision }: { decision: string | null | undefined }) {
  if (!decision) return <span className="text-slate-500 text-xs">—</span>;
  const color = decisionColor(decision);
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ color, background: `${color}22`, border: `1px solid ${color}44` }}
    >
      {decision}
    </span>
  );
}

function ConfidenceBar({ value, maxValue }: { value: number; maxValue: number }) {
  const width = maxValue > 0 ? (value / maxValue) * 100 : value;
  const color = value >= 75 ? "#34d399" : value >= 55 ? "#fbbf24" : "#f87171";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-white/10">
        <motion.div
          className="h-1.5 rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="w-10 text-right text-xs font-semibold" style={{ color }}>
        {value}%
      </span>
    </div>
  );
}

const COMPARISON_ROWS = [
  { key: "confidence", label: "Overall Confidence" },
  { key: "decision", label: "Decision" },
  { key: "duration", label: "Duration (s)" },
  { key: "selfCorrections", label: "Self-Corrections" },
  { key: "logicConsistency", label: "Logic Consistency" },
  { key: "agentCount", label: "Agents Completed" },
] as const;

type RowKey = (typeof COMPARISON_ROWS)[number]["key"];

function getCellValue(analysis: Analysis, key: RowKey): { display: React.ReactNode; raw: number | string | null } {
  switch (key) {
    case "confidence": {
      const v = normalizedPercent(analysis.overall_confidence);
      return { display: <span className="font-semibold">{v}%</span>, raw: v };
    }
    case "decision":
      return { display: <DecisionBadge decision={analysis.decision_recommendation} />, raw: analysis.decision_recommendation ?? null };
    case "duration":
      return {
        display: analysis.duration_seconds != null ? `${Math.round(analysis.duration_seconds)}s` : "—",
        raw: analysis.duration_seconds != null ? Math.round(analysis.duration_seconds) : null,
      };
    case "selfCorrections":
      return { display: String(analysis.self_correction_count ?? 0), raw: analysis.self_correction_count ?? 0 };
    case "logicConsistency":
      return {
        display: analysis.logic_consistency_passed == null ? "—" : analysis.logic_consistency_passed ? (
          <span className="text-emerald-400 font-semibold">Passed</span>
        ) : (
          <span className="text-rose-400 font-semibold">Failed</span>
        ),
        raw: analysis.logic_consistency_passed == null ? null : analysis.logic_consistency_passed ? 1 : 0,
      };
    case "agentCount": {
      const count = (analysis.agent_logs || []).filter((l) => l.status === "completed").length;
      return { display: String(count), raw: count };
    }
    default:
      return { display: "—", raw: null };
  }
}

export function BaselineComparisonPanel({ currentAnalysis, allAnalyses }: Props) {
  const options = allAnalyses.filter((a) => a.id !== currentAnalysis.id && a.status === "completed");
  const [selectedId, setSelectedId] = useState<string>(options[0]?.id ?? "");
  const baseline = options.find((a) => a.id === selectedId) ?? null;

  const currentConfidence = normalizedPercent(currentAnalysis.overall_confidence);
  const baselineConfidence = baseline ? normalizedPercent(baseline.overall_confidence) : 0;
  const maxConfidence = Math.max(currentConfidence, baselineConfidence, 1);

  const trajectoryAnalyses = [baseline, currentAnalysis].filter(Boolean) as Analysis[];

  if (options.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#08101d] p-5">
        <h2 className="text-lg font-semibold text-slate-50">Baseline Comparison</h2>
        <p className="mt-2 text-sm text-slate-400">
          No other completed analyses available for comparison. Run additional analyses to enable baseline comparison.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="rounded-3xl border border-white/10 bg-[#08101d] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Baseline Comparison</h2>
          <p className="mt-1 text-sm text-slate-400">Compare current analysis against a past run side-by-side.</p>
        </div>

        {/* Baseline selector */}
        <div className="relative min-w-[220px]">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.04] py-2.5 pl-4 pr-10 text-sm text-slate-100 outline-none transition focus:border-cyan-300/40"
          >
            {options.map((a) => (
              <option key={a.id} value={a.id} className="bg-[#08101d]">
                {new Date(a.created_at).toLocaleDateString()} — {a.query.slice(0, 50)}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {baseline ? (
          <motion.div
            key={baseline.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="mt-5 space-y-4"
          >
            {/* Comparison table */}
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Metric
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-400">
                      Current
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Baseline
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Delta
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, idx) => {
                    const current = getCellValue(currentAnalysis, row.key);
                    const base = getCellValue(baseline, row.key);
                    const delta =
                      typeof current.raw === "number" && typeof base.raw === "number"
                        ? current.raw - base.raw
                        : null;
                    const decisionSame =
                      row.key === "decision" &&
                      current.raw === base.raw &&
                      current.raw != null;

                    return (
                      <tr
                        key={row.key}
                        className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${idx % 2 === 0 ? "" : "bg-white/[0.015]"}`}
                      >
                        <td className="px-4 py-3 text-xs font-medium text-slate-400">{row.label}</td>
                        <td className="px-4 py-3 text-slate-100">{current.display}</td>
                        <td className="px-4 py-3 text-slate-400">{base.display}</td>
                        <td className="px-4 py-3">
                          {delta != null ? (
                            <DeltaBadge delta={row.key === "confidence" ? delta : delta} unit={row.key === "confidence" ? "%" : ""} />
                          ) : decisionSame ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                              <Minus size={10} /> Same
                            </span>
                          ) : row.key === "decision" ? (
                            <span className="text-xs text-slate-500">Changed</span>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Confidence trajectory */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Confidence Trajectory
              </div>
              <div className="space-y-3">
                {trajectoryAnalyses.map((a, idx) => {
                  const conf = normalizedPercent(a.overall_confidence);
                  const label = a.id === currentAnalysis.id ? "Current" : "Baseline";
                  return (
                    <div key={a.id}>
                      <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                        <span className={a.id === currentAnalysis.id ? "text-cyan-400 font-semibold" : ""}>
                          {label} — {new Date(a.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <ConfidenceBar value={conf} maxValue={maxConfidence} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delta summary badges */}
            <div className="flex flex-wrap gap-2">
              {(() => {
                const confDelta = currentConfidence - baselineConfidence;
                const sameDecision = currentAnalysis.decision_recommendation === baseline.decision_recommendation;
                return (
                  <>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${confDelta >= 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>
                      {confDelta >= 0 ? "+" : ""}{confDelta}% confidence vs baseline
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${sameDecision ? "border-slate-500/30 bg-slate-500/10 text-slate-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
                      {sameDecision ? "Same decision" : "Decision changed"}
                    </span>
                  </>
                );
              })()}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
