"use client";

import { useEffect, useMemo, useState } from "react";
import dagre from "dagre";
import html2canvas from "html2canvas";
import { Download, Play, RotateCcw, ToggleLeft, ToggleRight } from "lucide-react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";

import type { AgentCollaborationEvent, AgentLog, FrameworkOutput } from "@/lib/api";
import { AgentDetailPanel } from "@/components/AgentDetailPanel";
import { latestAgentLog, latestAgentStatus } from "@/lib/analysis";

interface AgentCollaborationGraphProps {
  collaborationEvents: AgentCollaborationEvent[];
  agentLogs: AgentLog[];
  frameworkOutputs: Record<string, FrameworkOutput>;
}

const AGENT_META: Record<string, { label: string; color: string; column: number }> = {
  orchestrator: { label: "Orchestrator", color: "#334155", column: 0 },
  market_intel: { label: "Market Intel", color: "#2563eb", column: 1 },
  risk_assessment: { label: "Risk Assessment", color: "#f59e0b", column: 1 },
  competitor_analysis: { label: "Competitor Analysis", color: "#8b5cf6", column: 1 },
  geo_intel: { label: "Geo Intel", color: "#14b8a6", column: 1 },
  financial_reasoning: { label: "Financial Reasoning", color: "#16a34a", column: 2 },
  strategic_options: { label: "Strategic Options", color: "#4f46e5", column: 3 },
  synthesis: { label: "Synthesis", color: "#d4a017", column: 4 },
};

function layoutGraph(nodes: Node[], edges: Edge[]) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "LR", nodesep: 70, ranksep: 120 });
  nodes.forEach((node) => graph.setNode(node.id, { width: 220, height: 84 }));
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target));
  dagre.layout(graph);
  return nodes.map((node) => {
    const position = graph.node(node.id);
    return {
      ...node,
      position: { x: position.x - 110, y: position.y - 42 },
    };
  });
}

export function AgentCollaborationGraph({
  collaborationEvents,
  agentLogs,
  frameworkOutputs,
}: AgentCollaborationGraphProps) {
  const [showLabels, setShowLabels] = useState(true);
  const [activeEdgeIds, setActiveEdgeIds] = useState<string[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const activeEdgeLookup = useMemo(() => new Set(activeEdgeIds), [activeEdgeIds]);

  const logsByAgent = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(AGENT_META).map((agentId) => [agentId, latestAgentLog(agentLogs, agentId)])
      ),
    [agentLogs]
  );

  const nodes = useMemo<Node[]>(
    () =>
      layoutGraph(
        Object.entries(AGENT_META).map(([agentId, meta]) => {
          const log = logsByAgent[agentId];
          const status = latestAgentStatus(agentLogs, agentId);
          return {
            id: agentId,
            position: { x: 0, y: 0 },
            data: {
              label: (
                <div className="rounded-2xl border border-white/10 bg-[#0b1424] px-4 py-3 text-left shadow-lg">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-100">{meta.label}</div>
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-50"
                      style={{ backgroundColor: meta.color }}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {log?.duration_ms != null ? `${log.duration_ms} ms` : "Awaiting execution"}
                  </div>
                </div>
              ),
            },
            style: {
              width: 220,
              background: "transparent",
              border: "none",
            },
          };
        }),
        collaborationEvents.map((event, index) => ({
          id: `layout-${index}`,
          source: event.source_agent,
          target: event.target_agent,
        }))
      ),
    [agentLogs, collaborationEvents, logsByAgent]
  );

  const edges = useMemo<Edge[]>(
    () =>
      collaborationEvents.map((event, index) => {
        const sourceColor = AGENT_META[event.source_agent]?.color || "#94a3b8";
        const edgeId = `${event.source_agent}-${event.target_agent}-${index}`;
        const summary = event.contribution_summary || "";
        return {
          id: edgeId,
          source: event.source_agent,
          target: event.target_agent,
          label: showLabels
            ? `${summary.slice(0, 40)}${summary.length > 40 ? "..." : ""}`
            : undefined,
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: sourceColor },
          style: {
            stroke: sourceColor,
            strokeWidth: activeEdgeLookup.has(edgeId) ? 3.5 : 2,
            strokeDasharray: "8 6",
          },
          labelStyle: { fill: "#cbd5e1", fontSize: 11 },
        };
      }),
    [activeEdgeLookup, collaborationEvents, showLabels]
  );

  const validEdgeIds = useMemo(() => new Set(edges.map((edge) => edge.id)), [edges]);

  useEffect(() => {
    setActiveEdgeIds((current) => {
      const next = current.filter((edgeId) => validEdgeIds.has(edgeId));
      return next.length === current.length ? current : next;
    });
  }, [validEdgeIds]);

  const selectedAgentName = selectedAgentId ? AGENT_META[selectedAgentId]?.label || selectedAgentId : "";

  const onNodeClick: NodeMouseHandler = (_, node) => {
    setSelectedAgentId(node.id);
  };

  const replay = async () => {
    setActiveEdgeIds([]);
    for (const edge of edges) {
      setActiveEdgeIds((current) => (current.includes(edge.id) ? current : [...current, edge.id]));
      await new Promise((resolve) => window.setTimeout(resolve, 220));
    }
  };

  const reset = () => setActiveEdgeIds([]);

  const downloadPng = async () => {
    const element = document.getElementById("agent-collaboration-graph");
    if (!element) return;
    const canvas = await html2canvas(element, { backgroundColor: "#08101d", scale: 2 });
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = "asis-agent-collaboration-graph.png";
    link.click();
  };

  return (
    <>
      <div className="rounded-3xl border border-white/10 bg-[#08101d] p-5">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-50">Agent Collaboration Graph</h3>
            <p className="mt-1 text-sm text-slate-400">
              Eight-agent execution with real-time handoff replay and provenance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={replay}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              <Play size={14} />
              Replay
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              <RotateCcw size={14} />
              Reset
            </button>
            <button
              type="button"
              onClick={downloadPng}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              <Download size={14} />
              PNG
            </button>
            <button
              type="button"
              onClick={() => setShowLabels((current) => !current)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              {showLabels ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              Labels
            </button>
          </div>
        </div>
        <div
          id="agent-collaboration-graph"
          className="mt-4 h-[520px] rounded-2xl border border-white/10 bg-[#050c18]"
        >
          <ReactFlow nodes={nodes} edges={edges} fitView onNodeClick={onNodeClick}>
            <Background color="rgba(148,163,184,0.12)" gap={16} />
            <Controls />
            <MiniMap nodeColor={(node) => AGENT_META[node.id]?.color || "#94a3b8"} />
          </ReactFlow>
        </div>
      </div>

      <AgentDetailPanel
        open={!!selectedAgentId}
        onClose={() => setSelectedAgentId(null)}
        agentId={selectedAgentId}
        agentName={selectedAgentName}
        agentLog={selectedAgentId ? logsByAgent[selectedAgentId] : undefined}
        frameworkOutputs={frameworkOutputs}
        collaborationEvents={collaborationEvents}
      />
    </>
  );
}
