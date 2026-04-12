"use client";

const QUADRANTS = [
  ["market_penetration", "Existing Product / Existing Market"],
  ["product_development", "New Product / Existing Market"],
  ["market_development", "Existing Product / New Market"],
  ["diversification", "New Product / New Market"],
] as const;

export function AnsoffMatrix({ structuredData }: { structuredData: Record<string, any> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {QUADRANTS.map(([key, label]) => {
        const block = structuredData[key] || {};
        const recommended = structuredData.recommended_quadrant === key;
        return (
          <div
            key={key}
            className={`rounded-2xl border p-5 ${recommended ? "border-indigo-400 bg-indigo-500/10" : "border-white/10 bg-white/[0.03]"}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm font-semibold text-slate-100">{label}</div>
              {recommended ? (
                <span className="rounded-full bg-indigo-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                  Recommended
                </span>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Feasibility</div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${Math.round((block.feasibility || 0) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Risk</div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-amber-400" style={{ width: `${Math.round((block.risk || 0) * 100)}%` }} />
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">{block.rationale}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(block.initiatives || []).map((initiative: string) => (
                <span key={initiative} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-slate-300">
                  {initiative}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
