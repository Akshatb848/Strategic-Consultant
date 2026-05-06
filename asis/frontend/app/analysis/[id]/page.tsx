"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronUp, Printer, Share2 } from "lucide-react";

import { motion } from "framer-motion";
import { AgentCollaborationGraph } from "@/components/AgentCollaborationGraph";
import { AuthGuard } from "@/components/auth-guard";
import { BaselineComparisonPanel } from "@/components/BaselineComparisonPanel";
import { DecisionBanner } from "@/components/DecisionBanner";
import { DecisionProvenanceDrawer } from "@/components/DecisionProvenanceDrawer";
import { DissertationPanel } from "@/components/DissertationPanel";
import { FallbackBanner } from "@/components/FallbackBanner";
import { FailureDiagnosticsPanel } from "@/components/FailureDiagnosticsPanel";
import { FrameworkVisualisationPanel } from "@/components/FrameworkVisualisationPanel";
import { ImplementationRoadmap } from "@/components/ImplementationRoadmap";
import { LegacyAnalysisView } from "@/components/LegacyAnalysisView";
import { PatentReadinessPanel } from "@/components/PatentReadinessPanel";
import { QualityBadge } from "@/components/QualityBadge";
import { ReportDownloadButton } from "@/components/ReportDownloadButton";
import { StrategicRigourPanel } from "@/components/StrategicRigourPanel";
import {
  analysesAPI,
  reportsAPI,
  type Analysis,
  type AgentCollaborationEvent,
  type FrameworkOutput,
  type QualityReport,
  type StrategicBriefV4,
} from "@/lib/api";
import {
  decisionLabel,
  dedupeCollaborationEvents,
  frameworkDisplayName,
  isStrategicBriefV4,
  latestAgentLog,
  latestAgentStatus,
  normalizedPercent,
  summaryParagraphs,
  uniqueSupportingFrameworks,
} from "@/lib/analysis";
import { subscribeToAnalysisEvents } from "@/lib/sse";

const V4_AGENTS = [
  { id: "orchestrator", label: "Orchestrator" },
  { id: "market_intel", label: "Market Intelligence" },
  { id: "risk_assessment", label: "Risk Assessment" },
  { id: "competitor_analysis", label: "Competitor Analysis" },
  { id: "geo_intel", label: "Geo Intelligence" },
  { id: "financial_reasoning", label: "Financial Reasoning" },
  { id: "strategic_options", label: "Strategic Options" },
  { id: "synthesis", label: "Synthesis" },
] as const;

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

export default function AnalysisDetailPage() {
  return (
    <AuthGuard>
      <AnalysisDetailContent />
    </AuthGuard>
  );
}

