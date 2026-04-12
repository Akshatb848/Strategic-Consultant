"use client";

import type {
  Analysis,
  AgentCollaborationEvent,
  AgentLog,
  FrameworkOutput,
  QualityReport,
  StrategicBriefV4,
} from "@/lib/api";

export function latestAgentLog(logs: AgentLog[] | undefined, agentId: string): AgentLog | undefined {
  return [...(logs || [])]
    .filter((log) => log.agent_id === agentId)
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
    .at(-1);
}

export function latestAgentOutput(analysis: Analysis | null, agentId: string): Record<string, any> {
  return (latestAgentLog(analysis?.agent_logs, agentId)?.parsed_output || {}) as Record<string, any>;
}

export function activeContext(analysis: Analysis | null): Record<string, any> {
  if (!analysis) return {};
  const extracted = analysis.extracted_context || {};
  if (Object.keys(extracted).length > 0) return extracted;
  return analysis.company_context || {};
}

export function contextSummary(analysis: Analysis | null): string {
  const context = activeContext(analysis);
  const company = context.company_name || "Unnamed organisation";
  const sector = context.sector || "sector not specified";
  const geography = context.geography || "geography not specified";
  return `${company} - ${sector} - ${geography}`;
}

export function confidenceColor(score?: number | null): string {
  if (score == null) return "#94a3b8";
  const normalized = score <= 1 ? score * 100 : score;
  if (normalized >= 82) return "#10b981";
  if (normalized >= 65) return "#f59e0b";
  return "#ef4444";
}

export function decisionColor(decision?: string | null): string {
  return (
    {
      PROCEED: "#15803d",
      "CONDITIONAL PROCEED": "#b45309",
      "DO NOT PROCEED": "#b91c1c",
      HOLD: "#b45309",
      ESCALATE: "#f97316",
      REJECT: "#ef4444",
      CONDITIONAL_PASS: "#f59e0b",
      PASS: "#10b981",
    }[decision || ""] || "#94a3b8"
  );
}

export function decisionLabel(decisionStatement?: string | null): string {
  if (!decisionStatement) return "";
  const normalized = decisionStatement.trim();
  for (const label of ["DO NOT PROCEED", "CONDITIONAL PROCEED", "PROCEED"]) {
    if (normalized.startsWith(label)) return label;
  }
  const match = normalized.match(/^(.*?)(?:\s[-–—]\s|$)/);
  return match?.[1] || normalized;
}

export function isStrategicBriefV4(brief: unknown): brief is StrategicBriefV4 {
  if (!brief || typeof brief !== "object") return false;
  return "framework_outputs" in brief && "decision_statement" in brief && "agent_collaboration_trace" in brief;
}

export function frameworkDisplayName(key: string): string {
  return (
    {
      pestle: "PESTLE",
      swot: "SWOT",
      porters_five_forces: "Porter's Five Forces",
      ansoff: "Ansoff Matrix",
      bcg_matrix: "BCG Matrix",
      mckinsey_7s: "McKinsey 7S",
      blue_ocean: "Blue Ocean Canvas",
      balanced_scorecard: "Balanced Scorecard",
    }[key] || key
  );
}

export function frameworkKeyFinding(output?: FrameworkOutput | null): string {
  if (!output) return "Framework evidence supported the final recommendation.";
  const structured = output.structured_data || {};
  for (const key of ["key_implication", "strategic_implication", "recommendation_rationale", "blue_ocean_shift", "portfolio_recommendation", "swot_implication"]) {
    if (structured[key]) return String(structured[key]);
  }
  return output.implication || output.narrative;
}

export function latestAgentStatus(logs: AgentLog[] | undefined, agentId: string): "pending" | "running" | "completed" | "failed" {
  const latest = latestAgentLog(logs, agentId);
  if (!latest) return "pending";
  if (latest.status === "failed") return "failed";
  if (latest.status === "completed" || latest.status === "self_corrected") return "completed";
  return "running";
}

export function uniqueSupportingFrameworks(events: AgentCollaborationEvent[], frameworkOutputs: Record<string, FrameworkOutput>): string[] {
  const explicit = Object.entries(frameworkOutputs || {})
    .sort((left, right) => (right[1].confidence_score || 0) - (left[1].confidence_score || 0))
    .map(([key]) => key);
  if (explicit.length > 0) return explicit.slice(0, 3);
  return Array.from(new Set(events.map((event) => event.data_field).filter(Boolean))).slice(0, 3);
}

export function summaryParagraphs(brief: StrategicBriefV4): string[] {
  return [
    brief.executive_summary.headline,
    brief.executive_summary.key_argument_1,
    brief.executive_summary.key_argument_2,
    brief.executive_summary.key_argument_3,
  ].filter(Boolean);
}

export function qualityGradeColor(quality?: QualityReport | null): string {
  const grade = quality?.overall_grade || "C";
  return (
    {
      A: "#15803d",
      B: "#2563eb",
      C: "#b45309",
      FAIL: "#b91c1c",
    }[grade] || "#64748b"
  );
}

export function normalizedPercent(value?: number | null): number {
  if (value == null) return 0;
  const numeric = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function toCsv(records: Array<Record<string, unknown>>): string {
  if (records.length === 0) return "";
  const headers = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
  const escapeValue = (value: unknown) => {
    const normalized =
      value == null
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    return `"${normalized.replace(/"/g, '""')}"`;
  };
  const rows = records.map((record) => headers.map((header) => escapeValue(record[header])).join(","));
  return [headers.join(","), ...rows].join("\n");
}
