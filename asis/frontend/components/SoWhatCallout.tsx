"use client";

import type { SoWhatCallout as SoWhatCalloutType } from "@/lib/api";

export function SoWhatCallout({ callout }: { callout: SoWhatCalloutType }) {
  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-5 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100">So What?</div>
      <div className="mt-3 space-y-2 text-sm leading-7 text-slate-100">
        <p><span className="font-semibold text-cyan-100">Implication:</span> {callout.implication}</p>
        <p><span className="font-semibold text-cyan-100">Recommended Action:</span> {callout.recommended_action}</p>
        <p><span className="font-semibold text-cyan-100">Risk of Inaction:</span> {callout.risk_of_inaction}</p>
      </div>
    </div>
  );
}
