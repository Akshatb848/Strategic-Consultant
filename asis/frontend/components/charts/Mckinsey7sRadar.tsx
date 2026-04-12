"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export function Mckinsey7sRadar({ structuredData }: { structuredData: Record<string, any> }) {
  const data = [
    { dimension: "Strategy", score: structuredData.strategy?.score || 0 },
    { dimension: "Structure", score: structuredData.structure?.score || 0 },
    { dimension: "Systems", score: structuredData.systems?.score || 0 },
    { dimension: "Staff", score: structuredData.staff?.score || 0 },
    { dimension: "Style", score: structuredData.style?.score || 0 },
    { dimension: "Skills", score: structuredData.skills?.score || 0 },
    { dimension: "Shared Values", score: structuredData.shared_values?.score || 0 },
  ];

  return (
    <div className="h-[340px] rounded-2xl border border-white/10 bg-black/20 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid stroke="rgba(148,163,184,0.22)" />
          <PolarAngleAxis dataKey="dimension" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
          <Radar dataKey="score" stroke="#818cf8" fill="#818cf8" fillOpacity={0.32} />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
