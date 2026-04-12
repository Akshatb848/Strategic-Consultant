"use client";

import { motion } from "framer-motion";

import type { QualityReport } from "@/lib/api";
import { decisionColor, decisionLabel, normalizedPercent } from "@/lib/analysis";

interface DecisionBannerProps {
  decision_statement: string;
  decision_confidence: number;
  decision_rationale: string;
  supporting_frameworks: string[];
  quality_report: QualityReport;
  onClick: () => void;
}

export function DecisionBanner({
  decision_statement,
  decision_confidence,
  decision_rationale,
  supporting_frameworks,
  quality_report,
  onClick,
}: DecisionBannerProps) {
  const label = decisionLabel(decision_statement);
  const color = decisionColor(label);
  const score = normalizedPercent(decision_confidence);

  return (
    <motion.button
      type="button"
      role="button"
      aria-label="View decision rationale and evidence"
      onClick={onClick}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full rounded-3xl border px-6 py-6 text-left shadow-[0_24px_64px_rgba(0,0,0,0.28)]"
      style={{
        borderColor: color,
        background: `linear-gradient(135deg, ${color}22 0%, rgba(8,16,29,0.96) 36%, rgba(8,16,29,0.98) 100%)`,
      }}
    >
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white"
              style={{ backgroundColor: color }}
            >
              {label}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
              Quality {quality_report.overall_grade}
            </span>
          </div>
          <h2 className="max-w-5xl text-xl font-bold leading-tight text-slate-50 lg:text-[28px]">
            {decision_statement}
          </h2>
          <p className="max-w-4xl text-sm leading-7 text-slate-300">{decision_rationale}</p>
          <div className="flex flex-wrap gap-2">
            {supporting_frameworks.map((framework) => (
              <span
                key={framework}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300"
              >
                {framework}
              </span>
            ))}
          </div>
        </div>

        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/20 px-5 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Confidence</div>
              <div className="mt-1 text-3xl font-semibold text-slate-50">{score}%</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Checks Passed</div>
              <div className="mt-1 text-sm font-semibold text-slate-100">
                {quality_report.checks.filter((check) => check.passed).length}/{quality_report.checks.length || 6}
              </div>
            </div>
          </div>
          <div className="mt-4 h-3 rounded-full bg-white/10">
            <div className="h-3 rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
          </div>
          <div className="mt-4 text-xs leading-6 text-slate-400">
            View full rationale, evidence, framework lineage, and citations.
          </div>
        </div>
      </div>
    </motion.button>
  );
}
