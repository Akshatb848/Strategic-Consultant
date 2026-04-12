"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";

import { AuthGuard } from "@/components/auth-guard";
import { AgentCollaborationGraph } from "@/components/AgentCollaborationGraph";
import { DecisionBanner } from "@/components/DecisionBanner";
import { DecisionProvenanceDrawer } from "@/components/DecisionProvenanceDrawer";
import { FrameworkVisualisationPanel } from "@/components/FrameworkVisualisationPanel";
import { ImplementationRoadmap } from "@/components/ImplementationRoadmap";
import { LegacyAnalysisView } from "@/components/LegacyAnalysisView";
import { ReportDownloadButton } from "@/components/ReportDownloadButton";
import {
  analysesAPI,
  type Analysis,
  type AgentCollaborationEvent,
  type FrameworkOutput,
  type StrategicBriefV4,
} from "@/lib/api";
import {
  decisionLabel,
  frameworkDisplayName,
  isStrategicBriefV4,
  latestAgentLog,
  latestAgentStatus,
  uniqueSupportingFrameworks,
} from "@/lib/analysis";
import { subscribeToAnalysisEvents } from "@/lib/sse";

const V4_AGENTS = [
  { id: "orchestrator", label: "Orchestrator" },
  { id: "market_intel", label: "Market Intel" },
  { id: "risk_assessment", label: "Risk Assessment" },
  { id: "competitor_analysis", label: "Competitor Analysis" },
  { id: "geo_intel", label: "Geo Intel" },
  { id: "financial_reasoning", label: "Financial Reasoning" },
  { id: "strategic_options", label: "Strategic Options" },
  { id: "synthesis", label: "Synthesis" },
] as const;

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [collaborationEvents, setCollaborationEvents] = useState<AgentCollaborationEvent[]>([]);
  const [completedFrameworks, setCompletedFrameworks] = useState<string[]>([]);
  const [decisionVisible, setDecisionVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await analysesAPI.get(analysisId);
      setAnalysis(response.data.analysis as Analysis);
      setError(null);
    } catch (caughtError: any) {
      setError(caughtError?.response?.data?.detail || "Failed to load analysis.");
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  useEffect(() => {
    void load();
  }, [load]);

  const brief = useMemo<StrategicBriefV4 | null>(() => {
    if (!isStrategicBriefV4(analysis?.strategic_brief)) return null;
    return analysis.strategic_brief;
  }, [analysis]);

  useEffect(() => {
    if (!brief) {
      setCollaborationEvents([]);
      setCompletedFrameworks([]);
      setDecisionVisible(false);
      return;
    }
    setCollaborationEvents(brief.agent_collaboration_trace || []);
    setCompletedFrameworks(Object.keys(brief.framework_outputs || {}));
    setDecisionVisible(Boolean(brief.decision_statement));
  }, [brief]);

  useEffect(() => {
    if (!analysis || analysis.status === "failed") return;
    return subscribeToAnalysisEvents(analysisId, {
      onEvent: (event) => {
        if (event.event === "agent_complete" || event.event === "analysis_complete") {
          void load();
        }

        if (event.event === "agent_collaboration") {
          setCollaborationEvents((current) => [
            ...current,
            {
              source_agent: String(event.data.source || ""),
              target_agent: String(event.data.target || ""),
              data_field: String(event.data.field || ""),
              timestamp_ms: Number(event.data.timestamp_ms || Date.now()),
              contribution_summary: String(event.data.summary || ""),
            },
          ]);
        }

        if (event.event === "framework_complete") {
          const framework = String(event.data.framework || "");
          if (framework) {
            setCompletedFrameworks((current) => (current.includes(framework) ? current : [...current, framework]));
          }
        }

        if (event.event === "decision_reached") {
          setDecisionVisible(true);
          window.setTimeout(() => {
            document.getElementById("decision-banner")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 60);
        }
      },
      onError: (caughtError) => setStreamError(caughtError.message),
    });
  }, [analysis, analysisId, load]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#040914] text-slate-400">Loading analysis...</div>;
  }

  if (error || !analysis) {
    return <div className="flex min-h-screen items-center justify-center bg-[#040914] text-rose-300">{error || "Analysis not found"}</div>;
  }

  if (!brief) {
    if (analysis.pipeline_version.startsWith("4")) {
      return <V4AnalysisLoadingView analysis={analysis} streamError={streamError} />;
    }
    return <LegacyAnalysisView analysis={analysis} streamError={streamError} />;
  }

  const supportingFrameworkKeys = uniqueSupportingFrameworks(
    collaborationEvents,
    brief.framework_outputs || {}
  );
  const supportingFrameworkLabels = supportingFrameworkKeys.map((framework) => frameworkDisplayName(framework));
  const decisionRationale = brief.decision_rationale || brief.board_narrative || brief.executive_summary;

  return (
    <>
      <div className="min-h-screen bg-[linear-gradient(180deg,#040914_0%,#08111e_38%,#091624_100%)] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-7xl space-y-6">
          {streamError ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {streamError}
            </div>
          ) : null}

          <section className="rounded-3xl border border-white/10 bg-[#08101d] p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Strategic Brief v4.0</div>
                <h1 className="text-3xl font-semibold text-slate-50">{analysis.query}</h1>
                <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                  <span>{brief.report_metadata.company_name}</span>
                  <span>•</span>
                  <span>{new Date(analysis.created_at).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{analysis.status}</span>
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
                {decisionLabel(brief.decision_statement)}
              </div>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Decision Confidence</div>
                <div className="mt-2 text-2xl font-semibold text-slate-50">{Math.round(brief.decision_confidence * 100)}%</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Frameworks Completed</div>
                <div className="mt-2 text-2xl font-semibold text-slate-50">{Object.keys(brief.framework_outputs || {}).length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Collaboration Events</div>
                <div className="mt-2 text-2xl font-semibold text-slate-50">{collaborationEvents.length}</div>
              </div>
            </div>
          </section>

          {decisionVisible ? (
            <section id="decision-banner">
              <DecisionBanner
                decision_statement={brief.decision_statement}
                decision_confidence={brief.decision_confidence}
                decision_rationale={decisionRationale}
                supporting_frameworks={supportingFrameworkLabels}
                onClick={() => setDrawerOpen(true)}
              />
            </section>
          ) : null}

          <section className="rounded-3xl border border-white/10 bg-[#08101d] p-5">
            <button
              type="button"
              onClick={() => setSummaryExpanded((current) => !current)}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <div>
                <h2 className="text-lg font-semibold text-slate-50">Executive Summary</h2>
                <p className="mt-1 text-sm text-slate-400">Board-level narrative and recommendation context.</p>
              </div>
              {summaryExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </button>
            {summaryExpanded ? (
              <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
                {brief.executive_summary
                  .split(/\n+/)
                  .map((paragraph) => paragraph.trim())
                  .filter(Boolean)
                  .map((paragraph, index) => (
                    <p key={`summary-${index}`}>{paragraph}</p>
                  ))}
              </div>
            ) : null}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.6fr,1fr]">
            <AgentCollaborationGraph
              collaborationEvents={collaborationEvents}
              agentLogs={analysis.agent_logs || []}
              frameworkOutputs={brief.framework_outputs || {}}
            />

            <div className="rounded-3xl border border-white/10 bg-[#08101d] p-5">
              <h3 className="text-lg font-semibold text-slate-50">Agent Status</h3>
              <p className="mt-1 text-sm text-slate-400">Execution progress across the v4 framework pipeline.</p>
              <div className="mt-5 space-y-3">
                {V4_AGENTS.map((agent) => {
                  const status = latestAgentStatus(analysis.agent_logs, agent.id);
                  const log = latestAgentLog(analysis.agent_logs, agent.id);
                  const ownedFrameworks = Object.entries(brief.framework_outputs || {}).filter(
                    ([, output]) => output.agent_author === agent.id
                  );
                  return (
                    <div key={agent.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-100">{agent.label}</div>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                          {status}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {log?.duration_ms != null ? `${log.duration_ms} ms` : "No execution log yet"}
                      </div>
                      {ownedFrameworks.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {ownedFrameworks.map(([frameworkKey]) => (
                            <span
                              key={`${agent.id}-${frameworkKey}`}
                              className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-400"
                            >
                              {frameworkDisplayName(frameworkKey)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <FrameworkVisualisationPanel
            frameworkOutputs={brief.framework_outputs || {}}
            completedFrameworks={completedFrameworks}
          />

          <ImplementationRoadmap roadmap={brief.implementation_roadmap || []} />

          <div className="flex justify-end">
            <ReportDownloadButton analysisId={analysis.id} />
          </div>
        </div>
      </div>

      <DecisionProvenanceDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        decision_statement={brief.decision_statement}
        decision_rationale={decisionRationale}
        decision_confidence={brief.decision_confidence}
        supporting_frameworks={supportingFrameworkKeys}
        framework_outputs={brief.framework_outputs as Record<string, FrameworkOutput>}
      />
    </>
  );
}

function V4AnalysisLoadingView({
  analysis,
  streamError,
}: {
  analysis: Analysis;
  streamError: string | null;
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
                ASIS is generating the framework-driven strategic brief. The decision banner and framework tabs will appear as the synthesis step finishes.
              </p>
            </div>
            <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100">
              {analysis.status}
            </div>
          </div>

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
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
