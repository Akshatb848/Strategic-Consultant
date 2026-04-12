"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import type { FrameworkOutput } from "@/lib/api";
import { frameworkDisplayName } from "@/lib/analysis";

interface FrameworkVisualisationPanelProps {
  frameworkOutputs: Record<string, FrameworkOutput>;
  completedFrameworks?: string[];
}

const TABS = [
  "pestle",
  "swot",
  "porters_five_forces",
  "ansoff",
  "bcg_matrix",
  "mckinsey_7s",
  "blue_ocean",
  "balanced_scorecard",
];

export function FrameworkVisualisationPanel({
  frameworkOutputs,
  completedFrameworks = [],
}: FrameworkVisualisationPanelProps) {
  const [activeTab, setActiveTab] = useState("pestle");
  const activeOutput = frameworkOutputs[activeTab];
  const activeConfidence = Math.round((activeOutput?.confidence_score || 0) * 100);

  const pestleData = useMemo(() => {
    const structured = frameworkOutputs.pestle?.structured_data || {};
    return [
      { dimension: "Political", score: structured.political?.score || 0 },
      { dimension: "Economic", score: structured.economic?.score || 0 },
      { dimension: "Social", score: structured.social?.score || 0 },
      { dimension: "Tech", score: structured.technological?.score || 0 },
      { dimension: "Legal", score: structured.legal?.score || 0 },
      { dimension: "Environmental", score: structured.environmental?.score || 0 },
    ];
  }, [frameworkOutputs.pestle]);

  const forcesData = useMemo(() => {
    const structured = frameworkOutputs.porters_five_forces?.structured_data || {};
    return [
      { name: "Rivalry", score: structured.competitive_rivalry?.score || 0 },
      { name: "Entrants", score: structured.threat_of_new_entrants?.score || 0 },
      { name: "Substitutes", score: structured.threat_of_substitutes?.score || 0 },
      { name: "Buyers", score: structured.bargaining_power_buyers?.score || 0 },
      { name: "Suppliers", score: structured.bargaining_power_suppliers?.score || 0 },
    ];
  }, [frameworkOutputs.porters_five_forces]);

  const sevenSData = useMemo(() => {
    const structured = frameworkOutputs.mckinsey_7s?.structured_data || {};
    return [
      { dimension: "Strategy", score: structured.strategy?.score || 0 },
      { dimension: "Structure", score: structured.structure?.score || 0 },
      { dimension: "Systems", score: structured.systems?.score || 0 },
      { dimension: "Staff", score: structured.staff?.score || 0 },
      { dimension: "Style", score: structured.style?.score || 0 },
      { dimension: "Skills", score: structured.skills?.score || 0 },
      { dimension: "Shared Values", score: structured.shared_values?.score || 0 },
    ];
  }, [frameworkOutputs.mckinsey_7s]);

  const bcgData = useMemo(
    () =>
      (frameworkOutputs.bcg_matrix?.structured_data?.business_units || []).map((unit: Record<string, any>) => ({
        x: unit.relative_market_share || 0,
        y: unit.market_growth_rate || 0,
        z: Math.max(20, (unit.relative_market_share || 1) * 60),
        name: unit.name,
        category: unit.category,
      })),
    [frameworkOutputs.bcg_matrix]
  );

  const blueOceanLines = useMemo(() => {
    const structured = frameworkOutputs.blue_ocean?.structured_data || {};
    const factors: string[] = structured.factors || [];
    const companyCurve = structured.company_curve || {};
    const competitorCurves = structured.competitor_curves || {};
    return factors.map((factor) => {
      const row: Record<string, any> = { factor, company: companyCurve[factor] || 0 };
      Object.entries(competitorCurves).forEach(([name, curve]) => {
        row[name] = (curve as Record<string, number>)[factor] || 0;
      });
      return row;
    });
  }, [frameworkOutputs.blue_ocean]);

  return (
    <div className="rounded-3xl border border-white/10 bg-[#08101d] p-5">
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
        {TABS.map((tab) => {
          const isCompleted = completedFrameworks.includes(tab) || !!frameworkOutputs[tab];
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                activeTab === tab
                  ? "border-indigo-400 bg-indigo-500/15 text-indigo-100"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {frameworkDisplayName(tab)} {isCompleted ? "✓" : ""}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {activeOutput ? (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Framework Brief</div>
                <h4 className="mt-2 text-xl font-semibold text-slate-50">{frameworkDisplayName(activeTab)}</h4>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">{activeOutput.narrative}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Produced By</div>
                  <div className="mt-2 text-sm font-semibold text-slate-100">{activeOutput.agent_author}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Confidence</div>
                  <div className="mt-2 text-sm font-semibold text-slate-100">{activeConfidence}%</div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "pestle" && (
          <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
            <div className="h-[340px] rounded-2xl border border-white/10 bg-black/20 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={pestleData}>
                  <PolarGrid stroke="rgba(148,163,184,0.22)" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                  <Radar dataKey="score" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.35} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {[
                ["political", "Political"],
                ["economic", "Economic"],
                ["social", "Social"],
                ["technological", "Technological"],
                ["legal", "Legal"],
                ["environmental", "Environmental"],
              ].map(([key, label]) => {
                const block = activeOutput?.structured_data?.[key] || {};
                return (
                  <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-sm font-semibold text-slate-100">{label}</div>
                    <div className="mt-2 text-xs leading-6 text-slate-400">
                      {(block.factors || []).join(" • ") || "No factors recorded yet."}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "swot" && (
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["strengths", "Strengths", "bg-emerald-500/10 border-emerald-500/20"],
              ["weaknesses", "Weaknesses", "bg-rose-500/10 border-rose-500/20"],
              ["opportunities", "Opportunities", "bg-sky-500/10 border-sky-500/20"],
              ["threats", "Threats", "bg-amber-500/10 border-amber-500/20"],
            ].map(([key, label, style]) => (
              <div key={key} className={`rounded-2xl border p-4 ${style}`}>
                <div className="text-sm font-semibold text-slate-100">{label}</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  {(activeOutput?.structured_data?.[key] || []).map((item: Record<string, any>, index: number) => (
                    <li key={`${key}-${index}`} className="rounded-xl bg-black/20 px-3 py-2">
                      <div>{item.point}</div>
                      <div className="mt-1 text-[11px] text-slate-500">{item.source_agent}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {activeTab === "porters_five_forces" && (
          <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="h-[340px] rounded-2xl border border-white/10 bg-black/20 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={forcesData}>
                  <PolarGrid stroke="rgba(148,163,184,0.22)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                  <Radar dataKey="score" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {forcesData.map((force) => (
                <div key={force.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-100">{force.name}</div>
                    <div className="text-sm font-semibold text-slate-200">{force.score}/10</div>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/5">
                    <div
                      className={`h-2 rounded-full ${force.score >= 7 ? "bg-rose-500" : force.score >= 4 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${force.score * 10}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "ansoff" && (
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["market_penetration", "Existing Product / Existing Market"],
              ["market_development", "Existing Product / New Market"],
              ["product_development", "New Product / Existing Market"],
              ["diversification", "New Product / New Market"],
            ].map(([key, label]) => {
              const item = activeOutput?.structured_data?.[key] || {};
              const isRecommended = activeOutput?.structured_data?.recommended_quadrant === key;
              return (
                <div
                  key={key}
                  className={`rounded-2xl border p-5 ${isRecommended ? "border-indigo-400 bg-indigo-500/10" : "border-white/10 bg-white/[0.03]"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-100">{label}</div>
                    {isRecommended ? (
                      <span className="rounded-full bg-indigo-500 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 text-xs text-slate-400">Feasibility: {Math.round((item.feasibility || 0) * 100)}%</div>
                  <div className="mt-2 text-sm leading-7 text-slate-300">{item.rationale}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(item.initiatives || []).map((initiative: string) => (
                      <span key={initiative} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-slate-300">
                        {initiative}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "bcg_matrix" && (
          <div className="h-[360px] rounded-2xl border border-white/10 bg-black/20 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 12, bottom: 16, left: 8 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="x" name="Relative Share" stroke="#cbd5e1" />
                <YAxis dataKey="y" name="Market Growth" stroke="#cbd5e1" />
                <ZAxis dataKey="z" range={[80, 600]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={bcgData} fill="#38bdf8" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === "mckinsey_7s" && (
          <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
            <div className="h-[340px] rounded-2xl border border-white/10 bg-black/20 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={sevenSData}>
                  <PolarGrid stroke="rgba(148,163,184,0.22)" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                  <Radar dataKey="score" stroke="#818cf8" fill="#818cf8" fillOpacity={0.32} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {[
                "strategy",
                "structure",
                "systems",
                "staff",
                "style",
                "skills",
                "shared_values",
              ].map((dimension) => {
                const item = activeOutput?.structured_data?.[dimension] || {};
                const critical = (item.score || 0) < 5;
                return (
                  <div key={dimension} className={`rounded-2xl border p-4 ${critical ? "border-rose-500/20 bg-rose-500/10" : "border-white/10 bg-white/[0.03]"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold capitalize text-slate-100">{dimension.replace("_", " ")}</div>
                      <div className="text-sm font-semibold text-slate-200">{item.score || 0}/10</div>
                    </div>
                    <div className="mt-2 text-xs leading-6 text-slate-400">{item.current_state}</div>
                    <div className="mt-1 text-xs leading-6 text-slate-500">Gap: {item.gap}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "blue_ocean" && (
          <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
            <div className="h-[360px] rounded-2xl border border-white/10 bg-black/20 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={blueOceanLines}>
                  <CartesianGrid stroke="rgba(148,163,184,0.14)" />
                  <XAxis dataKey="factor" stroke="#cbd5e1" />
                  <YAxis stroke="#cbd5e1" />
                  <Tooltip />
                  <Line type="monotone" dataKey="company" stroke="#38bdf8" strokeWidth={3} />
                  {Object.keys(activeOutput?.structured_data?.competitor_curves || {}).map((name, index) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={["#f59e0b", "#818cf8", "#34d399"][index % 3]}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                ["eliminate", "Eliminate"],
                ["reduce", "Reduce"],
                ["raise", "Raise"],
                ["create", "Create"],
              ].map(([key, label]) => (
                <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-sm font-semibold text-slate-100">{label}</div>
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    {(activeOutput?.structured_data?.[key] || []).map((item: string) => (
                      <li key={item} className="rounded-xl bg-black/20 px-3 py-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "balanced_scorecard" && (
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["financial", "Financial", "border-sky-400/20 bg-sky-500/10"],
              ["customer", "Customer", "border-emerald-400/20 bg-emerald-500/10"],
              ["internal_process", "Internal Process", "border-amber-400/20 bg-amber-500/10"],
              ["learning_and_growth", "Learning & Growth", "border-violet-400/20 bg-violet-500/10"],
            ].map(([key, label, style]) => {
              const block = activeOutput?.structured_data?.[key] || {};
              return (
                <div key={key} className={`rounded-2xl border p-4 ${style}`}>
                  <div className="text-sm font-semibold text-slate-100">{label}</div>
                  {["objectives", "measures", "targets", "initiatives"].map((section) => (
                    <div key={section} className="mt-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{section.replace("_", " ")}</div>
                      <ul className="mt-2 space-y-1 text-sm text-slate-300">
                        {(block[section] || []).map((item: string) => (
                          <li key={item} className="rounded-xl bg-black/20 px-3 py-2">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
