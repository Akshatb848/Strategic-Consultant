"use client";

import { getAccessToken } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface AnalysisEvent {
  event:
    | "agent_start"
    | "agent_complete"
    | "analysis_complete"
    | "agent_collaboration"
    | "framework_complete"
    | "decision_reached";
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
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const chunk of parts) {
          const lines = chunk.split("\n");
          let eventName: AnalysisEvent["event"] | null = null;
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventName = line.replace("event:", "").trim() as AnalysisEvent["event"];
            if (line.startsWith("data:")) data += line.replace("data:", "").trim();
          }
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
