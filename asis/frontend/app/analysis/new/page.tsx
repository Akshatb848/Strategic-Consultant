"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { analysesAPI, memoryAPI } from "@/lib/api";
import { subscribeToAnalysisEvents } from "@/lib/sse";

type AgentStatus = "pending" | "in_progress" | "completed" | "failed";

const PIPELINE = [
  { id: "orchestrator", label: "Orchestrator", message: "Framing the board question and routing the specialist agents..." },
  { id: "market_intel", label: "Market Intel", message: "Sizing demand, trends, and external market structure..." },
  { id: "risk_assessment", label: "Risk Assessment", message: "Building the risk register and downside exposures..." },
  { id: "competitor_analysis", label: "Competitor Analysis", message: "Scoring rivalry and competitive positioning..." },
  { id: "geo_intel", label: "Geo Intel", message: "Scanning geopolitical, regulatory, and CAGE distance factors..." },
  { id: "financial_reasoning", label: "Financial Reasoning", message: "Testing the capital case, BCG view, and balanced scorecard seed..." },
  { id: "strategic_options", label: "Strategic Options", message: "Scoring Ansoff, Blue Ocean, and McKinsey 7S fit..." },
  { id: "synthesis", label: "Synthesis", message: "Finalising the decision statement, executive summary, and roadmap..." },
] as const;

const QUERY_TEMPLATES = [
  { label: "Market Entry", value: "Should [company] enter [market] in [year]?" },
  { label: "M&A Evaluation", value: "Should [company] acquire [target]?" },
  { label: "Product Launch", value: "Should [company] launch [product] in [market]?" },
  { label: "Competitive Response", value: "How should [company] respond to [competitor]?" },
  { label: "Restructuring", value: "Should [company] restructure [division]?" },
  { label: "Investment Decision", value: "Should [company] invest $[X]M in [initiative]?" },
] as const;

function pendingStatuses(): Record<string, AgentStatus> {
  return Object.fromEntries(PIPELINE.map((step) => [step.id, "pending"])) as Record<string, AgentStatus>;
}

function completedStatuses(): Record<string, AgentStatus> {
  return Object.fromEntries(PIPELINE.map((step) => [step.id, "completed"])) as Record<string, AgentStatus>;
}

function markFailedStatus(
  current: Record<string, AgentStatus>,
  failedAgent?: string | null,
): Record<string, AgentStatus> {
  const next = { ...current };
  const explicitAgent = failedAgent && failedAgent in next ? failedAgent : null;
  const inferredAgent =
    explicitAgent ||
    [...PIPELINE].reverse().find((step) => next[step.id] === "in_progress")?.id ||
    [...PIPELINE].reverse().find((step) => next[step.id] !== "completed")?.id ||
    "synthesis";
  next[inferredAgent] = "failed";
  return next;
}

function statusesFromAnalysis(analysis: {
  status?: string | null;
  current_agent?: string | null;
  agent_logs?: Array<{ agent_id?: string | null }> | null;
}): Record<string, AgentStatus> {
  if (analysis.status === "completed") {
    return completedStatuses();
  }

  const next = pendingStatuses();
  for (const log of analysis.agent_logs || []) {
    const agentId = String(log?.agent_id || "");
    if (agentId in next) {
      next[agentId] = "completed";
    }
  }

  const currentAgent = String(analysis.current_agent || "");
  if (analysis.status === "running" && currentAgent in next && next[currentAgent] !== "completed") {
    next[currentAgent] = "in_progress";
  }

  if (analysis.status === "failed") {
    return markFailedStatus(next, currentAgent || "synthesis");
  }

  return next;
}

function messageFromAnalysis(analysis: {
  status?: string | null;
  current_agent?: string | null;
  error_message?: string | null;
}) {
  if (analysis.status === "failed") {
    return analysis.error_message || "The analysis failed before the strategic brief could be completed.";
  }

  const active = PIPELINE.find((step) => step.id === analysis.current_agent);
  if (active) {
    return active.message;
  }

  if (analysis.status === "completed") {
    return "Strategic brief complete. Opening the analysis workspace...";
  }

  return "ASIS is preparing your strategic review...";
}

