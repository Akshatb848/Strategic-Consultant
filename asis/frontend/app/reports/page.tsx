"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Download, FileText, LogOut, Plus, Search, Sparkles, Zap } from "lucide-react";

import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/contexts/AuthContext";
import {
  briefHeadline,
  briefNarrative,
  briefRecommendation,
  confidenceColor,
  decisionColor,
  displayConfidence,
  qualityGradeColor,
  toCsv,
} from "@/lib/analysis";
import { reportsAPI, type QualityReport, type Report } from "@/lib/api";

function reportContext(report: Report): string {
  const context = report.strategic_brief?.context || {};
  const company = context.company_name || report.strategic_brief?.report_metadata?.company_name || "Unnamed organisation";
  const sector = context.sector || "sector not specified";
  const geography = context.geography || "geography not specified";
  return `${company} - ${sector} - ${geography}`;
}

function recommendationBucket(value: unknown): string {
  const normalized = String(value || "").toUpperCase();
  if (normalized.includes("CONDITIONAL PROCEED")) return "conditional";
  if (normalized.includes("DO NOT PROCEED")) return "no-proceed";
  if (normalized.includes("PROCEED")) return "proceed";
  if (normalized.includes("HOLD")) return "hold";
  if (normalized.includes("ESCALATE")) return "escalate";
  return "other";
}

const FILTERS = [
  ["all", "All"],
  ["proceed", "Proceed"],
  ["conditional", "Conditional"],
  ["no-proceed", "Do Not Proceed"],
  ["hold", "Hold"],
  ["escalate", "Escalate"],
] as const;

export default function ReportsPage() {
  return (
    <AuthGuard>
      <ReportsContent />
    </AuthGuard>
  );
}

