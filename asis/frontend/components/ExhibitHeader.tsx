"use client";

export function ExhibitHeader({
  exhibitNumber,
  title,
  agentAuthor,
  confidence,
}: {
  exhibitNumber: number;
  title: string;
  agentAuthor: string;
  confidence: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Exhibit {exhibitNumber}</div>
          <h3 className="mt-2 text-lg font-semibold leading-7 text-slate-50">{title}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-300">
            {agentAuthor.replace(/_/g, " ")}
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-300">
            Confidence {Math.round((confidence <= 1 ? confidence * 100 : confidence))}%
          </span>
        </div>
      </div>
    </div>
  );
}
