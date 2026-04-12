"use client";

const SECTIONS = [
  ["financial", "Financial", "border-sky-400/20 bg-sky-500/10"],
  ["customer", "Customer", "border-emerald-400/20 bg-emerald-500/10"],
  ["internal_process", "Internal Process", "border-amber-400/20 bg-amber-500/10"],
  ["learning_and_growth", "Learning & Growth", "border-violet-400/20 bg-violet-500/10"],
] as const;

export function BalancedScorecard({ structuredData }: { structuredData: Record<string, any> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {SECTIONS.map(([key, label, style]) => {
        const block = structuredData[key] || {};
        return (
          <div key={key} className={`rounded-2xl border p-4 ${style}`}>
            <div className="text-sm font-semibold text-slate-100">{label}</div>
            {["objectives", "measures", "targets", "initiatives"].map((section) => (
              <div key={section} className="mt-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{section.replace(/_/g, " ")}</div>
                <ul className="mt-2 space-y-2 text-sm text-slate-300">
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
  );
}
