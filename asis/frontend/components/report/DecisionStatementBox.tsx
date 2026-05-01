import type { AnalysisMeta, StrategicBriefV4 } from "@/lib/api";
import { normalizedPercent } from "@/lib/analysis";
import { reportConfidenceLabel } from "@/lib/reporting";

interface DecisionStatementBoxProps {
  brief: StrategicBriefV4;
  analysisMeta: AnalysisMeta;
}

export function DecisionStatementBox({ brief, analysisMeta }: DecisionStatementBoxProps) {
  const confidence = normalizedPercent(brief.decision_confidence);
  const hasFatal = (analysisMeta.fatal_invalidation_count || 0) > 0;

  return (
    <section className="decision-box rounded-[18px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="decision-verdict">{brief.recommendation || "Decision"}</div>
          <h2 className="decision-statement">{brief.decision_statement}</h2>
          <p className="text-[var(--c-text-muted)]">{brief.decision_rationale}</p>
          {analysisMeta.has_blocking_warnings ? (
            <div className="warning-callout mt-4 rounded-[12px]">
              Blocking assumptions remain unresolved and should be cleared before commitment.
            </div>
          ) : null}
          {analysisMeta.recommendation_downgraded ? (
            <div className={`mt-4 rounded-[12px] px-4 py-3 text-sm ${hasFatal ? "danger-callout" : "warning-callout"}`}>
              Original assessment: {analysisMeta.original_recommendation || "Provisional"} • Final assessment adjusted after
              red-team challenge.
            </div>
          ) : null}
        </div>

        <div className="min-w-[220px] border-l border-[var(--c-divider)] pl-0 lg:pl-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">
            Confidence
          </div>
          <div className="mt-2 text-4xl font-semibold text-[var(--c-brand)]">{confidence}%</div>
          <div className="mt-2 text-sm text-[var(--c-text-muted)]">{reportConfidenceLabel(brief.decision_confidence)}</div>
          <div className="mt-4 space-y-2 text-xs text-[var(--c-text-muted)]">
            <div>Quality grade: {brief.quality_report?.overall_grade || "B"}</div>
            <div>Fatal invalidations: {analysisMeta.fatal_invalidation_count || 0}</div>
            <div>Major invalidations: {analysisMeta.major_invalidation_count || 0}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
