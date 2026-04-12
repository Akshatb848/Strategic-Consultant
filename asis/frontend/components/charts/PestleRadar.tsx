"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export function PestleRadar({ structuredData }: { structuredData: Record<string, any> }) {
  const data = [
    { dimension: "Political", score: structuredData.political?.score || 0 },
    { dimension: "Economic", score: structuredData.economic?.score || 0 },
    { dimension: "Social", score: structuredData.social?.score || 0 },
    { dimension: "Technological", score: structuredData.technological?.score || 0 },
    { dimension: "Legal", score: structuredData.legal?.score || 0 },
    { dimension: "Environmental", score: structuredData.environmental?.score || 0 },
  ];

  return (
    <div className="h-[340px] rounded-2xl border border-white/10 bg-black/20 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid stroke="rgba(148,163,184,0.22)" />
          <PolarAngleAxis dataKey="dimension" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
          <Radar dataKey="score" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.32} />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
