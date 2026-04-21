"use client";

import { getAccessToken } from "@/lib/api";
import { getClientApiBase } from "@/lib/runtime-urls";

const API_BASE = getClientApiBase();

export interface AnalysisEvent {
  event:
    | "orchestrator_complete"
    | "agent_start"
    | "agent_complete"
    | "analysis_complete"
    | "analysis_failed"
    | "agent_collaboration"
    | "framework_complete"
    | "decision_reached"
    | "quality_complete";
  data: Record<string, any>;
}

export function subscribeToAnalysisEvents(
  analysisId: string,
  handlers: {
    onEvent: (event: AnalysisEvent) => void;
    onError?: (error: Error) => void;
  }
): () => void {
  const controller = new AbortController();
  const token = getAccessToken();

  const run = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/analysis/${analysisId}/events`, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        const parts = buffer.split(/\n\n/);
        buffer = parts.pop() || "";

        for (const chunk of parts) {
          const lines = chunk.split("\n");
          let eventName: AnalysisEvent["event"] | null = null;
          const dataLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith("event:")) eventName = line.replace("event:", "").trim() as AnalysisEvent["event"];
            if (line.startsWith("data:")) dataLines.push(line.replace("data:", "").trim());
          }
          const data = dataLines.join("\n");
          if (!eventName || !data) continue;
          handlers.onEvent({ event: eventName, data: JSON.parse(data) });
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        handlers.onError?.(error instanceof Error ? error : new Error("Unknown SSE error"));
      }
    }
  };

  void run();

  return () => controller.abort();
}
