"use client";

import type {
  AnalysisMeta,
  FrameworkOutput,
  ReportTheme,
  SoWhatCallout,
  StrategicBriefV4,
} from "@/lib/api";
import { frameworkDisplayName, normalizedPercent } from "@/lib/analysis";

export interface ReportTocItem {
  id: string;
  number: string;
  title: string;
}

export interface NormalizedReportSection extends ReportTocItem {
  frameworkKey?: string;
  narrative?: string;
  source?: string;
  callout?: SoWhatCallout;
  renderMode?: "framework" | "market" | "risk" | "options" | "roadmap" | "appendix";
}

export const REPORT_THEME_OPTIONS: Array<{ value: ReportTheme; label: string }> = [
  { value: "mckinsey", label: "McKinsey" },
  { value: "bain", label: "Bain" },
  { value: "bcg", label: "BCG" },
  { value: "neutral", label: "Neutral" },
];

function sentence(text: string, fallback: string): string {
  const value = text.trim();
  if (!value) return fallback;
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function genericTitle(title: string): boolean {
  const value = title.trim().toLowerCase();
  return [
    "market analysis",
    "revenue chart",
    "segment overview",
    "competition",
    "growth",
    "vrio analysis",
  ].includes(value);
}

export function ensureFindingTitle(title: string, fallback: string): string {
  const clean = title.trim();
  if (!clean || clean.split(/\s+/).length < 4 || genericTitle(clean)) {
    return sentence(fallback, fallback);
  }
  return sentence(clean, fallback);
}

export function reportCompanyName(brief: StrategicBriefV4): string {
  return (
    String(brief.report_metadata?.company_name || "").trim() ||
    String(brief.context?.company_name || brief.context?.organisation || "").trim() ||
    "Client organisation"
  );
}

export function reportSubtitle(brief: StrategicBriefV4): string {
  const geography = String(brief.context?.geography || "").trim();
  const industry = String(brief.context?.sector || brief.context?.industry || "").trim();
  const parts = [industry, geography].filter(Boolean);
  if (parts.length === 0) {
    return "Strategic decision support report";
  }
  return parts.join(" | ");
}

export function reportAnalysisMeta(brief: StrategicBriefV4): AnalysisMeta {
  return brief.analysis_meta || {
    fatal_invalidation_count: 0,
    major_invalidation_count: 0,
    recommendation_downgraded: false,
    has_blocking_warnings: false,
  };
}

export function reportTopFindings(brief: StrategicBriefV4): string[] {
  const summary = brief.executive_summary;
  const findings = [
    summary.key_argument_1,
    summary.key_argument_2,
    summary.key_argument_3,
    ...Object.values(brief.so_what_callouts || {})
      .map((callout) => callout?.implication)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  ];
  return Array.from(new Set(findings.filter(Boolean))).slice(0, 5);
}

export function reportPriorityActions(brief: StrategicBriefV4): string[] {
  const fromRoadmap = (brief.implementation_roadmap || [])
    .flatMap((phase) => phase.actions || [])
    .filter(Boolean);
  const fromSoWhat = Object.values(brief.so_what_callouts || {})
    .map((callout) => callout?.recommended_action)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return Array.from(new Set([...fromRoadmap, ...fromSoWhat])).slice(0, 5);
}

export function reportFrameworkEntries(brief: StrategicBriefV4): Array<[string, FrameworkOutput]> {
  return Object.entries(brief.framework_outputs || {}).sort(
    (left, right) => (left[1]?.exhibit_number || 0) - (right[1]?.exhibit_number || 0)
  );
}

export function reportFrameworkSource(output?: FrameworkOutput | null): string {
  if (!output) return "Source: ASIS multi-agent synthesis.";
  const primary = output.citations?.[0];
  if (primary?.title || primary?.source || primary?.publisher) {
    return `Source: ${primary.publisher || primary.source || primary.title}${primary.year ? `, ${primary.year}` : ""}.`;
  }
  return `Source: ASIS ${frameworkDisplayName(output.framework_name || output.agent_author || "analysis")} synthesis.`;
}

export function reportIsMnaMode(brief: StrategicBriefV4): boolean {
  const meta = reportAnalysisMeta(brief);
  const decisionType = String(brief.context?.decision_type || "").toLowerCase();
  return Boolean(meta.three_options?.length || meta.build_vs_buy_verdict || decisionType.includes("acqui"));
}

export function reportSections(brief: StrategicBriefV4): NormalizedReportSection[] {
  const sections: NormalizedReportSection[] = [
    { id: "executive-summary", number: "1", title: "Executive summary", renderMode: "appendix" },
    { id: "decision", number: "2", title: "Decision statement", renderMode: "appendix" },
    { id: "market-landscape", number: "3", title: "Market landscape and sizing", renderMode: "market" },
  ];

  for (const [key, output] of reportFrameworkEntries(brief)) {
    if (key === "market_sizing") continue;
    sections.push({
      id: `framework-${key}`,
      number: String(sections.length + 1),
      title: frameworkDisplayName(key),
      frameworkKey: key,
      narrative: output.narrative,
      source: reportFrameworkSource(output),
      callout: brief.so_what_callouts?.[key],
      renderMode: "framework",
    });
  }

  sections.push(
    {
      id: "strategic-options",
      number: String(sections.length + 1),
      title: "Strategic options",
      renderMode: "options",
    },
    {
      id: "roadmap",
      number: String(sections.length + 1),
      title: "Implementation roadmap",
      renderMode: "roadmap",
    }
  );

  if (reportIsMnaMode(brief)) {
    sections.push({
      id: "mna",
      number: String(sections.length + 1),
      title: "M&A and build-versus-buy",
      renderMode: "options",
    });
  }

  sections.push({
    id: "appendix",
    number: String(sections.length + 1),
    title: "Appendix: methodology and sources",
    renderMode: "appendix",
  });

  return sections;
}

export function reportConfidenceLabel(score: number): string {
  const normalized = normalizedPercent(score);
  if (normalized >= 82) return "High confidence";
  if (normalized >= 70) return "Moderate confidence";
  if (normalized >= 60) return "Low confidence";
  return "Exploratory";
}