function evaluateQueryQuality(query: string) {
  const lower = query.toLowerCase();
  let score = 10;
  const suggestions: string[] = [];

  if (/\bshould\b|\bhow should\b/.test(lower)) score += 30;
  else suggestions.push("Frame the prompt as a decision question.");

  if (/\b20\d{2}\b|\bq[1-4]\b|\bnext year\b|\bthis year\b/.test(lower)) score += 20;
  else suggestions.push("Add a timeframe such as 2026 or Q3.");

  if (/\bindia\b|\buk\b|\beurope\b|\bmarket\b|\bregion\b/.test(lower)) score += 20;
  else suggestions.push("Name the market or geography explicitly.");

  if (/\bcompany\b|\bacquire\b|\blaunch\b|\benter\b|\brestructure\b|\binvest\b/.test(lower)) score += 10;
  else suggestions.push("Use a strategic action verb such as enter, acquire, launch, or invest.");

  if (query.trim().split(/\s+/).length >= 10) score += 20;
  else suggestions.push("Add more specificity so the agents can size the opportunity properly.");

  return {
    score: Math.max(0, Math.min(100, score)),
    suggestions,
  };
}

function NewAnalysisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading } = useAuth();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [organisation, setOrganisation] = useState("");
  const [industry, setIndustry] = useState("");
  const [geography, setGeography] = useState("");
  const [decisionType, setDecisionType] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [analysisId, setAnalysisId] = useState<string | null>(searchParams.get("analysisId"));
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>(pendingStatuses);
  const [liveMessage, setLiveMessage] = useState("ASIS is preparing your strategic review...");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [streamError, setStreamError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await memoryAPI.list();
        const profile = (response.data.items || []).find((item: Record<string, any>) => item.scope === "profile" && item.key === "company_profile");
        if (!profile?.value) return;
        setOrganisation((current) => current || String(profile.value.company_name || ""));
        setIndustry((current) => current || String(profile.value.sector || ""));
        setGeography((current) => current || String(profile.value.hq_country || ""));
      } catch {
        // Best-effort autofill only.
      }
    })();
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!analysisId) return;
    const unsubscribe = subscribeToAnalysisEvents(analysisId, {
      onEvent: (event) => {
        if (event.event === "agent_start") {
          const agentId = String(event.data.agent);
          setStatuses((current) => {
            const next = { ...current };
            for (const step of PIPELINE) {
              if (step.id === agentId) {
                next[step.id] = "in_progress";
                break;
              }
              if (next[step.id] === "pending") break;
            }
            return next;
          });
          const active = PIPELINE.find((step) => step.id === agentId);
          if (active) setLiveMessage(active.message);
        }

        if (event.event === "agent_complete") {
          const agentId = String(event.data.agent);
          setStatuses((current) => ({ ...current, [agentId]: "completed" }));
        }

        if (event.event === "analysis_complete") {
          setStatuses(completedStatuses());
          setLiveMessage("Strategic brief complete. Opening the analysis workspace...");
          window.setTimeout(() => router.replace(`/analysis/${analysisId}`), 900);
        }

        if (event.event === "analysis_failed") {
          setError(String(event.data.message || "ASIS could not complete the analysis."));
          setLiveMessage(String(event.data.message || "The analysis failed before the brief was completed."));
          setStatuses((current) => markFailedStatus(current, String(event.data.current_agent || "synthesis")));
        }

        if (event.event === "framework_complete") {
          const framework = String(event.data.framework || "").replaceAll("_", " ");
          if (framework) {
            setLiveMessage(`Framework completed: ${framework}.`);
          }
        }

        if (event.event === "decision_reached") {
          setLiveMessage(String(event.data.statement || "Decision reached. Preparing the full brief..."));
        }
      },
      onError: () => {
        setStreamError("Live progress disconnected. The analysis is still running and will appear on the dashboard.");
      },
    });
    return unsubscribe;
  }, [analysisId, router]);

  useEffect(() => {
    if (!analysisId) return;

    let cancelled = false;
    let redirectTimer: number | undefined;

    const syncAnalysis = async () => {
      try {
        const response = await analysesAPI.get(analysisId);
        if (cancelled) return;

        const analysis = response.data.analysis;
        setStatuses(statusesFromAnalysis(analysis));
        setLiveMessage(messageFromAnalysis(analysis));

        if (analysis.status === "completed") {
          redirectTimer = window.setTimeout(() => router.replace(`/analysis/${analysisId}`), 900);
          return;
        }

        if (analysis.status === "failed") {
          setError(String(analysis.error_message || "ASIS could not complete the analysis."));
        }
      } catch {
        // The SSE stream remains the primary source of truth; polling is best effort.
      }
    };

    void syncAnalysis();
    const intervalId = window.setInterval(() => {
      void syncAnalysis();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [analysisId, router]);

  const progress = useMemo(() => {
    const completed = PIPELINE.filter((step) => statuses[step.id] === "completed").length;
    return Math.round((completed / PIPELINE.length) * 100);
  }, [statuses]);
  const hasFailed = useMemo(() => PIPELINE.some((step) => statuses[step.id] === "failed"), [statuses]);
  const displayedProgress = hasFailed ? Math.min(progress, 99) : progress;

  const queryQuality = useMemo(() => evaluateQueryQuality(query), [query]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 20) {
      setError("Enter a fuller strategic question so the agents have enough context.");
      return;
    }

    setSubmitting(true);
    setError("");
    setStreamError("");
    setStatuses(pendingStatuses());
    setLiveMessage("ASIS is preparing your strategic review...");

    try {
      const response = await analysesAPI.create({
        query: query.trim(),
        company_context: {
          company_name: organisation || undefined,
          sector: industry || undefined,
          geography: geography || undefined,
          decision_type: decisionType || undefined,
        },
      });
      const createdId = response.data.analysis.id;
      setAnalysisId(createdId);
      setSubmitting(false);
      router.replace(`/new-analysis?analysisId=${createdId}`);
    } catch (caughtError: any) {
      setError(caughtError?.response?.data?.detail || "ASIS could not start the analysis. Please try again.");
      setSubmitting(false);
    }
  }

  if (analysisId) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(24,116,255,0.18),transparent_34%),linear-gradient(180deg,#040914_0%,#08111e_38%,#091624_100%)] text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-200">
            <ArrowLeft size={15} />
            Back to dashboard
          </Link>

          <div className="mt-10 rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(14,23,39,0.96),rgba(10,18,34,0.92))] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Analysis Running</div>
                <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">Creating your strategic brief</h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">{liveMessage}</p>
              </div>

              <div
                className={`flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-semibold ${
                  hasFailed ? "border-rose-300/30 bg-rose-400/10 text-rose-100" : "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
                }`}
              >
                {hasFailed ? null : <Loader2 size={15} className="animate-spin" />}
                {hasFailed ? "Analysis failed" : `${displayedProgress}% complete`}
              </div>
            </div>

            <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/6">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  hasFailed ? "bg-rose-400" : "bg-[linear-gradient(90deg,#1b6af2,#2dd4bf)]"
                }`}
                style={{ width: `${displayedProgress}%` }}
              />
            </div>

            {streamError ? (
              <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                {streamError}
              </div>
            ) : null}

            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {PIPELINE.map((step, index) => {
                const status = statuses[step.id];
                const isActive = status === "in_progress";
                const isComplete = status === "completed";
                const isFailed = status === "failed";
                return (
                  <div
                    key={step.id}
                    className={`rounded-[24px] border px-5 py-4 transition ${
                      isFailed
                        ? "border-rose-300/30 bg-rose-400/10"
                        : isActive
                        ? "border-cyan-300/30 bg-cyan-300/10"
                        : isComplete
                          ? "border-emerald-300/18 bg-emerald-300/10"
                          : "border-white/8 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                            isFailed
                              ? "bg-rose-200 text-slate-950"
                              : isActive
                              ? "bg-cyan-200 text-slate-950"
                              : isComplete
                                ? "bg-emerald-200 text-slate-950"
                                : "bg-white/8 text-slate-300"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">{step.label}</div>
                          <div className="text-xs text-slate-500">{step.message}</div>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                          isFailed
                            ? "bg-rose-200 text-slate-950"
                            : isActive
                            ? "bg-cyan-200 text-slate-950"
                            : isComplete
                              ? "bg-emerald-200 text-slate-950"
                              : "bg-white/8 text-slate-400"
                        }`}
                      >
                        {status === "failed" ? "Failed" : status === "in_progress" ? "In Progress" : status === "completed" ? "Completed" : "Pending"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(24,116,255,0.18),transparent_34%),linear-gradient(180deg,#040914_0%,#08111e_38%,#091624_100%)] text-slate-100">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-200">
          <ArrowLeft size={15} />
          Back to dashboard
        </Link>

        <div className="mt-10 rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(14,23,39,0.96),rgba(10,18,34,0.92))] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
              <Sparkles size={14} />
              New analysis
            </div>
            <h1 className="mt-5 text-5xl font-semibold tracking-[-0.06em] text-white">Start a strategic review</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              Enter the question the board is trying to answer. ASIS will route the query through orchestrator,
              market intelligence, risk assessment, competitor analysis, geo intelligence, financial reasoning,
              strategic options, and synthesis before returning the final brief.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[220px,1fr]">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Query template</span>
                <select
                  value={selectedTemplate}
                  onChange={(event) => {
                    const nextTemplate = event.target.value;
                    setSelectedTemplate(nextTemplate);
                    const chosen = QUERY_TEMPLATES.find((template) => template.value === nextTemplate);
                    if (chosen) {
                      setQuery(chosen.value.replace("[company]", organisation || "[company]").replace("[market]", geography || "[market]"));
                    }
                  }}
                  className="w-full rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                >
                  <option value="">Select a template</option>
                  {QUERY_TEMPLATES.map((template) => (
                    <option key={template.label} value={template.value}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-medium text-slate-200">Query quality</div>
                  <div
                    className={`text-sm font-semibold ${
                      queryQuality.score < 40 ? "text-rose-300" : queryQuality.score < 70 ? "text-amber-300" : "text-emerald-300"
                    }`}
                  >
                    {queryQuality.score}/100
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div
                    className={`h-2 rounded-full ${
                      queryQuality.score < 40 ? "bg-rose-400" : queryQuality.score < 70 ? "bg-amber-400" : "bg-emerald-400"
                    }`}
                    style={{ width: `${queryQuality.score}%` }}
                  />
                </div>
                <div className="mt-3 text-xs leading-6 text-slate-400">
                  {queryQuality.suggestions[0] || "This prompt is specific enough to produce a strategic, action-oriented brief."}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Strategic Question</label>
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Should Apex Strategy Group enter the Indian fintech market in 2026 through a phased partnership strategy?"
                rows={6}
                className="w-full rounded-[24px] border border-white/8 bg-white/[0.04] px-5 py-4 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Organisation" value={organisation} onChange={setOrganisation} placeholder="Apex Strategy Group" />
              <Field label="Industry" value={industry} onChange={setIndustry} placeholder="Strategy & Management Consulting" />
              <Field label="Geography" value={geography} onChange={setGeography} placeholder="India" />
              <Field label="Decision Type" value={decisionType} onChange={setDecisionType} placeholder="Market entry" />
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {submitting ? "Starting analysis..." : "Create Analysis"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
      />
    </label>
  );
}

function NewAnalysisShell() {
  return <div className="min-h-screen bg-[#040914]" />;
}

export default function NewAnalysisPage() {
  return (
    <Suspense fallback={<NewAnalysisShell />}>
      <NewAnalysisContent />
    </Suspense>
  );
}
