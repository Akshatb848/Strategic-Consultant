"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { reportsAPI, type ReportTheme } from "@/lib/api";

interface ReportDownloadButtonProps {
  analysisId: string;
  theme?: ReportTheme;
}

export function ReportDownloadButton({ analysisId, theme }: ReportDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await reportsAPI.pdf(analysisId, theme);
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = response.headers["content-disposition"] || "";
      const match = disposition.match(/filename="?([^"]+)"?/i);
      link.href = url;
      link.download = match?.[1] || `ASIS_${analysisId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caughtError: unknown) {
      const detail =
        typeof caughtError === "object" &&
        caughtError &&
        "response" in caughtError &&
        typeof (caughtError as { response?: { data?: unknown } }).response?.data === "string"
          ? (caughtError as { response?: { data?: string } }).response?.data
          : null;
      setError(detail || "PDF generation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-3">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2563eb,#38bdf8)] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        Download Enterprise Report (PDF)
      </button>
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}
