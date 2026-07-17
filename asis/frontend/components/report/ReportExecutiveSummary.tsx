import type { StrategicBriefV4 } from "@/lib/api";

import { normalizedPercent } from "@/lib/analysis";

interface ReportExecutiveSummaryProps {
  brief: StrategicBriefV4;
}

export function ReportExecutiveSummary({ brief }: ReportExecutiveSummaryProps) {
  return (
    <section id="executive-summary" className="report-section py-12">
      <div className="rpt-section-header">1. Executive Summary</div>

      <p className="max-w-4xl font-[var(--font-display)] text-2xl leading-snug text-[var(--c-brand)]">
        {brief.executive_summary.headline}
      </p>
      <dl className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="border-l-2 border-[var(--c-brand-rule)] pl-4">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">Strategic issue</dt>
          <dd className="mt-2 text-sm leading-7 text-[var(--c-text)]">{brief.report_metadata.query}</dd>
        </div>
        <div className="border-l-2 border-[var(--c-brand-rule)] pl-4">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">Key finding</dt>
          <dd className="mt-2 text-sm leading-7 text-[var(--c-text)]">{brief.executive_summary.key_argument_1} {brief.executive_summary.key_argument_2}</dd>
        </div>
        <div className="border-l-2 border-[var(--c-brand-rule)] pl-4">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">Overall risk level</dt>
          <dd className="mt-2 text-sm leading-7 text-[var(--c-text)]">{brief.executive_summary.critical_risk}</dd>
        </div>
        <div className="border-l-2 border-[var(--c-brand-rule)] pl-4">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">Strategic opportunity</dt>
          <dd className="mt-2 text-sm leading-7 text-[var(--c-text)]">{brief.executive_summary.key_argument_3}</dd>
        </div>
      </dl>
      <div className="mt-6 border border-[var(--c-divider)] bg-[var(--c-surface)] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">Final recommendation</div>
        <p className="mt-3 text-base leading-7 text-[var(--c-text)]">{brief.recommendation}</p>
        <p className="mt-2 text-sm text-[var(--c-text-muted)]">Confidence: {normalizedPercent(brief.decision_confidence)}%</p>
      </div>
    </section>
  );
}
