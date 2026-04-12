"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

import { ReportDownloadButton } from "@/components/ReportDownloadButton";
import { activeContext, contextSummary, decisionColor, latestAgentOutput } from "@/lib/analysis";
import type { Analysis } from "@/lib/api";

type TabKey = "overview" | "financial" | "risk" | "market" | "redteam" | "roadmap" | "cove";

const TABS: TabKey[] = ["overview", "financial", "risk", "market", "redteam", "roadmap", "cove"];

const panel = "rounded-[28px] border border-white/8 bg-[#07101b]/92 p-6";

function scorecardMap(value: any) {
  if (!value || Array.isArray(value)) {
    const mapped: Record<string, any> = {};
    (value || []).forEach((item: any) => {
      const dimension = String(item.dimension || "").toLowerCase();
      if (dimension.includes("financial")) mapped.financial = item;
      if (dimension.includes("customer")) mapped.customer = item;
      if (dimension.includes("internal")) mapped.internal_process = item;
      if (dimension.includes("learning")) mapped.learning_growth = item;
    });
    return mapped;
  }
  return value;
}

function metric(label: string, value: any, tone?: "success" | "warning") {
  const style =
    tone === "success"
      ? "border-emerald-300/18 bg-emerald-300/10"
      : tone === "warning"
        ? "border-amber-300/18 bg-amber-300/10"
        : "border-white/8 bg-white/[0.04]";
  return (
    <div className={`rounded-[22px] border px-5 py-4 ${style}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{value ?? "--"}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={panel}>
      <h3 className="mb-5 text-2xl font-semibold tracking-[-0.04em] text-white">{title}</h3>
      {children}
    </section>
  );
}

export function LegacyAnalysisView({ analysis, streamError }: { analysis: Analysis; streamError: string | null }) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [riskFilter, setRiskFilter] = useState("All");

  const brief = (analysis.strategic_brief || {}) as Record<string, any>;
  const strategist = latestAgentOutput(analysis, "strategist");
  const market = brief.market_analysis || latestAgentOutput(analysis, "market_intel");
  const financial = brief.financial_analysis || latestAgentOutput(analysis, "quant");
  const risk = brief.risk_analysis || latestAgentOutput(analysis, "risk");
  const redTeam = brief.red_team || latestAgentOutput(analysis, "red_team");
  const ethics = brief.ethics || latestAgentOutput(analysis, "ethicist");
  const cove = brief.verification || latestAgentOutput(analysis, "cove");
  const context = activeContext(analysis);
  const scorecard = scorecardMap(brief.balanced_scorecard || brief.balanced_scorecard_legacy);
  const roadmap = Array.isArray(brief.roadmap) ? brief.roadmap : [];
  const selectedPhase = roadmap[phaseIndex];
  const risks = Array.isArray(risk.risk_register) ? risk.risk_register : [];
  const riskCategories: string[] = ["All", ...Array.from(new Set<string>(risks.map((item: any) => String(item.category || "Other"))))];
  const filteredRisks = useMemo(() => (riskFilter === "All" ? risks : risks.filter((item: any) => item.category === riskFilter)), [riskFilter, risks]);
  const verdict = brief.recommendation || analysis.decision_recommendation || "IN REVIEW";
  const confidence = analysis.overall_confidence ?? brief.overall_confidence ?? cove.overall_verification_score ?? null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#040914_0%,#07101d_38%,#081423_100%)] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#050b14]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-200"><ArrowLeft size={15} />Dashboard</Link>
            <div className="mt-3 truncate text-sm font-semibold text-white">{analysis.query}</div>
            <div className="text-xs text-slate-500">{contextSummary(analysis)}</div>
          </div>
          <ReportDownloadButton analysisId={analysis.id} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {streamError ? <div className="mb-6 rounded-[18px] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{streamError}</div> : null}

        <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(14,23,39,0.96),rgba(10,18,34,0.92))] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.4)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:justify-between">
            <div className="max-w-4xl">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Strategic Brief</div>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">{context.company_name || "Strategic Analysis"}</h1>
              <div className="mt-3 text-sm text-slate-500">{format(new Date(analysis.created_at), "dd MMM yyyy")} · {context.sector || "Sector not specified"} · {context.geography || "Geography not specified"}</div>
              <p className="mt-5 text-sm leading-7 text-slate-300">{brief.executive_summary || analysis.executive_summary || "ASIS is preparing the board narrative."}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3 xl:w-[760px]">
              <div className="rounded-[24px] border px-5 py-4" style={{ borderColor: `${decisionColor(verdict)}44`, background: `${decisionColor(verdict)}18` }}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: decisionColor(verdict) }}>Decision</div>
                <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{verdict}</div>
              </div>
              {metric("Confidence", confidence != null ? `${Math.round(Number(confidence))}%` : "--", confidence != null && Number(confidence) >= 75 ? "success" : "warning")}
              {metric("Verification", cove.logic_consistent ? "Consistent" : (cove.recommendation || "Pending"), cove.logic_consistent ? "success" : "warning")}
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-white/8 bg-white/[0.04] px-5 py-4 text-sm leading-7 text-slate-200">
            {brief.board_narrative || "Proceed only at the pace your control environment, execution model, and partner strategy can sustain."}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-[0.14em] ${tab === item ? "bg-white text-slate-950" : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-100"}`}>
              {item}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-6">
          {tab === "overview" ? (
            <>
              <Section title="Strategic Imperatives">
                <div className="grid gap-3">{(brief.strategic_imperatives || strategist.key_hypotheses || strategist.success_criteria || []).map((item: string) => <div key={item} className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">{item}</div>)}</div>
              </Section>
              <Section title="Balanced Scorecard">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Financial", scorecard.financial],
                    ["Customer", scorecard.customer],
                    ["Internal Process", scorecard.internal_process],
                    ["Learning & Growth", scorecard.learning_growth],
                  ].map(([label, item]) => <div key={String(label)} className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4 text-sm text-slate-300"><div className="font-semibold text-white">{label}</div><div className="mt-3 space-y-2"><div>KPI: {item?.kpi || "--"}</div><div>Baseline: {item?.baseline || "--"}</div><div>Target: {item?.target || "--"}</div><div>Timeline: {item?.timeline || "--"}</div></div></div>)}
                </div>
              </Section>
              <Section title="Competitive Benchmarks">
                <div className="grid gap-4 lg:grid-cols-3">{(brief.competitive_benchmarks || market.competitor_benchmarks || []).map((item: any) => <div key={item.dimension} className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4"><div className="text-sm font-semibold text-white">{item.dimension}</div><div className="mt-2 text-xs text-slate-500">Leader: {item.leader_name}</div><div className="mt-4 grid gap-2 text-xs text-slate-400">{[["Our score", item.our_score, "#ffffff"], ["Industry avg", item.industry_avg, "#60a5fa"], ["Leader", item.leader_score, "#34d399"]].map(([label, value, color]) => <div key={String(label)} className="grid grid-cols-[95px_minmax(0,1fr)_34px] items-center gap-2"><span>{label}</span><div className="h-2 rounded-full bg-white/8"><div className="h-full rounded-full" style={{ width: `${value}%`, background: String(color) }} /></div><span>{value}</span></div>)}</div></div>)}</div>
              </Section>
            </>
          ) : null}
          {tab === "financial" ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                {metric("P10", financial.monte_carlo_summary?.p10_outcome)}
                {metric("P50", financial.monte_carlo_summary?.p50_outcome, "success")}
                {metric("P90", financial.monte_carlo_summary?.p90_outcome)}
                {metric("Worst Case", financial.monte_carlo_summary?.worst_case, "warning")}
              </div>
              <Section title="Scenario Analysis">
                <div className="grid gap-4 lg:grid-cols-3">{(financial.investment_scenarios || []).map((item: any) => <div key={item.scenario} className="rounded-[22px] border border-white/8 bg-white/[0.04] p-5 text-sm text-slate-300"><div className="text-lg font-semibold text-white">{item.scenario}</div><div className="mt-4 space-y-2"><div>Capex: {item.capex}</div><div>Opex annual: {item.opex_annual || item.opex}</div><div>IRR: {item.irr}</div><div>ROI (3yr): {item.roi_3yr}</div><div>Payback: {item.payback_months} months</div></div></div>)}</div>
              </Section>
              <Section title="CFO Recommendation">
                <div className="rounded-[22px] border border-cyan-300/18 bg-cyan-300/10 px-5 py-4 text-sm leading-7 text-slate-200">{financial.cfo_recommendation || financial.capital_thesis || "Financial recommendation pending."}</div>
              </Section>
            </>
          ) : null}
          {tab === "risk" ? (
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Section title="Risk Register">
                <div className="mb-4 flex flex-wrap gap-2">{riskCategories.map((category) => <button key={category} type="button" onClick={() => setRiskFilter(category)} className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${riskFilter === category ? "bg-white text-slate-950" : "bg-white/[0.05] text-slate-400"}`}>{category}</button>)}</div>
                <div className="space-y-3">{filteredRisks.map((item: any) => <div key={item.id} className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4 text-sm text-slate-300"><div className="flex flex-wrap items-center justify-between gap-3"><div className="font-semibold text-white">{item.id} · {item.risk}</div><div style={{ color: item.residual_score > 50 ? "#fca5a5" : "#fcd34d" }}>Residual {item.residual_score}</div></div><div className="mt-3 grid gap-2 md:grid-cols-2"><div>Likelihood: {item.likelihood}</div><div>Impact: {item.impact}</div><div>Current control: {item.current_control}</div><div>Mitigation: {item.mitigation}</div></div></div>)}</div>
              </Section>
              <Section title="Risk Heat Map">
                <div className="grid grid-cols-5 gap-2">{Array.from({ length: 25 }, (_, index) => { const x = (index % 5) + 1; const y = 5 - Math.floor(index / 5); const point = (risk.heat_map_data || []).find((item: any) => item.x === x && item.y === y); return <div key={`${x}-${y}`} className={`aspect-square rounded-2xl border p-2 text-[10px] ${point ? "border-rose-300/30 bg-rose-300/10 text-rose-100" : "border-white/8 bg-white/[0.03] text-slate-600"}`}><div className="font-semibold">{x},{y}</div><div className="mt-1 line-clamp-3">{point?.id || ""}</div></div>; })}</div>
                <div className="mt-5 rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-4 text-sm leading-7 text-slate-300">{risk.escalation_rationale || risk.risk_appetite_alignment || "Risk posture is being evaluated."}</div>
              </Section>
            </div>
          ) : null}
          {tab === "market" ? (
            <>
              <Section title="PESTLE Analysis">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Object.entries(market.pestle_analysis || {}).filter(([key]) => key !== "overall_score" && key !== "key_implication").map(([key, value]: [string, any]) => <div key={key} className="rounded-[22px] border border-white/8 bg-white/[0.04] p-5"><div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold uppercase tracking-[0.14em] text-white">{key}</div><div className="text-xl font-semibold text-cyan-100">{value.score}/10</div></div><div className="mt-4 space-y-2 text-sm text-slate-400">{(value.factors || []).map((factor: string) => <div key={factor} className="rounded-xl bg-white/[0.04] px-3 py-2">{factor}</div>)}</div></div>)}</div>
              </Section>
              <Section title="Porter's Five Forces">
                <div className="grid gap-4 lg:grid-cols-2">{Object.entries(market.porters_five_forces || {}).filter(([key]) => key !== "overall_attractiveness" && key !== "strategic_implication").map(([key, value]: [string, any]) => <div key={key} className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4"><div className="flex items-center justify-between gap-4"><div className="text-sm font-semibold text-white">{key.replaceAll("_", " ")}</div><div className="text-lg font-semibold text-slate-200">{value.score}</div></div><div className="mt-3 text-sm leading-7 text-slate-400">{value.rationale}</div></div>)}</div>
              </Section>
              <Section title="Regulatory Landscape">
                <div className="space-y-3">{(market.regulatory_landscape || []).map((item: string) => <div key={item} className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">{item}</div>)}</div>
              </Section>
              <Section title="Strategic Implication">
                <div className="rounded-[22px] border border-cyan-300/18 bg-cyan-300/10 px-5 py-4 text-sm leading-7 text-slate-200">{market.strategic_implication || market.pestle_analysis?.key_implication || "Market implication pending."}</div>
              </Section>
            </>
          ) : null}
          {tab === "redteam" ? (
            <>
              <Section title="Red Team Verdict">
                <div className="rounded-[22px] border border-rose-300/20 bg-rose-300/10 px-5 py-4 text-sm leading-7 text-rose-100">{redTeam.red_team_verdict || "Red Team verdict pending."}</div>
              </Section>
              <div className="grid gap-6 xl:grid-cols-2">
                <Section title="Pre-Mortem Scenarios">
                  <div className="space-y-3">{(redTeam.pre_mortem_scenarios || []).map((item: any) => <div key={item.scenario} className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4 text-sm text-slate-300"><div className="font-semibold text-white">{item.scenario}</div><div className="mt-2">Trigger: {item.trigger_condition || "--"}</div><div className="mt-2">Impact: {item.financial_impact}</div></div>)}</div>
                </Section>
                <Section title="Claims Review">
                  <div className="grid gap-4 md:grid-cols-2"><div className="space-y-3">{(redTeam.invalidated_claims || []).map((item: any) => <div key={item.original_claim} className="rounded-[20px] border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100"><div className="font-semibold">{item.original_claim}</div><div className="mt-2">{item.invalidation_reason}</div></div>)}</div><div className="space-y-3">{(redTeam.surviving_claims || []).map((item: string) => <div key={item} className="rounded-[20px] border border-emerald-300/18 bg-emerald-300/10 p-4 text-sm text-emerald-100">{item}</div>)}</div></div>
                </Section>
              </div>
            </>
          ) : null}
          {tab === "roadmap" ? (
            <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
              <Section title="Phases">
                <div className="space-y-3">{roadmap.map((item: any, index: number) => <button key={item.phase} type="button" onClick={() => setPhaseIndex(index)} className={`w-full rounded-[22px] border px-4 py-4 text-left ${phaseIndex === index ? "border-cyan-300/30 bg-cyan-300/10" : "border-white/8 bg-white/[0.04]"}`}><div className="text-sm font-semibold text-white">{item.phase}</div><div className="mt-1 text-xs text-slate-500">{item.timeline}</div><div className="mt-3 text-sm text-slate-300">{item.focus || item.focus_area}</div></button>)}</div>
              </Section>
              <Section title={selectedPhase ? selectedPhase.phase : "Roadmap Detail"}>
                {selectedPhase ? <div className="space-y-5"><div className="grid gap-4 md:grid-cols-3">{metric("Focus", selectedPhase.focus || selectedPhase.focus_area)}{metric("Investment", selectedPhase.investment, "warning")}{metric("Success Metric", selectedPhase.success_metric, "success")}</div><div className="space-y-3">{(selectedPhase.key_actions || []).map((action: any) => <div key={action.action} className="rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-slate-300"><div className="font-semibold text-white">{action.action}</div><div className="mt-1 text-xs text-slate-500">Owner: {action.owner || "--"} · Deadline: {action.deadline || "--"}</div></div>)}</div></div> : null}
              </Section>
            </div>
          ) : null}
          {tab === "cove" ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {metric("Chain-of-Verification", cove.chain_of_verification_result || cove.recommendation || "--", cove.logic_consistent ? "success" : "warning")}
                {metric("Logic Consistency", cove.logic_consistent ? "Pass" : "Flagged", cove.logic_consistent ? "success" : "warning")}
                {metric("Confidence Adjustment", cove.confidence_adjustment ?? cove.final_confidence_adjustment ?? 0, "warning")}
              </div>
              <div className="grid gap-6 xl:grid-cols-2">
                <Section title="Flagged Claims">
                  <div className="space-y-3">{(cove.flagged_claims || []).length === 0 ? <div className="rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-slate-400">No critical claims were flagged after verification.</div> : (cove.flagged_claims || []).map((item: any) => <div key={item.claim} className="rounded-[22px] border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100"><div className="font-semibold">{item.claim}</div><div className="mt-2">{item.issue}</div></div>)}</div>
                </Section>
                <Section title="Self-Corrections Applied">
                  <div className="space-y-3">{(cove.self_corrections_applied || []).length === 0 ? <div className="rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-slate-400">No self-corrections were required in the final pass.</div> : (cove.self_corrections_applied || []).map((item: any) => <div key={item.original} className="rounded-[22px] border border-emerald-300/18 bg-emerald-300/10 p-4 text-sm text-emerald-100"><div className="font-semibold">{item.original}</div><div className="mt-2">{item.corrected}</div><div className="mt-2 text-xs text-emerald-100/80">{item.reason}</div></div>)}</div>
                </Section>
              </div>
              <Section title="Ethics & Stakeholder Guardrails">
                <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-[22px] border border-white/8 bg-white/[0.04] p-5 text-sm leading-7 text-slate-300">{ethics.brand_risk_assessment || ethics.recommendation || "Ethics review pending."}</div><div className="space-y-3">{(ethics.conditions || ethics.brand_guardrails || []).map((item: string) => <div key={item} className="rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">{item}</div>)}</div></div>
              </Section>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
