"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const SERIES_COLORS = ["#38bdf8", "#f59e0b", "#818cf8", "#34d399"];

export function BlueOceanCanvas({ structuredData }: { structuredData: Record<string, any> }) {
  const factors: string[] = structuredData.factors || [];
  const companyCurve = structuredData.company_curve || {};
  const competitorCurves = structuredData.competitor_curves || {};
  const data = factors.map((factor) => {
    const row: Record<string, any> = { factor, company: companyCurve[factor] || 0 };
    Object.entries(competitorCurves).forEach(([name, values]) => {
      row[name] = (values as Record<string, number>)[factor] || 0;
    });
    return row;
  });

  return (
    <div className="h-[360px] rounded-2xl border border-white/10 bg-black/20 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(148,163,184,0.14)" />
          <XAxis dataKey="factor" stroke="#cbd5e1" />
          <YAxis stroke="#cbd5e1" />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="company" stroke={SERIES_COLORS[0]} strokeWidth={3} />
          {Object.keys(competitorCurves).map((name, index) => (
            <Line key={name} type="monotone" dataKey={name} stroke={SERIES_COLORS[(index + 1) % SERIES_COLORS.length]} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
