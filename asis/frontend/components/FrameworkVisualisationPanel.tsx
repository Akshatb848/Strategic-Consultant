"use client";

import { useMemo, useState } from "react";

import { CitationList } from "@/components/CitationList";
import { ExhibitHeader } from "@/components/ExhibitHeader";
import { SoWhatCallout } from "@/components/SoWhatCallout";
import { AnsoffMatrix } from "@/components/charts/AnsoffMatrix";
import { BalancedScorecard } from "@/components/charts/BalancedScorecard";
import { BcgBubble } from "@/components/charts/BcgBubble";
import { BlueOceanCanvas } from "@/components/charts/BlueOceanCanvas";
import { Mckinsey7sRadar } from "@/components/charts/Mckinsey7sRadar";
import { PestleRadar } from "@/components/charts/PestleRadar";
import { PorterPentagon } from "@/components/charts/PorterPentagon";
import { SwotMatrix } from "@/components/charts/SwotMatrix";
import type { FrameworkOutput, SoWhatCallout as SoWhatCalloutType } from "@/lib/api";
import { frameworkDisplayName, normalizedPercent } from "@/lib/analysis";

interface FrameworkVisualisationPanelProps {
  frameworkOutputs: Record<string, FrameworkOutput>;
  completedFrameworks?: string[];
  soWhatCallouts?: Record<string, SoWhatCalloutType>;
}

const TABS = [
  "pestle",
  "porters_five_forces",
  "swot",
  "ansoff",
  "bcg_matrix",
  "mckinsey_7s",
  "blue_ocean",
  "balanced_scorecard",
];

function TabCheck({ done }: { done: boolean }) {
  return (
    <span
      className={`ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
        done ? "bg-emerald-500 text-white" : "bg-white/10 text-slate-500"
      }`}
    >
      {done ? "✓" : "•"}
    </span>
  );
}

export function FrameworkVisualisationPanel({
  frameworkOutputs,
  completedFrameworks = [],
  soWhatCallouts = {},
}: FrameworkVisualisationPanelProps) {
  const defaultTab = useMemo(() => TABS.find((tab) => frameworkOutputs[tab]) || "pestle", [frameworkOutputs]);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const output = frameworkOutputs[activeTab];
  const callout = soWhatCallouts[activeTab];

  const chart = useMemo(() => {
    if (!output) return null;
    switch (activeTab) {
      case "pestle":
        return <PestleRadar structuredData={output.structured_data} />;
      case "porters_five_forces":
        return <PorterPentagon structuredData={output.structured_data} />;
      case "swot":
        return <SwotMatrix structuredData={output.structured_data} />;
      case "ansoff":
        return <AnsoffMatrix structuredData={output.structured_data} />;
      case "bcg_matrix":
        return <BcgBubble structuredData={output.structured_data} />;
      case "mckinsey_7s":
        return (
          <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
            <Mckinsey7sRadar structuredData={output.structured_data} />
            <div className="space-y-3">
              {["strategy", "structure", "systems", "staff", "style", "skills", "shared_values"].map((dimension) => {
                const item = output.structured_data[dimension] || {};
                const score = Number(item.score || 0);
                return (
                  <div key={dimension} className={`rounded-2xl border p-4 ${score < 5 ? "border-rose-500/20 bg-rose-500/10" : "border-white/10 bg-white/[0.03]"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold capitalize text-slate-100">{dimension.replace(/_/g, " ")}</div>
                      <div className="text-sm font-semibold text-slate-100">{score}/10</div>
                    </div>
                    <div className="mt-2 text-xs leading-6 text-slate-400">{item.current_state}</div>
                    <div className="mt-1 text-xs leading-6 text-slate-500">Desired State: {item.desired_state}</div>
                    <div className="mt-1 text-xs leading-6 text-slate-500">Gap: {item.gap}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case "blue_ocean":
        return (
          <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
            <BlueOceanCanvas structuredData={output.structured_data} />
            <div className="grid gap-3 md:grid-cols-2">
              {["eliminate", "reduce", "raise", "create"].map((key) => (
                <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-sm font-semibold capitalize text-slate-100">{key}</div>
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    {(output.structured_data[key] || []).map((item: string) => (
                      <li key={item} className="rounded-xl bg-black/20 px-3 py-3">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );
      case "balanced_scorecard":
        return <BalancedScorecard structuredData={output.structured_data} />;
      default:
        return null;
    }
  }, [activeTab, output]);

  return (
    <div className="rounded-3xl border border-white/10 bg-[#08101d] p-5">
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
        {TABS.map((tab) => {
          const done = completedFrameworks.includes(tab) || Boolean(frameworkOutputs[tab]);
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`inline-flex items-center rounded-full border px-4 py-2 text-xs font-semibold transition ${
                activeTab === tab
                  ? "border-indigo-400 bg-indigo-500/15 text-indigo-100"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {frameworkDisplayName(tab)}
              <TabCheck done={done} />
            </button>
          );
        })}
      </div>

      {output ? (
        <div className="mt-6 space-y-6">
          <ExhibitHeader
            exhibitNumber={output.exhibit_number || 0}
            title={output.exhibit_title || frameworkDisplayName(activeTab)}
            agentAuthor={output.agent_author}
            confidence={output.confidence_score}
          />

          {chart}

          {callout ? <SoWhatCallout callout={callout} /> : null}

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
            <div className="grid gap-4 lg:grid-cols-[1fr,220px]">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Framework Narrative</div>
                <p className="mt-3 text-sm leading-7 text-slate-300">{output.narrative}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Confidence</div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${normalizedPercent(output.confidence_score)}%` }} />
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-100">{normalizedPercent(output.confidence_score)}%</div>
              </div>
            </div>
          </div>

          <CitationList citations={output.citations || []} />
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center text-sm text-slate-400">
          This framework has not completed yet.
        </div>
      )}
    </div>
  );
}
