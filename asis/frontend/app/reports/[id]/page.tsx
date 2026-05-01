"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Palette, Printer } from "lucide-react";

import { AuthGuard } from "@/components/auth-guard";
import { ConsultantReportView } from "@/components/ConsultantReportView";
import { ReportDownloadButton } from "@/components/ReportDownloadButton";
import { reportsAPI, type Report, type ReportTheme, type StrategicBriefV4 } from "@/lib/api";
import { isStrategicBriefV4 } from "@/lib/analysis";
import { REPORT_THEME_OPTIONS } from "@/lib/reporting";

export default function ReportDetailPage() {
  return (
    <AuthGuard>
      <ReportDetailContent />
    </AuthGuard>
  );
}

function ReportDetailContent() {
  const params = useParams<{ id: string }>();
  const reportId = String(params.id);
  const [report, setReport] = useState<Report | null>(null);
  const [theme, setTheme] = useState<ReportTheme>("mckinsey");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reportsAPI
      .get(reportId)
      .then((response) => {
        setReport(response.data.report as Report);
        setError(null);
      })
      .catch(() => setError("Unable to load the consultant report view right now."))
      .finally(() => setLoading(false));
  }, [reportId]);

  const brief = report?.strategic_brief;

  return (
    <div className="min-h-screen bg-[var(--c-bg-page)] text-[var(--c-text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--c-divider)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/reports" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--c-brand)]">
              <ArrowLeft size={16} />
              Back to reports
            </Link>
            <div className="hidden h-6 w-px bg-[var(--c-divider)] lg:block" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-text-faint)]">
                Board-ready report
              </div>
              <div className="mt-1 text-sm text-[var(--c-text-muted)]">
                Theme-controlled consultant presentation and PDF export
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--c-divider)] bg-white px-2 py-2">
              <Palette size={14} className="ml-2 text-[var(--c-text-muted)]" />
              {REPORT_THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    theme === option.value
                      ? "bg-[var(--c-brand)] text-white"
                      : "text-[var(--c-text-muted)] hover:bg-[var(--c-brand-tint)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <ReportDownloadButton analysisId={report?.analysis_id || reportId} theme={theme} />
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--c-divider)] bg-white px-4 py-3 text-sm font-semibold text-[var(--c-brand)]"
            >
              <Printer size={15} />
              Print
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="mx-auto max-w-4xl px-6 py-16 text-center text-[var(--c-text-muted)]">Loading report...</div>
      ) : error ? (
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="danger-callout rounded-[16px]">{error}</div>
        </div>
      ) : isStrategicBriefV4(brief) ? (
        <ConsultantReportView brief={brief as StrategicBriefV4} theme={theme} />
      ) : (
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="warning-callout rounded-[16px]">
            A consultant-ready report view is not available for this legacy analysis payload.
          </div>
        </div>
      )}
    </div>
  );
}
