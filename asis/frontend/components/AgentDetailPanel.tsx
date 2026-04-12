"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock3, X } from "lucide-react";

import type { AgentCollaborationEvent, AgentLog, FrameworkOutput } from "@/lib/api";
import { frameworkDisplayName } from "@/lib/analysis";

interface AgentDetailPanelProps {
  open: boolean;
  onClose: () => void;
  agentId: string | null;
  agentName: string;
  agentLog?: AgentLog;
  frameworkOutputs: Record<string, FrameworkOutput>;
  collaborationEvents: AgentCollaborationEvent[];
}

export function AgentDetailPanel({
  open,
  onClose,
  agentId,
  agentName,
  agentLog,
  frameworkOutputs,
  collaborationEvents,
}: AgentDetailPanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const producedFrameworks = Object.entries(frameworkOutputs).filter(
    ([, output]) => output.agent_author === agentId
  );
  const consumed = collaborationEvents.filter((event) => event.target_agent === agentId);
  const shared = collaborationEvents.filter((event) => event.source_agent === agentId);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-x-4 top-[6vh] z-50 mx-auto max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-[#08101d] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Agent Detail</div>
                <h3 className="mt-2 text-2xl font-bold text-slate-50">{agentName}</h3>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                  <Clock3 size={14} />
                  {agentLog?.duration_ms != null ? `${agentLog.duration_ms} ms` : "Duration unavailable"}
                  {agentLog?.model_used ? <span>- {agentLog.model_used}</span> : null}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h4 className="text-sm font-semibold text-slate-100">Tools Used</h4>
                <div className="mt-4 space-y-3">
                  {(agentLog?.tools_called || []).length === 0 ? (
                    <div className="text-sm text-slate-400">No external tools recorded for this agent.</div>
                  ) : (
                    (agentLog?.tools_called || []).map((tool, index) => (
                      <div key={`${tool.tool_name}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-sm font-medium text-slate-100">{tool.tool_name}</div>
                        <div className="mt-1 text-xs leading-6 text-slate-400">{tool.query}</div>
                        <div className="mt-2 text-xs text-slate-500">
                          Response size: {tool.response_size} - Latency: {tool.latency_ms} ms
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h4 className="text-sm font-semibold text-slate-100">Frameworks Produced</h4>
                <div className="mt-4 space-y-3">
                  {producedFrameworks.length === 0 ? (
                    <div className="text-sm text-slate-400">This agent produced no standalone framework outputs.</div>
                  ) : (
                    producedFrameworks.map(([key, output]) => (
                      <div key={key} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-slate-100">{frameworkDisplayName(key)}</div>
                          <div className="text-xs font-semibold text-slate-300">
                            {Math.round((output.confidence_score || 0) * 100)}%
                          </div>
                        </div>
                        <div className="mt-2 text-xs leading-6 text-slate-400">{output.narrative}</div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h4 className="text-sm font-semibold text-slate-100">Data Consumed</h4>
                <div className="mt-4 space-y-3">
                  {consumed.length === 0 ? (
                    <div className="text-sm text-slate-400">No upstream dependencies recorded.</div>
                  ) : (
                    consumed.map((event, index) => (
                      <div key={`${event.source_agent}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                        <div className="font-medium text-slate-100">
                          {event.source_agent} - {event.data_field}
                        </div>
                        <div className="mt-1 text-xs leading-6 text-slate-400">{event.contribution_summary}</div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h4 className="text-sm font-semibold text-slate-100">Data Shared</h4>
                <div className="mt-4 space-y-3">
                  {shared.length === 0 ? (
                    <div className="text-sm text-slate-400">No downstream handoffs recorded.</div>
                  ) : (
                    shared.map((event, index) => (
                      <div key={`${event.target_agent}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                        <div className="font-medium text-slate-100">
                          {event.target_agent} - {event.data_field}
                        </div>
                        <div className="mt-1 text-xs leading-6 text-slate-400">{event.contribution_summary}</div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
