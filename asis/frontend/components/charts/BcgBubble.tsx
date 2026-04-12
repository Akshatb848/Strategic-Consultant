"use client";

import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

const CATEGORY_COLORS: Record<string, string> = {
  star: "#38bdf8",
  cash_cow: "#22c55e",
  question_mark: "#f59e0b",
  dog: "#ef4444",
};

export function BcgBubble({ structuredData }: { structuredData: Record<string, any> }) {
  const data = (structuredData.business_units || []).map((unit: Record<string, any>) => ({
    x: unit.relative_market_share || 0,
    y: unit.market_growth_rate || 0,
    z: Math.max(40, Number(unit.revenue_usd_mn || 25) * 3),
    name: unit.name,
    category: unit.category,
    fill: CATEGORY_COLORS[unit.category] || "#94a3b8",
  }));

  return (
    <div className="h-[360px] rounded-2xl border border-white/10 bg-black/20 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 8 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.14)" />
          <XAxis type="number" dataKey="x" name="Relative Market Share" stroke="#cbd5e1" reversed />
          <YAxis type="number" dataKey="y" name="Market Growth Rate" stroke="#cbd5e1" />
          <ZAxis type="number" dataKey="z" range={[80, 900]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={data} fill="#38bdf8" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