function AnalysisDetailContent() {
  const params = useParams<{ id: string }>();
  const analysisId = String(params.id);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [allAnalyses, setAllAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [collaborationEvents, setCollaborationEvents] = useState<AgentCollaborationEvent[]>([]);
  const [hydratedFrameworks, setHydratedFrameworks] = useState<Record<string, FrameworkOutput>>({});
  const [completedFrameworks, setCompletedFrameworks] = useState<string[]>([]);
  const [decisionVisible, setDecisionVisible] = useState(false);
  const [sectionActionTitles, setSectionActionTitles] = useState<Record<string, string>>({});
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const hasScrolledToDecisionRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [analysisRes, listRes] = await Promise.allSettled([
        analysesAPI.get(analysisId),
        analysesAPI.list({ limit: 20, status: 'completed' }),
      ]);
      if (analysisRes.status === 'fulfilled') {
        setAnalysis(analysisRes.value.data.analysis as Analysis);
        setError(null);
      } else {
        setError((analysisRes.reason as any)?.response?.data?.detail || "Failed to load analysis.");
      }
      if (listRes.status === 'fulfilled') {
        setAllAnalyses((listRes.value.data.analyses || []) as Analysis[]);
      }
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    hasScrolledToDecisionRef.current = false;
  }, [analysisId]);

  const brief = useMemo<StrategicBriefV4 | null>(() => {
    if (!isStrategicBriefV4(analysis?.strategic_brief)) return null;
    return analysis.strategic_brief;
  }, [analysis]);

  useEffect(() => {
    if (!brief) {
      setCollaborationEvents([]);
      setCompletedFrameworks([]);
      setDecisionVisible(false);
      setSectionActionTitles({});
      setQualityReport(null);
      setHydratedFrameworks({});
      return;
    }
    setCollaborationEvents(dedupeCollaborationEvents(brief.agent_collaboration_trace || []));
    setCompletedFrameworks(Object.keys(brief.framework_outputs || {}));
    setDecisionVisible(Boolean(brief.decision_statement));
    setSectionActionTitles(brief.section_action_titles || {});
    setQualityReport(brief.quality_report || null);
    if (analysis?.status === "completed" && brief.decision_statement) {
      hasScrolledToDecisionRef.current = true;
    }
  }, [analysis?.status, brief]);

  useEffect(() => {
    if (!brief || analysis?.status !== "completed") return;
    let active = true;
    void (async () => {
      try {
        const [frameworksResponse, collaborationResponse] = await Promise.all([
          reportsAPI.frameworks(analysisId),
          reportsAPI.collaboration(analysisId),
        ]);
        if (!active) return;
        setHydratedFrameworks(frameworksResponse.data.framework_outputs || {});
        setCollaborationEvents(dedupeCollaborationEvents(collaborationResponse.data.agent_collaboration_trace || []));
      } catch {
        // Fall back to the embedded brief payload if the report endpoints are not ready yet.
      }
    })();
    return () => {
      active = false;
    };
  }, [analysis?.status, analysisId, brief]);

  useEffect(() => {
    if (!analysis || analysis.status === "failed" || analysis.status === "completed") return;
    return subscribeToAnalysisEvents(analysisId, {
      onEvent: (event) => {
        if (event.event === "analysis_complete" || event.event === "analysis_failed") {
          void load();
        }

        if (event.event === "orchestrator_complete") {
          setSectionActionTitles((current: Record<string, string>) => ({ ...current, ...(event.data.section_action_titles || {}) }));
        }

        if (event.event === "agent_collaboration") {
          setCollaborationEvents((current: AgentCollaborationEvent[]) =>
            dedupeCollaborationEvents([
              ...current,
              {
                source_agent: String(event.data.source || ""),
                target_agent: String(event.data.target || ""),
                data_field: String(event.data.field || ""),
                timestamp_ms: Number(event.data.timestamp_ms || Date.now()),
                contribution_summary: String(event.data.summary || ""),
              },
            ])
          );
        }

        if (event.event === "framework_complete") {
          const framework = String(event.data.framework || "");
          if (framework) {
            setCompletedFrameworks((current: string[]) => (current.includes(framework) ? current : [...current, framework]));
          }
        }

        if (event.event === "decision_reached") {
          setDecisionVisible(true);
          if (!hasScrolledToDecisionRef.current) {
            hasScrolledToDecisionRef.current = true;
            window.setTimeout(() => {
              document.getElementById("decision-banner")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 60);
          }
        }

        if (event.event === "quality_complete") {
          setQualityReport({
            overall_grade: event.data.overall_grade || "B",
            quality_flags: event.data.quality_flags || [],
            checks: event.data.checks || [],
            mece_score: event.data.mece_score || 0,
            citation_density_score: event.data.citation_density_score || 0,
            internal_consistency_score: event.data.internal_consistency_score || 0,
            context_specificity_score: event.data.context_specificity_score || 0,
            financial_grounding_score: event.data.financial_grounding_score || 0,
            execution_specificity_score: event.data.execution_specificity_score || 0,
            retry_count: event.data.retry_count || 0,
          });
        }
      },
      onError: (caughtError) => setStreamError(caughtError.message),
    });
  }, [analysis, analysisId, load]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[linear-gradient(180deg,#040914_0%,#08111e_100%)]">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,#204df0,#17b8e6_60%,#84f1cf)] text-2xl font-black text-white shadow-[0_0_40px_rgba(23,184,230,0.3)]">
          A
        </div>
        <div className="space-y-2 text-center">
          <div className="text-sm font-semibold text-slate-200">Loading analysis...</div>
          <div className="flex items-center gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return <div className="flex min-h-screen items-center justify-center bg-[#040914] text-rose-300">{error || "Analysis not found"}</div>;
  }

  if (!brief) {
    if (analysis.pipeline_version?.startsWith("4")) {
      return <V4AnalysisLoadingView analysis={analysis} streamError={streamError} actionTitles={sectionActionTitles} />;
    }
    return <LegacyAnalysisView analysis={analysis} streamError={streamError} />;
  }

  const displayFrameworks = Object.keys(hydratedFrameworks).length > 0 ? hydratedFrameworks : (brief.framework_outputs || {});
  const displayQuality = qualityReport || brief.quality_report;
  const supportingFrameworkKeys = uniqueSupportingFrameworks(collaborationEvents, displayFrameworks);
  const supportingFrameworkLabels = supportingFrameworkKeys.map((framework) => frameworkDisplayName(framework));
  const context = (brief.context || analysis.extracted_context || analysis.company_context || {}) as Record<string, unknown>;
  const geographyLabel =
    typeof context.geography === "string" && context.geography.trim().length > 0
      ? context.geography
      : "Target market";

  const handleShare = async () => {
    const url = `${window.location.origin}/analysis/${analysis.id}`;
    if (navigator.share) {
      await navigator.share({ title: brief.report_metadata?.company_name, text: brief.decision_statement, url });
      return;
    }
    await navigator.clipboard.writeText(url);
  };

  return (
    <>
      <div className="min-h-screen bg-[linear-gradient(180deg,#040914_0%,#08111e_38%,#091624_100%)] px-4 py-6 text-slate-100 md:px-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {streamError ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {streamError}
            </div>
          ) : null}

          {analysis.used_fallback ? <FallbackBanner /> : null}

          <section className="sticky top-4 z-30 rounded-3xl border border-white/10 bg-[#08101d]/95 px-5 py-4 backdrop-blur">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <span>{brief.report_metadata.company_name}</span>
                  <span>{geographyLabel}</span>
                  <span>{new Date(analysis.created_at).toLocaleDateString()}</span>
                </div>
                <h1 className="text-xl font-semibold text-slate-50">{sectionActionTitles.decision || truncate(analysis.query, 110)}</h1>
                <p className="max-w-3xl text-sm leading-7 text-slate-400">
                  Executive narrative, framework evidence, and exportable report pack generated from the active ASIS pipeline.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Confidence</div>
                  <div className="mt-2 text-lg font-semibold text-slate-50">{normalizedPercent(brief.decision_confidence)}%</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Frameworks</div>
                  <div className="mt-2 text-lg font-semibold text-slate-50">{Object.keys(displayFrameworks).length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Quality</div>
                  <div className="mt-2 text-lg font-semibold text-slate-50">{displayQuality.overall_grade}</div>
                </div>
              </div>
            </div>
          </section>

          {decisionVisible ? (
            <section id="decision-banner">
              <DecisionBanner
                decision_statement={brief.decision_statement}
                decision_confidence={brief.decision_confidence}
                decision_rationale={brief.decision_rationale}
                supporting_frameworks={supportingFrameworkLabels}
                quality_report={displayQuality}
                onClick={() => setDrawerOpen(true)}
              />
            </section>
          ) : null}

          <section className="rounded-3xl border border-white/10 bg-[#08101d] p-5">
            <button type="button" onClick={() => setSummaryExpanded((current) => !current)} className="flex w-full items-center justify-between gap-4 text-left">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">Executive Summary</h2>
                <p className="mt-1 text-sm text-slate-400">Pyramid-principle summary for C-suite review.</p>
              </div>
              {summaryExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </button>
            {summaryExpanded ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm font-semibold leading-7 text-slate-100">
                  {brief.executive_summary.headline}
                </div>
                <div className="grid gap-4 xl:grid-cols-3">
                  {[brief.executive_summary.key_argument_1, brief.executive_summary.key_argument_2, brief.executive_summary.key_argument_3].map((argument, index) => (
                    <div key={`argument-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Key Argument {index + 1}</div>
                      <div className="mt-3 text-sm leading-7 text-slate-300">{argument}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 xl:grid-cols-[1fr,1fr]">
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-5 py-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-amber-100">Critical Risk</div>
                    <div className="mt-3 text-sm leading-7 text-slate-100">{brief.executive_summary.critical_risk}</div>
                  </div>
                  <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-5 py-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-blue-100">Recommended Next Step</div>
                    <div className="mt-3 text-sm leading-7 text-slate-100">{brief.executive_summary.next_step}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.6fr,1fr]">
            <AgentCollaborationGraph
              collaborationEvents={collaborationEvents}
              agentLogs={analysis.agent_logs || []}
              frameworkOutputs={displayFrameworks}
            />

            <div className="rounded-3xl border border-white/10 bg-[#08101d] p-5">
              <h3 className="text-lg font-semibold text-slate-50">Agent Status Panel</h3>
              <p className="mt-1 text-sm text-slate-400">Execution metadata, owning frameworks, and current status by agent.</p>
              <div className="mt-5 space-y-3">
                {V4_AGENTS.map((agent) => {
                  const log = latestAgentLog(analysis.agent_logs, agent.id);
                  const status = latestAgentStatus(analysis.agent_logs, agent.id);
                  const ownedFrameworks = Object.entries(displayFrameworks).filter(([, output]) => output.agent_author === agent.id);
                  return (
                    <div key={agent.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-100">{agent.label}</div>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                          {status}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                        <div>{log?.duration_ms != null ? `${log.duration_ms} ms` : "No duration yet"}</div>
                        <div>{log?.model_used || "Model pending"}</div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {ownedFrameworks.length > 0 ? ownedFrameworks.map(([frameworkKey]) => (
                          <span key={`${agent.id}-${frameworkKey}`} className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                            {frameworkDisplayName(frameworkKey)}
                          </span>
                        )) : (
                          <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                            No framework
                          </span>
                        )}
                      </div>
                      {log?.confidence_score != null ? (
                        <div className="mt-3 text-xs text-slate-400">Agent quality score: {normalizedPercent(log.confidence_score)}%</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <FrameworkVisualisationPanel
            frameworkOutputs={displayFrameworks}
            completedFrameworks={completedFrameworks}
            soWhatCallouts={brief.so_what_callouts || {}}
          />

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <StrategicRigourPanel brief={brief} quality={displayQuality} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <ImplementationRoadmap roadmap={brief.implementation_roadmap || []} />
          </motion.div>

          {/* Baseline Comparison */}
          {allAnalyses.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <BaselineComparisonPanel currentAnalysis={analysis} allAnalyses={allAnalyses} />
            </motion.div>
          )}

          {/* Failure Diagnostics — show when failed or very low confidence */}
          {(analysis.status === 'failed' || (analysis.overall_confidence != null && normalizedPercent(analysis.overall_confidence) < 55)) && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <FailureDiagnosticsPanel analysis={analysis} agentLogs={analysis.agent_logs} onRetry={() => void load()} />
            </motion.div>
          )}

          {/* Patent Readiness */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <PatentReadinessPanel analysisId={analysis.id} />
          </motion.div>

          {/* Dissertation Research Framework */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
            <DissertationPanel
              analysisId={analysis.id}
              dissertationContribution={(brief as any)?.dissertation_contribution as string | undefined}
            />
          </motion.div>

          <section className="flex flex-wrap items-center justify-end gap-3 rounded-3xl border border-white/10 bg-[#08101d] p-5">
            <ReportDownloadButton analysisId={analysis.id} />
            <button type="button" onClick={handleShare} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200">
              <Share2 size={15} />Share Analysis
            </button>
            <Link href={`/reports/${analysis.id}`} className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200">
              Board-ready report
            </Link>
            <Link href="/new-analysis" className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200">
              Start New
            </Link>
          </section>
        </div>
      </div>

      <DecisionProvenanceDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        decision_statement={brief.decision_statement}
        decision_rationale={brief.decision_rationale}
        decision_confidence={brief.decision_confidence}
        supporting_frameworks={supportingFrameworkKeys}
        framework_outputs={displayFrameworks}
      />
    </>
  );
}

function V4AnalysisLoadingView({
  analysis,
  streamError,
  actionTitles,
}: {
  analysis: Analysis;
  streamError: string | null;
  actionTitles: Record<string, string>;
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#040914_0%,#08111e_45%,#091624_100%)] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        {streamError ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {streamError}
          </div>
        ) : null}

        <section className="rounded-3xl border border-white/10 bg-[#08101d] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Analysis in progress</div>
              <h1 className="mt-2 text-3xl font-semibold text-slate-50">{analysis.query}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                ASIS is building the board-ready v4 brief. Framework exhibits, quality scoring, and the final decision banner will appear as synthesis completes.
              </p>
            </div>
            <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100">
              {analysis.status}
            </div>
          </div>

          {Object.keys(actionTitles).length > 0 ? (
            <div className="mt-6 grid gap-3 xl:grid-cols-3">
              {Object.entries(actionTitles).slice(0, 3).map(([key, title]) => (
                <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-slate-300">
                  {title}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {V4_AGENTS.map((agent) => {
              const status = latestAgentStatus(analysis.agent_logs, agent.id);
              const log = latestAgentLog(analysis.agent_logs, agent.id);
              return (
                <div key={agent.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-100">{agent.label}</div>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                      {status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{log?.duration_ms != null ? `${log.duration_ms} ms` : "Waiting"}</div>
                </div>
              );