function ReportsContent() {
  const { logout } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    reportsAPI
      .list()
      .then((response) => setReports(response.data.reports))
      .catch(() => setError("Unable to load reports right now."))
      .finally(() => setLoading(false));
  }, []);

  const filteredReports = useMemo(
    () =>
      reports.filter((report) => {
        const brief = report.strategic_brief || {};
        const recommendation = recommendationBucket(briefRecommendation(brief));
        const haystack = [briefHeadline(brief), briefNarrative(brief), reportContext(report)].join(" ").toLowerCase();
        if (filter !== "all" && recommendation !== filter) return false;
        if (search && !haystack.includes(search.toLowerCase())) return false;
        return true;
      }),
    [filter, reports, search]
  );

  const completedReports = reports.filter((report) => report.pdf_status === "ready").length;
  const qualityGrades = reports
    .map((report) => report.strategic_brief?.quality_report?.overall_grade)
    .filter((grade): grade is string => typeof grade === "string");
  const premiumReports = qualityGrades.filter((grade) => grade === "A" || grade === "B").length;
  const averageConfidence = reports
    .map((report) => displayConfidence(report.strategic_brief?.overall_confidence))
    .filter((value): value is number => typeof value === "number");
  const avgConfidence = averageConfidence.length
    ? Math.round(averageConfidence.reduce((sum, value) => sum + value, 0) / averageConfidence.length)
    : null;

  const exportCsv = () => {
    const csv = toCsv(
      filteredReports.map((report) => ({
        id: report.id,
        analysis_id: report.analysis_id,
        recommendation: briefRecommendation(report.strategic_brief || {}),
        overall_confidence: displayConfidence(report.strategic_brief?.overall_confidence),
        quality_grade: report.strategic_brief?.quality_report?.overall_grade,
        company_name: report.strategic_brief?.context?.company_name,
        sector: report.strategic_brief?.context?.sector,
        geography: report.strategic_brief?.context?.geography,
        created_at: report.created_at,
        updated_at: report.updated_at,
      }))
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "asis-reports.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#040914_0%,#08111e_38%,#091624_100%)] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#050c18]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#204df0,#17b8e6_60%,#84f1cf)] text-lg font-black text-white shadow-[0_18px_40px_rgba(23,184,230,0.16)]">
              A
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[0.22em] text-slate-200">ASIS</div>
              <div className="text-xs text-slate-500">Report command centre</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/analysis/new"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              <Plus size={15} />
              New Analysis
            </Link>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/10"
            >
              <Download size={15} />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:border-white/20 hover:bg-white/10 hover:text-slate-200"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(13,22,38,0.94),rgba(8,16,29,0.92))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.32)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                <Sparkles size={14} />
                Enterprise reports
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-white">Board-ready decision archive</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                Review completed strategic briefs, search by context and verdict, and export the current report set for executive review.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Total reports" value={String(reports.length)} detail="Stored strategic briefs" icon={FileText} />
              <StatCard label="PDF ready" value={String(completedReports)} detail="Downloadable packs" icon={Download} />
              <StatCard label="Avg confidence" value={avgConfidence != null ? `${avgConfidence}%` : "--"} detail={`${premiumReports} premium-grade briefs`} icon={Zap} />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[30px] border border-white/8 bg-[#08101d]/92 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-xl">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search reports by company, geography, decision, or narrative"
                className="w-full rounded-full border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTERS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                    filter === value
                      ? "border-cyan-300/40 bg-cyan-300/12 text-cyan-100"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.05]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          {loading ? (
            <EmptyState title="Loading reports" copy="ASIS is compiling the latest strategic briefs." />
          ) : error ? (
            <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-200">{error}</div>
          ) : filteredReports.length === 0 ? (
            <EmptyState title="No reports found" copy="Try broadening your search or run a new strategic analysis." />
          ) : (
            filteredReports.map((report) => {
              const brief = report.strategic_brief || {};
              const recommendation = briefRecommendation(brief);
              const confidence = displayConfidence(brief.overall_confidence);
              const quality = brief.quality_report as QualityReport | undefined;
              const qualityColor = qualityGradeColor(quality);
              const verdictColor = decisionColor(recommendation);
              return (
                <Link
                  key={report.id}
                  href={`/analysis/${report.analysis_id}`}
                  className="group block rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(13,22,38,0.92),rgba(8,16,29,0.9))] p-6 transition hover:border-white/14 hover:bg-[linear-gradient(180deg,rgba(16,27,46,0.96),rgba(9,18,34,0.94))] hover:shadow-[0_24px_72px_rgba(0,0,0,0.28)]"
                >
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {recommendation ? (
                          <span
                            className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                            style={{
                              color: verdictColor,
                              borderColor: `${verdictColor}33`,
                              background: `${verdictColor}14`,
                            }}
                          >
                            {recommendation}
                          </span>
                        ) : null}
                        {quality?.overall_grade ? (
                          <span
                            className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                            style={{
                              color: qualityColor,
                              borderColor: `${qualityColor}33`,
                              background: `${qualityColor}14`,
                            }}
                          >
                            Quality {quality.overall_grade}
                          </span>
                        ) : null}
                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          v{report.report_version}
                        </span>
                      </div>

                      <h2 className="mt-5 max-w-4xl text-2xl font-semibold tracking-[-0.04em] text-white">
                        {briefHeadline(brief)}
                      </h2>
                      <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-400">{briefNarrative(brief)}</p>

                      <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-500">
                        <span>{reportContext(report)}</span>
                        <span>Updated {formatDistanceToNow(new Date(report.updated_at), { addSuffix: true })}</span>
                        {report.pdf_status ? <span>PDF {report.pdf_status}</span> : null}
                      </div>
                    </div>

                    <div className="grid w-full max-w-sm gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <MetricCard
                        label="Confidence"
                        value={confidence != null ? `${confidence}%` : "--"}
                        accent={confidence != null ? confidenceColor(brief.overall_confidence) : "#94a3b8"}
                        detail="Decision calibration"
                      />
                      <MetricCard
                        label="Checks passed"
                        value={quality ? `${quality.checks.filter((check) => check.passed).length}/${quality.checks.length || 6}` : "--"}
                        accent={quality ? qualityColor : "#64748b"}
                        detail="Quality gate"
                      />
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof FileText;
}) {
  return (
    <article className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
          <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{value}</div>
          <div className="mt-2 text-xs text-slate-500">{detail}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-100">
          <Icon size={16} />
        </div>
      </div>
    </article>
  );
}

function MetricCard({
  label,
  value,
  accent,
  detail,
}: {
  label: string;
  value: string;
  accent: string;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-[-0.04em]" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-2 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-[28px] border border-white/8 bg-[#08101d]/92 px-6 py-16 text-center">
      <FileText size={34} className="mx-auto text-slate-600" />
      <div className="mt-5 text-xl font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm text-slate-400">{copy}</div>
    </div>
  );
}
