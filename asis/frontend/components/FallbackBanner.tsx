"use client";

import { AlertTriangle } from "lucide-react";

interface FallbackBannerProps {
  compact?: boolean;
}

export function FallbackBanner({ compact = false }: FallbackBannerProps) {
  return (
    <div
      className={`rounded-3xl border border-amber-400/25 bg-amber-400/10 text-amber-50 shadow-[0_18px_40px_rgba(245,158,11,0.08)] ${
        compact ? "px-4 py-3" : "px-5 py-4"
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">Template Mode</div>
          <p className="text-sm leading-6 text-amber-50/95">
            This analysis used structured fallback output instead of live model reasoning. Treat figures as illustrative
            until provider credentials are configured and a fresh run is completed.
          </p>
        </div>
      </div>
    </div>
  );
}
