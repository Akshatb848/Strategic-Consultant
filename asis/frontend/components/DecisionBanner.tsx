"use client";

import { motion } from "framer-motion";

import { decisionColor, decisionLabel } from "@/lib/analysis";

interface DecisionBannerProps {
  decision_statement: string;
  decision_confidence: number;
  decision_rationale: string;
  supporting_frameworks: string[];
  onClick: () => void;
}

function gaugeMetrics(decisionConfidence: number) {
  const normalized = decisionConfidence <= 1 ? decisionConfidence * 100 : decisionConfidence;
  const score = Math.max(0, Math.min(100, normalized));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;
  return { score, radius, circumference, dashOffset };
}

export function DecisionBanner({
  decision_statement,
  decision_confidence,
  decision_rationale,
  supporting_frameworks,
  onClick,
}: DecisionBannerProps) {
  const color = decisionColor(decisionLabel(decision_statement));
  const { score, radius, circumference, dashOffset } = gaugeMetrics(decision_confidence);

  return (
    <motion.button
      type="button"
      role="button"
      aria-label="View decision rationale and evidence"
      onClick={onClick}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full rounded-3xl border bg-[linear-gradient(135deg,rgba(12,18,32,0.96),rgba(17,24,39,0.92))] p-6 text-left shadow-[0_24px_64px_rgba(0,0,0,0.28)]"
      style={{ borderColor: color }}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-4">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
            Strategic Decision
          </div>
          <h2 className="text-2xl font-bold leading-tight text-slate-50 lg:text-[28px]">
            {decision_statement}
          </h2>
          <p className="max-w-3xl text-sm leading-7 text-slate-300">
            {decision_rationale}
          </p>
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

        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
          <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0">
            <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
            <motion.circle
              cx="44"
              cy="44"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              transform="rotate(-90 44 44)"
            />
            <text x="44" y="42" textAnchor="middle" className="fill-slate-50 text-[18px] font-bold">
              {Math.round(score)}
            </text>
            <text x="44" y="58" textAnchor="middle" className="fill-slate-400 text-[10px] uppercase tracking-[0.18em]">
              Confidence
            </text>
          </svg>
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Decision Support</div>
            <div className="text-sm font-semibold text-slate-100">Click to inspect rationale</div>
            <div className="text-xs text-slate-400">Framework evidence, citations, and provenance</div>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
