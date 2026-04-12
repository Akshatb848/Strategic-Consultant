"use client";

export function CitationList({ citations }: { citations: Array<Record<string, any>> }) {
  if (!citations.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
        No citations available.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Citations</div>
      <ol className="mt-3 space-y-3 text-sm leading-6 text-slate-300">
        {citations.map((citation, index) => (
          <li key={`${citation.url || citation.title || index}`} className="rounded-xl bg-black/20 px-4 py-3">
            <a
              href={String(citation.url || "#")}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-slate-100 underline decoration-slate-500 underline-offset-2"
            >
              {index + 1}. {String(citation.title || "Source")}
            </a>
            <div className="mt-1 text-xs text-slate-400">
              {String(citation.source || "")} {citation.published_at ? `• ${String(citation.published_at)}` : ""}
            </div>
            {citation.excerpt ? <div className="mt-2 text-xs leading-6 text-slate-400">{String(citation.excerpt)}</div> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
