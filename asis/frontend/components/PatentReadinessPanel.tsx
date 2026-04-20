"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Loader2, Star, AlertTriangle, CheckCircle2, Scale } from "lucide-react";
import { api } from "@/lib/api";

interface PriorArt {
  title: string;
  year: number;
  similarity: "Low" | "Medium" | "High";
  differentiation: string;
}

interface PatentAnalysis {
  novel_mechanisms: string[];
  prior_art_search: PriorArt[];
  utility_proof: string;
  independent_claims: string[];
  dependent_claims: string[];
  patentability_score: number;
  recommended_filing: string;
  filing_rationale: string;
  jurisdiction_recommendations: string[];
  estimated_timeline: string;
}

interface Props {
  analysisId: string;
}

function SimilarityBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    Medium: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    High: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors[level] || colors.Low}`}>
      {level}
    </span>
  );
}

function ScoreArc({ score }: { score: number }) {
  const color = score >= 70 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full border-4 text-2xl font-bold"
        style={{ borderColor: color, color }}
      >
        {score}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500">Patentability</div>
    </div>
  );
}

export function PatentReadinessPanel({ analysisId }: Props) {
  const [patent, setPatent] = useState<PatentAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/api/v1/patent/analyze/${analysisId}`);
      setPatent(res.data.patent_analysis as PatentAnalysis);
      setOpen(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to generate patent analysis.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-3xl border border-amber-400/10 bg-[#0c0d08] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-amber-400" />
            <h2 className="text-lg font-semibold text-slate-50">Patent Readiness</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Prior art search, novelty assessment, utility proof, and patent claims draft.
          </p>
        </div>
        {!patent && (
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/20 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {loading ? "Scanning prior art..." : "Generate Patent Analysis"}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <AnimatePresence>
        {patent && open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-5 space-y-5 overflow-hidden"
          >
            {/* Score + Filing */}
            <div className="flex flex-wrap items-center gap-6">
              <ScoreArc score={patent.patentability_score} />
              <div className="flex-1 space-y-2">
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-widest text-amber-300">Recommended Filing</div>
                  <div className="mt-1 text-base font-semibold text-amber-100">{patent.recommended_filing}</div>
                  <div className="mt-1 text-xs text-slate-400">{patent.filing_rationale}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {patent.jurisdiction_recommendations?.map(j => (
                    <span key={j} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{j}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Novel Mechanisms */}
            <div>
              <div className="mb-2 text-[11px] uppercase tracking-widest text-amber-300">Novel Mechanisms</div>
              <div className="space-y-2">
                {patent.novel_mechanisms.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <Star size={14} className="mt-0.5 shrink-0 text-amber-400" />
                    <span className="text-sm text-slate-200">{m}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Prior Art */}
            <div>
              <div className="mb-2 text-[11px] uppercase tracking-widest text-slate-400">Prior Art Search</div>
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02]">
                      <th className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-slate-500">Reference</th>
                      <th className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-slate-500">Year</th>
                      <th className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-slate-500">Similarity</th>
                      <th className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-slate-500">Differentiation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patent.prior_art_search.map((pa, i) => (
                      <tr key={i} className="border-b border-white/[0.05]">
                        <td className="px-4 py-3 text-xs text-slate-200">{pa.title}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{pa.year}</td>
                        <td className="px-4 py-3"><SimilarityBadge level={pa.similarity} /></td>
                        <td className="px-4 py-3 text-xs text-slate-400">{pa.differentiation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Utility Proof */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <div className="text-[10px] uppercase tracking-widest text-emerald-300">Utility Proof</div>
              </div>
              <p className="text-sm leading-7 text-slate-200">{patent.utility_proof}</p>
            </div>

            {/* Claims */}
            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <div className="mb-2 text-[11px] uppercase tracking-widest text-slate-400">Independent Claims</div>
                <div className="space-y-2">
                  {patent.independent_claims.map((c, i) => (
                    <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 font-mono text-xs leading-6 text-slate-300">
                      {c}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] uppercase tracking-widest text-slate-400">Dependent Claims</div>
                <div className="space-y-2">
                  {patent.dependent_claims.map((c, i) => (
                    <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.01] px-4 py-3 font-mono text-xs leading-6 text-slate-400">
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500">Estimated timeline to first office action: {patent.estimated_timeline}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
