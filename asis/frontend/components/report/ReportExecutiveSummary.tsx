import type { AnalysisMeta, StrategicBriefV4 } from "@/lib/api";

import { StatCallout } from "@/components/report/StatCallout";
import { normalizedPercent } from "@/lib/analysis";

interface ReportExecutiveSummaryProps {
  brief: StrategicBriefV4;
  topFindings: string[];
  priorityActions: string[];
  analysisMeta: AnalysisMeta;
}

export function ReportExecutiveSummary({
  brief,
  topFindings,
  priorityActions,
  analysisMeta,
}: ReportExecutiveSummaryProps) {
  return (
    <section id="executive-summary" className="report-section py-12">
      <div className="rpt-section-header">1. Executive summary</div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StatCallout
          label="Decision confidence"
          value={`${normalizedPercent(brief.decision_confidence)}%`}
          detail="Calibrated against the current evidence set"
        />
        <StatCallout
          label="Quality grade"
          value={brief.quality_report?.overall_grade || "B"}
          detail="Composite of logic, evidence, and execution specificity"
        />
        <StatCallout
          label="Frameworks applied"
          value={String((brief.frameworks_applied || []).length)}
          detail="Named analytical lenses used in the final brief"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr,0.65fr]">
        <div className="space-y-4">
          <p className="font-[var(--font-display)] text-2xl leading-snug text-[var(--c-brand)]">
            {brief.executive_summary.headline}
          </p>
          <div className="space-y-3 text-[var(--c-text)]">
            {topFindings.map((finding) => (
              <p key={finding}>• {finding}</p>
            ))}
          </div>
        </div>

        <div className="rounded-[18px] border border-[var(--c-divider)] bg-[var(--c-surface)] p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">
            Priority actions
          </div>
          <ol className="mt-4 space-y-3 text-sm text-[var(--c-text)]">
            {priorityActions.slice(0, 4).map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ol>
        </div>
      </div>

      {analysisMeta.has_blocking_warnings ? (
        <div className="warning-callout mt-6 rounded-[12px]">
          Pre-flight blocking warnings were acknowledged and should be revisited before commitment.
        </div>
      ) : null}

      {analysisMeta.build_vs_buy_verdict ? (
        <div className="mt-6 rounded-[16px] border border-[var(--c-divider)] bg-[var(--c-brand-tint)] p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-brand)]">
            M&A verdict
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--c-text)]">{analysisMeta.build_vs_buy_verdict}</p>
        </div>
      ) : null}
    </section>
  );
}
