"use client";

import type { QualityReport, StrategicBriefV4 } from "@/lib/api";
import { normalizedPercent } from "@/lib/analysis";

interface StrategicRigourPanelProps {
  brief: StrategicBriefV4;
  quality?: QualityReport | null;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,%]/g, "").replace(/,/g, "").trim();
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatUsdMn(value: unknown): string {
  const numeric = asNumber(value);
  if (numeric == null) return "-";
  return `$${numeric.toFixed(1)}M`;
}

function formatPercent(value: unknown, digits = 0): string {
  const numeric = asNumber(value);
  if (numeric == null) return "-";
  const display = numeric <= 1 ? numeric * 100 : numeric;
  return `${display.toFixed(digits)}%`;
}

function formatMonths(value: unknown): string {
  const numeric = asNumber(value);
  if (numeric == null) return "-";
  return `${Math.round(numeric)} months`;
}

function signalBar(score?: number | null) {
  return `${normalizedPercent(score)}%`;
}

export function StrategicRigourPanel({ brief, quality }: StrategicRigourPanelProps) {
  const marketAnalysis = asRecord(brief.market_analysis);
  const financialAnalysis = asRecord(brief.financial_analysis);
  const riskAnalysis = asRecord(brief.risk_analysis);

  const bottomUp = asRecord(financialAnalysis.bottom_up_revenue_model);
  const sectorBuild = asRecordArray(bottomUp.sector_build);
  const assumptions = asStringArray(bottomUp.key_assumptions);

  const scenarioAnalysis = asRecord(financialAnalysis.scenario_analysis);
  const scenarios = asRecordArray(scenarioAnalysis.scenarios);
  const recommendedCase = String(scenarioAnalysis.recommended_case || "Base");

  const pathways = asRecord(marketAnalysis.strategic_pathways);
  const pathwayOptions = asRecordArray(pathways.options);

  const capabilityFit = asRecord(marketAnalysis.capability_fit_matrix);
  const capabilityRows = asRecordArray(capabilityFit.rows);
  const criticalGaps = asStringArray(capabilityFit.critical_gaps);

  const executionRealism = asRecord(riskAnalysis.execution_realism);
  const executionItems = asRecordArray(executionRealism.items);

  return (
    <section className="rounded-3xl border border-white/10 bg-[#08101d] p-5">
      <div className="flex flex-col gap-5 border-b border-white/10 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300">Commercial Rigour Layer</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-50">Investment logic, pathways, and execution realism</h3>
          <p className="mt-1 max-w-3xl text-sm leading-7 text-slate-400">
            This layer converts the board recommendation into bottom-up economics, scenario envelopes, capability gaps,
            and pathway choices so the analysis reads like an executable strategic case rather than a framework-only narrative.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Pricing Model</div>
            <div className="mt-2 text-sm font-semibold leading-6 text-slate-100">
              {String(bottomUp.pricing_model || executionRealism.pricing_model || "Not specified")}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Year 3 Revenue</div>
            <div className="mt-2 text-2xl font-semibold text-slate-50">{formatUsdMn(bottomUp.total_year_3_revenue_usd_mn)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Recommended Case</div>
            <div className="mt-2 text-2xl font-semibold text-slate-50">{recommendedCase}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Execution Pressure</div>
            <div className="mt-2 text-2xl font-semibold text-slate-50">{String(executionRealism.execution_pressure || "-")}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Bottom-Up Revenue Build</div>
              <h4 className="mt-2 text-base font-semibold text-slate-50">Sector-level commercial build</h4>
            </div>
            <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
              {formatUsdMn(bottomUp.total_year_1_revenue_usd_mn)} to {formatUsdMn(bottomUp.total_year_3_revenue_usd_mn)}
            </div>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            {String(bottomUp.summary || "Bottom-up economics are not available yet.")}
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="pb-3 pr-4">Sector</th>
                  <th className="pb-3 pr-4">Target Clients</th>
                  <th className="pb-3 pr-4">ACV</th>
                  <th className="pb-3 pr-4">Win Rate</th>
                  <th className="pb-3 pr-4">Sales Cycle</th>
                  <th className="pb-3">Year 3 Revenue</th>
                </tr>
              </thead>
              <tbody>
                {sectorBuild.map((entry) => (
                  <tr key={String(entry.sector)} className="border-t border-white/10">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-slate-100">{String(entry.sector || "-")}</div>
                      <div className="text-xs text-slate-500">{String(entry.priority || "-")} priority</div>
                    </td>
                    <td className="py-3 pr-4">{String(entry.target_clients || "-")}</td>
                    <td className="py-3 pr-4">{formatUsdMn(entry.average_contract_value_usd_mn)}</td>
                    <td className="py-3 pr-4">{formatPercent(entry.win_rate)}</td>
                    <td className="py-3 pr-4">{formatMonths(entry.sales_cycle_months)}</td>
                    <td className="py-3 font-medium text-slate-100">{formatUsdMn(entry.year_3_revenue_usd_mn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {assumptions.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {assumptions.map((assumption) => (
                <span key={assumption} className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                  {assumption}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Scenario Envelope</div>
          <h4 className="mt-2 text-base font-semibold text-slate-50">Base, downside, and upside cases</h4>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            {String(
              scenarioAnalysis.decision_rule ||
                "Scenario coverage should anchor commitment to the base case and release additional capital only after milestones are proven."
            )}
          </p>

          <div className="mt-5 space-y-3">
            {scenarios.map((scenario) => {
              const isRecommended = String(scenario.name || "").toLowerCase() === recommendedCase.toLowerCase();
              return (
                <div
                  key={String(scenario.name)}
                  className={`rounded-2xl border p-4 ${isRecommended ? "border-cyan-400/30 bg-cyan-400/10" : "border-white/10 bg-black/20"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-100">{String(scenario.name || "Scenario")}</div>
                    {isRecommended ? (
                      <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Year 3 Revenue</div>
                      <div className="mt-1 text-sm font-semibold text-slate-100">{formatUsdMn(scenario.revenue_year_3_usd_mn)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">EBITDA Margin</div>
                      <div className="mt-1 text-sm font-semibold text-slate-100">{formatPercent(scenario.ebitda_margin_pct, 1)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">ROI Multiple</div>
                      <div className="mt-1 text-sm font-semibold text-slate-100">
                        {asNumber(scenario.roi_multiple)?.toFixed(2) ?? "-"}x
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">IRR / Payback</div>
                      <div className="mt-1 text-sm font-semibold text-slate-100">
                        {formatPercent(scenario.irr_pct, 1)} / {formatMonths(scenario.payback_months)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Strategic Pathways</div>
          <h4 className="mt-2 text-base font-semibold text-slate-50">Route selection before capital commitment</h4>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            {String(pathways.summary || "Strategic pathways are used to compare speed, optionality, and execution strain before making a board-level commitment.")}
          </p>
          <div className="mt-5 space-y-3">
            {pathwayOptions.map((option) => (
              <div
                key={String(option.name)}
                className={`rounded-2xl border p-4 ${option.recommended ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-black/20"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{String(option.name || "Pathway")}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-400">{String(option.strategic_logic || "")}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-right">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Fit Score</div>
                    <div className="mt-1 text-lg font-semibold text-slate-50">{normalizedPercent(asNumber(option.fit_score))}%</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-xs text-slate-300">
                    <div className="uppercase tracking-[0.14em] text-slate-500">Capital Intensity</div>
                    <div className="mt-1 text-sm font-semibold text-slate-100">{String(option.capital_intensity || "-")}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-xs text-slate-300">
                    <div className="uppercase tracking-[0.14em] text-slate-500">Flexibility</div>
                    <div className="mt-1 text-sm font-semibold text-slate-100">{String(option.flexibility || "-")}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-xs text-slate-300">
                    <div className="uppercase tracking-[0.14em] text-slate-500">Execution Risk</div>
                    <div className="mt-1 text-sm font-semibold text-slate-100">{String(option.execution_risk || "-")}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs leading-6 text-slate-400">{String(option.trigger_condition || "")}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Capability Fit Matrix</div>
              <h4 className="mt-2 text-base font-semibold text-slate-50">What the company can build versus what it must accelerate</h4>
            </div>
            <div className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-100">
              {criticalGaps.length} critical gaps
            </div>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            {String(
              capabilityFit.summary ||
                "Capability fit should make explicit which strategic layers can be built internally and which still require external acceleration."
            )}
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="pb-3 pr-4">Capability</th>
                  <th className="pb-3 pr-4">Gap</th>
                  <th className="pb-3 pr-4">Build Fit</th>
                  <th className="pb-3 pr-4">Buy / Partner Fit</th>
                  <th className="pb-3 pr-4">Integration Risk</th>
                  <th className="pb-3">Recommended Action</th>
                </tr>
              </thead>
              <tbody>
                {capabilityRows.map((row) => {
                  const critical = String(row.priority || "").toLowerCase() === "critical";
                  return (
                    <tr key={String(row.capability)} className={`border-t ${critical ? "border-rose-400/20" : "border-white/10"}`}>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-100">{String(row.capability || "-")}</div>
                        <div className="text-xs text-slate-500">{String(row.priority || "-")} priority</div>
                      </td>
                      <td className="py-3 pr-4">{String(row.gap || "-")}</td>
                      <td className="py-3 pr-4">{String(row.build_fit || "-")}</td>
                      <td className="py-3 pr-4">{String(row.acquisition_fit || "-")}</td>
                      <td className="py-3 pr-4">{String(row.integration_risk || "-")}</td>
                      <td className="py-3">{String(row.recommended_action || "-")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Execution Realism</div>
          <h4 className="mt-2 text-base font-semibold text-slate-50">Execution constraints that can break an otherwise attractive thesis</h4>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Commercial Model</div>
              <div className="mt-2 text-sm leading-6 text-slate-100">{String(executionRealism.commercial_model || "-")}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Execution Pressure</div>
              <div className="mt-2 text-sm leading-6 text-slate-100">{String(executionRealism.execution_pressure || "-")}</div>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {executionItems.map((item) => (
              <div key={String(item.factor)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-sm font-semibold text-slate-100">{String(item.factor || "-")}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">Baseline</div>
                <div className="mt-1 text-sm leading-6 text-slate-300">{String(item.baseline || "-")}</div>
                <div className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-500">Risk</div>
                <div className="mt-1 text-sm leading-6 text-slate-300">{String(item.risk || "-")}</div>
                <div className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-500">Mitigation</div>
                <div className="mt-1 text-sm leading-6 text-slate-300">{String(item.mitigation || "-")}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Calibration Signals</div>
          <h4 className="mt-2 text-base font-semibold text-slate-50">Why this confidence and quality level is deserved</h4>
          <div className="mt-5 space-y-4">
            {[
              {
                label: "Context specificity",
                value: quality?.context_specificity_score ?? null,
                note: "How specific the company, market, timing, and decision framing are.",
              },
              {
                label: "Financial grounding",
                value: quality?.financial_grounding_score ?? null,
                note: "How strongly the case is supported by bottom-up economics and scenario coverage.",
              },
              {
                label: "Execution specificity",
                value: quality?.execution_specificity_score ?? null,
                note: "How explicitly the plan addresses capability gaps, GTM friction, and integration constraints.",
              },
            ].map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold text-slate-100">{metric.label}</div>
                  <div className="text-sm font-semibold text-slate-50">{normalizedPercent(metric.value)}%</div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-cyan-400" style={{ width: signalBar(metric.value) }} />
                </div>
                <div className="mt-3 text-sm leading-6 text-slate-400">{metric.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
