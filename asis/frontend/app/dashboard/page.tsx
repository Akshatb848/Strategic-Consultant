"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  BarChart3,
  ChevronRight,
  FileText,
  Home,
  LogOut,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { motion } from "framer-motion";
import { AuthGuard } from "@/components/auth-guard";
import { SemanticMemoryPanel } from "@/components/SemanticMemoryPanel";
import { useAuth } from "@/contexts/AuthContext";
import { confidenceColor, contextSummary, decisionColor, normalizedPercent } from "@/lib/analysis";
import { analysesAPI, memoryAPI, type Analysis, type MemoryEntry } from "@/lib/api";

function DashboardShell() {
  const { user, logout } = useAuth();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memoryWarning, setMemoryWarning] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [profile, setProfile] = useState({
    company_name: "",
    sector: "",
    hq_country: "",
    annual_revenue_usd_mn: "",
  });

  useEffect(() => {
    let active = true;
    void Promise.allSettled([analysesAPI.list({ limit: 200 }), memoryAPI.list()])
      .then(([analysisResult, memoryResult]) => {
        if (!active) return;

        if (analysisResult.status === "fulfilled") {
          setAnalyses(analysisResult.value.data.analyses);
          setError(null);
        } else {
          setError("Unable to load your analyses right now.");
        }

        if (memoryResult.status === "fulfilled") {
          const memoryItems = (memoryResult.value.data.items || []) as MemoryEntry[];
          const onboardingEntry = memoryItems.find((item) => item.scope === "profile" && item.key === "onboarding:v4_gold");
          const profileEntry = memoryItems.find((item) => item.scope === "profile" && item.key === "company_profile");
          if (profileEntry?.value) {
            setProfile({
              company_name: String(profileEntry.value.company_name || ""),
              sector: String(profileEntry.value.sector || ""),
              hq_country: String(profileEntry.value.hq_country || ""),
              annual_revenue_usd_mn: String(profileEntry.value.annual_revenue_usd_mn || ""),
            });
          }
          setOnboardingOpen(!onboardingEntry?.value?.completed);
          setMemoryWarning(null);
          return;
        }

        setOnboardingOpen(false);
        setMemoryWarning("Company memory is temporarily unavailable. You can still run analyses, but profile saving is paused.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return analyses;
    const needle = search.toLowerCase();
    return analyses.filter((analysis) => {
      const context = contextSummary(analysis).toLowerCase();
      return analysis.query.toLowerCase().includes(needle) || context.includes(needle);
    });
  }, [analyses, search]);

  const completed = analyses.filter((item) => item.status === "completed").length;
  const confidenceValues = analyses
    .filter((item) => item.overall_confidence != null)
    .map((item) => normalizedPercent(item.overall_confidence));
  const avgConfidence = confidenceValues.length
    ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
    : 0;
  const proceedCount = analyses.filter((item) => item.decision_recommendation === "PROCEED").length;

  async function persistProfileMemory(key: string, value: Record<string, any>) {
    try {
      await memoryAPI.upsert({ scope: "profile", key, value });
      setMemoryWarning(null);
    } catch {
      setMemoryWarning("We couldn't save that workspace preference. Your analysis flow still works, but profile memory will retry later.");
    }
  }

  const stats = [
    { label: "Total analyses", value: String(analyses.length), detail: "All strategic decisions", icon: FileText },
    { label: "Completed", value: String(completed), detail: "Finished briefs", icon: TrendingUp },
    { label: "Avg confidence", value: analyses.length ? `${avgConfidence}%` : "--", detail: "Across completed runs", icon: BarChart3 },
    { label: "PROCEED verdicts", value: String(proceedCount), detail: "Positive recommendations", icon: Sparkles },
  ];

  const name = user ? `${user.first_name} ${user.last_name}`.trim() : "Strategist";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#040914_0%,#07101d_38%,#081423_100%)] text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[272px_minmax(0,1fr)]">
        <aside className="border-r border-white/8 bg-[#07101b]/90 px-5 py-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#204df0,#17b8e6_60%,#84f1cf)] text-lg font-black text-white">
              A
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[0.22em] text-slate-200">ASIS</div>
              <div className="text-xs text-slate-500">Strategic workspace</div>
            </div>
          </div>

          <div className="mt-8 space-y-2">
            {[
              { href: "/dashboard", icon: Home, label: "Dashboard", active: true },
              { href: "/new-analysis", icon: Plus, label: "New Analysis", active: false },
              { href: "/reports", icon: FileText, label: "Reports", active: false },
            ].map(({ href, icon: Icon, label, active }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                  active
                    ? "bg-white text-slate-950 shadow-[0_16px_30px_rgba(255,255,255,0.08)]"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                }`}
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}
          </div>

          <div className="mt-10 rounded-[26px] border border-white/8 bg-white/[0.04] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Decision stack</div>
            <div className="mt-3 space-y-2 text-sm text-slate-400">
              {["Orchestrator", "Market Intel", "Risk Assessment", "Competitor Analysis", "Geo Intel", "Financial Reasoning", "Strategic Options", "Synthesis"].map(
                (agent) => (
                  <div key={agent} className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-300/80" />
                    {agent}
                  </div>
                )
              )}
            </div>
          </div>

          {analyses.length > 0 && (
            <SemanticMemoryPanel
              currentQuery={analyses[0]?.query || ""}
              allAnalyses={analyses}
            />
          )}

          <button
            type="button"
            onClick={() => void logout()}
            className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-400 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-slate-100"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </aside>

        <main className="px-6 py-6 lg:px-10">
          <div className="flex flex-col gap-6">
            <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(14,23,39,0.95),rgba(10,18,34,0.92))] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.38)]">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Strategic Dashboard</div>
                  <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">Welcome back, {name}</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                    Search prior analyses, monitor verdict quality, and start a new board-level decision review from
                    the workspace below.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search analyses"
                      className="w-full rounded-full border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 sm:w-72"
                    />
                  </div>
                  <Link
                    href="/new-analysis"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    <Plus size={16} />
                    New Strategic Analysis
                  </Link>
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
              {memoryWarning ? (
                <div className="xl:col-span-2 rounded-[24px] border border-amber-400/20 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
                  {memoryWarning}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {stats.map(({ label, value, detail, icon: Icon }, idx) => (
                  <motion.article
                    key={label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.08, ease: "easeOut" }}
                    className="rounded-[26px] border border-white/8 bg-white/[0.04] p-5 transition-all hover:border-white/14 hover:shadow-[0_8px_32px_rgba(34,211,238,0.06)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
                        <div className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">{value}</div>
                        <div className="mt-2 text-sm text-slate-500">{detail}</div>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-100">
                        <Icon size={18} />
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>

              <Link
                href="/new-analysis"
                className="group rounded-[30px] border border-cyan-300/18 bg-[linear-gradient(145deg,rgba(16,171,231,0.20),rgba(10,18,34,0.95)_62%)] p-6 transition hover:border-cyan-200/40 hover:shadow-[0_25px_70px_rgba(16,171,231,0.16)]"
              >
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <div className="inline-flex rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
                      Launch
                    </div>
                    <h2 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-white">New Strategic Analysis</h2>
                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      Enter the question, organisation, industry, geography, and decision type. ASIS will run the full
                      multi-agent debate and return a board-ready recommendation.
                    </p>
                  </div>
                  <div className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100">
                    Start now
                    <ChevronRight size={16} className="transition group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            </section>

            <section className="rounded-[30px] border border-white/8 bg-[#07101b]/92 p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent analyses</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">Your decision archive</h2>
                </div>
                <div className="text-sm text-slate-500">{filtered.length} visible</div>
              </div>

              {loading ? (
                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-14 text-center text-sm text-slate-400">
                  Loading analyses...
                </div>
              ) : error ? (
                <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 px-5 py-8 text-sm text-rose-200">
                  {error}
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-14 text-center">
                  <div className="text-lg font-semibold text-white">No matching analyses</div>
                  <div className="mt-2 text-sm text-slate-400">Start a new strategic review to populate the dashboard.</div>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filtered.map((analysis, idx) => (
                    <motion.div
                      key={analysis.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: idx * 0.05, ease: "easeOut" }}
                    >
                    <Link
                      href={`/analysis/${analysis.id}`}
                      prefetch={false}
                      className="group block rounded-[26px] border border-white/8 bg-white/[0.03] p-5 transition hover:border-white/14 hover:bg-white/[0.05] hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              {analysis.status}
                            </span>
                            {analysis.used_fallback ? (
                              <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100">
                                Template mode
                              </span>
                            ) : null}
                            {analysis.decision_recommendation && analysis.status !== 'failed' ? (
                              <span
                                className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                                style={{
                                  color: decisionColor(analysis.decision_recommendation),
                                  borderColor: `${decisionColor(analysis.decision_recommendation)}33`,
                                  background: `${decisionColor(analysis.decision_recommendation)}14`,
                                }}
                              >
                                {analysis.decision_recommendation}
                              </span>
                            ) : null}
                          </div>

                          <h3 className="mt-4 text-xl font-semibold tracking-[-0.04em] text-white">{analysis.query}</h3>
                          <p className="mt-3 text-sm leading-7 text-slate-400">{contextSummary(analysis)}</p>

                          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                            <span>{formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true })}</span>
                            {analysis.duration_seconds != null ? <span>{Math.round(analysis.duration_seconds)}s runtime</span> : null}
                            {analysis.total_cost_usd != null ? <span>${analysis.total_cost_usd.toFixed(4)} cost</span> : null}
                            <span>Pipeline {analysis.pipeline_version}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-5 xl:flex-col xl:items-end">
                          <div className="text-right">
                            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Confidence</div>
                            <div className="mt-2 text-3xl font-semibold tracking-[-0.04em]" style={{ color: confidenceColor(analysis.overall_confidence) }}>
                              {analysis.overall_confidence != null ? `${normalizedPercent(analysis.overall_confidence)}%` : "--"}
                            </div>
                          </div>

                          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300">
                            Open analysis
                            <ChevronRight size={17} className="transition group-hover:translate-x-1" />
                          </div>
                        </div>
                      </div>
                    </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      {onboardingOpen ? (
        <OnboardingModal
          step={onboardingStep}
          profile={profile}
          onClose={() => setOnboardingOpen(false)}
          onChange={(key, value) => setProfile((current) => ({ ...current, [key]: value }))}
          onNext={async () => {
            if (onboardingStep === 2) {
              await persistProfileMemory("company_profile", profile);
            }
            if (onboardingStep >= 3) {
              await persistProfileMemory("onboarding:v4_gold", {
                completed: true,
                completed_at: new Date().toISOString(),
              });
              setOnboardingOpen(false);
              return;
            }
            setOnboardingStep((current) => current + 1);
          }}
          onSkip={async () => {
            await persistProfileMemory("onboarding:v4_gold", {
              completed: true,
              skipped: true,
              completed_at: new Date().toISOString(),
            });
            setOnboardingOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardShell />
    </AuthGuard>
  );
}

function OnboardingModal({
  step,
  profile,
  onClose,
  onNext,
  onSkip,
  onChange,
}: {
  step: number;
  profile: Record<string, string>;
  onClose: () => void;
  onNext: () => Promise<void>;
  onSkip: () => Promise<void>;
  onChange: (key: "company_name" | "sector" | "hq_country" | "annual_revenue_usd_mn", value: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-2xl rounded-[30px] border border-white/10 bg-[#08101d] p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100">Getting Started</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">ASIS v4 onboarding</h2>
          </div>
          <button type="button" onClick={() => void onSkip()} className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300">
            Skip
          </button>
        </div>

        {step === 1 ? (
          <div className="mt-6 space-y-4 text-sm leading-7 text-slate-300">
            <p>ASIS turns a strategic question into a board-ready recommendation using eight specialist agents, structured frameworks, and a client-grade enterprise brief.</p>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                "Should our company enter India in 2026 through a partner model?",
                "Should we acquire a regional AI specialist to accelerate growth?",
                "Should we restructure our consulting division to restore margin resilience?",
              ].map((example) => (
                <div key={example} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                  {example}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <ProfileField label="Company name" value={profile.company_name} onChange={(value) => onChange("company_name", value)} />
            <ProfileField label="Sector" value={profile.sector} onChange={(value) => onChange("sector", value)} />
            <ProfileField label="HQ country" value={profile.hq_country} onChange={(value) => onChange("hq_country", value)} />
            <ProfileField label="Revenue (USD mn)" value={profile.annual_revenue_usd_mn} onChange={(value) => onChange("annual_revenue_usd_mn", value)} />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-6 space-y-4 text-sm leading-7 text-slate-300">
            <p>Your profile is ready. The best first analysis is a clear strategic decision question that names the company, market, and timeframe.</p>
            <Link
              href={`/new-analysis?q=${encodeURIComponent(`Should ${profile.company_name || "our company"} enter India in 2026 through a phased partnership strategy?`)}`}
              className="inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950"
              onClick={() => void onNext()}
            >
              Run your first analysis
            </Link>
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between">
          <button type="button" onClick={onClose} className="text-sm text-slate-500">
            Close
          </button>
          <button type="button" onClick={() => void onNext()} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950">
            {step >= 3 ? "Finish" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
      />
    </label>
  );
}
