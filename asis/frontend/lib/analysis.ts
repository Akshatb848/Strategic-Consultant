"use client";

import type { Analysis, AgentLog } from "@/lib/api";

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
  if (score >= 82) return "#10b981";
  if (score >= 65) return "#f59e0b";
  return "#ef4444";
}

export function decisionColor(decision?: string | null): string {
  return (
    {
      PROCEED: "#10b981",
      HOLD: "#f59e0b",
      ESCALATE: "#f97316",
      REJECT: "#ef4444",
      CONDITIONAL_PASS: "#f59e0b",
      PASS: "#10b981",
    }[decision || ""] || "#94a3b8"
  );
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
