"use client";

import type { QualityReport } from "@/lib/api";
import { qualityGradeColor } from "@/lib/analysis";

export function QualityBadge({ quality }: { quality: QualityReport }) {
  const color = qualityGradeColor(quality);

  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{ borderColor: color, backgroundColor: `${color}1A` }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Quality Grade</div>
          <div className="mt-1 text-lg font-semibold text-slate-50">{quality.overall_grade}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Checks Passed</div>
          <div className="mt-1 text-sm font-semibold text-slate-100">
            {quality.checks.filter((check) => check.passed).length}/{quality.checks.length || 6}
          </div>
        </div>
      </div>
      {quality.quality_flags.length > 0 ? (
        <div className="mt-3 space-y-1 text-xs leading-5 text-slate-300">
          {quality.quality_flags.map((flag) => (
            <div key={flag}>{flag}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
