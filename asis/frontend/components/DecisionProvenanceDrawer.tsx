"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink, X } from "lucide-react";

import type { FrameworkOutput } from "@/lib/api";
import { frameworkDisplayName, frameworkKeyFinding } from "@/lib/analysis";

interface DecisionProvenanceDrawerProps {
  open: boolean;
  onClose: () => void;
  decision_statement: string;
  decision_rationale: string;
  decision_confidence: number;
  supporting_frameworks: string[];
  framework_outputs: Record<string, FrameworkOutput>;
}

export function DecisionProvenanceDrawer({
  open,
  onClose,
  decision_statement,
  decision_rationale,
  decision_confidence,
  supporting_frameworks,
  framework_outputs,
}: DecisionProvenanceDrawerProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    setExpanded(
      Object.fromEntries(supporting_frameworks.map((framework, index) => [framework, index === 0]))
    );
  }, [open, supporting_frameworks]);

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
          <motion.aside
            className="fixed right-0 top-0 z-50 h-full w-full max-w-[480px] overflow-y-auto border-l border-white/10 bg-[#08101d] px-6 py-6 shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Decision Provenance</div>
                <h3 className="text-2xl font-bold leading-tight text-slate-50">{decision_statement}</h3>
                <p className="text-sm leading-7 text-slate-300">{decision_rationale}</p>
                <div className="text-sm font-semibold text-slate-100">
                  Confidence: {Math.round((decision_confidence <= 1 ? decision_confidence * 100 : decision_confidence))}%
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

            <div className="mt-8 space-y-4">
              {supporting_frameworks.map((framework) => {
                const output = framework_outputs[framework];
                const citations = (output?.citations || []).slice(0, 2);
                const isOpen = expanded[framework];
                return (
                  <div key={framework} className="rounded-2xl border border-white/10 bg-white/[0.03]">
                    <button
                      type="button"
                      onClick={() => setExpanded((current) => ({ ...current, [framework]: !current[framework] }))}
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{frameworkDisplayName(framework)}</div>
                        <div className="mt-1 text-xs text-slate-400">Produced by {output?.agent_author || "synthesis"}</div>
                      </div>
                      <ChevronDown
                        size={18}
                        className={`text-slate-400 transition ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="space-y-4 border-t border-white/10 px-4 py-4">
                        <div className="rounded-xl bg-black/20 p-3 text-sm leading-7 text-slate-300">
                          {frameworkKeyFinding(output)}
                        </div>
                        <div className="space-y-3">
                          {citations.map((citation, index) => (
                            <a
                              key={`${framework}-${index}`}
                              href={String(citation.url || "#")}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 transition hover:bg-white/[0.05]"
                            >
                              <div>
                                <div className="text-sm font-medium text-slate-100">{String(citation.title || "Source")}</div>
                                <div className="mt-1 text-xs leading-6 text-slate-400">
                                  {String(citation.excerpt || "")}
                                </div>
                              </div>
                              <ExternalLink size={14} className="mt-1 shrink-0 text-slate-500" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
