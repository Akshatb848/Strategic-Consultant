"use client";

const SECTIONS = [
  ["strengths", "Strengths", "border-emerald-500/20 bg-emerald-500/10"],
  ["weaknesses", "Weaknesses", "border-rose-500/20 bg-rose-500/10"],
  ["opportunities", "Opportunities", "border-sky-500/20 bg-sky-500/10"],
  ["threats", "Threats", "border-amber-500/20 bg-amber-500/10"],
] as const;

export function SwotMatrix({ structuredData }: { structuredData: Record<string, any> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {SECTIONS.map(([key, label, style]) => (
        <div key={key} className={`rounded-2xl border p-4 ${style}`}>
          <div className="text-sm font-semibold text-slate-100">{label}</div>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {(structuredData[key] || []).map((item: Record<string, any>, index: number) => (
              <li key={`${key}-${index}`} className="rounded-xl bg-black/20 px-3 py-3">
                <div>{item.point}</div>
                <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">{item.source_agent}</div>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {structuredData.swot_implication ? (
        <div className="md:col-span-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-4 text-sm text-slate-100">
          {structuredData.swot_implication}
        </div>
      ) : null}
    </div>
  );
}
