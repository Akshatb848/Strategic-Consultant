"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Brain, ChevronRight } from "lucide-react";
import type { Analysis } from "@/lib/api";
import { confidenceColor, decisionColor, normalizedPercent } from "@/lib/analysis";

interface Props {
  currentQuery: string;
  allAnalyses: Analysis[];
}

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 3));
}

function similarity(a: string, b: string): number {
  const tokA = tokenize(a);
  const tokB = tokenize(b);
  let overlap = 0;
  for (const t of tokA) { if (tokB.has(t)) overlap++; }
  return overlap / Math.max(tokA.size, tokB.size, 1);
}

export function SemanticMemoryPanel({ currentQuery, allAnalyses }: Props) {
  const similar = allAnalyses
    .filter(a => a.status === "completed" && a.query !== currentQuery)
    .map(a => ({ analysis: a, score: similarity(currentQuery, a.query) }))
    .filter(({ score }) => score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (!similar.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="mt-6 rounded-[26px] border border-white/8 bg-white/[0.03] p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <Brain size={15} className="text-cyan-400" />
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">Similar Past Analyses</div>
      </div>
      <div className="space-y-2">
        {similar.map(({ analysis, score }) => {
          const conf = normalizedPercent(analysis.overall_confidence);
          return (
            <Link
              key={analysis.id}
              href={`/analysis/${analysis.id}`}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition hover:border-white/12 hover:bg-white/[0.04]"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-slate-200">{analysis.query}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                  {analysis.decision_recommendation && (
                    <span style={{ color: decisionColor(analysis.decision_recommendation) }}>
                      {analysis.decision_recommendation}
                    </span>
                  )}
                  {conf > 0 && (
                    <span style={{ color: confidenceColor(analysis.overall_confidence) }}>{conf}%</span>
                  )}
                  <span>{new Date(analysis.created_at).toLocaleDateString()}</span>
                  <span className="text-slate-600">{Math.round(score * 100)}% similar</span>
                </div>
              </div>
              <ChevronRight size={14} className="shrink-0 text-slate-500 transition group-hover:translate-x-1 group-hover:text-slate-300" />
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
