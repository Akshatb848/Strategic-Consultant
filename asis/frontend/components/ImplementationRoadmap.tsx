"use client";

import { useState } from "react";

import type { RoadmapItem } from "@/lib/api";

interface ImplementationRoadmapProps {
  roadmap: RoadmapItem[];
}

const PHASE_CLASSES = [
  "from-sky-500/25 to-sky-500/10 border-sky-400/20",
  "from-indigo-500/25 to-indigo-500/10 border-indigo-400/20",
  "from-violet-500/25 to-violet-500/10 border-violet-400/20",
  "from-fuchsia-500/25 to-fuchsia-500/10 border-fuchsia-400/20",
];

export function ImplementationRoadmap({ roadmap }: ImplementationRoadmapProps) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(roadmap[0]?.phase || null);

  return (
    <div className="rounded-3xl border border-white/10 bg-[#08101d] p-5">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-50">Implementation Roadmap</h3>
        <p className="mt-1 text-sm text-slate-400">Four-phase execution path from validation through competitive entrenchment.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-4">
        {roadmap.map((phase, index) => {
          const expanded = expandedPhase === phase.phase;
          return (
            <button
              key={phase.phase}
              type="button"
              onClick={() => setExpandedPhase(expanded ? null : phase.phase)}
              className={`rounded-2xl border bg-gradient-to-br p-4 text-left transition hover:-translate-y-0.5 ${PHASE_CLASSES[index % PHASE_CLASSES.length]}`}
            >
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Phase {index + 1}</div>
              <div className="mt-2 text-base font-semibold text-slate-50">{phase.phase}</div>
              <div className="mt-2 text-sm text-slate-300">{phase.owner_function}</div>
              {phase.estimated_investment_usd != null ? (
                <div className="mt-2 text-xs text-slate-400">
                  Estimated investment: ${phase.estimated_investment_usd.toLocaleString()}
                </div>
              ) : null}
              {expanded ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Actions</div>
                    <ul className="mt-2 space-y-2 text-sm text-slate-200">
                      {phase.actions.map((action) => (
                        <li key={action} className="rounded-xl bg-black/20 px-3 py-2">
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Success Metrics</div>
                    <ul className="mt-2 space-y-2 text-sm text-slate-200">
                      {phase.success_metrics.map((metric) => (
                        <li key={metric} className="rounded-xl bg-black/20 px-3 py-2">
                          {metric}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="mt-4 h-2 rounded-full bg-black/20">
                  <div className="h-2 rounded-full bg-white/70" style={{ width: `${25 + index * 20}%` }} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
