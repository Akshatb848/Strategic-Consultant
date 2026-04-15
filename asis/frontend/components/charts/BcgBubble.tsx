"use client";

import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

const CATEGORY_COLORS: Record<string, string> = {
  star: "#38bdf8",
  cash_cow: "#22c55e",
  question_mark: "#f59e0b",
  dog: "#ef4444",
};

function BcgInsufficientData() {
  return (
    <div className="flex h-[360px] flex-col items-center justify-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
      <svg className="h-10 w-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <p className="text-sm font-semibold text-amber-300">BCG Matrix — Insufficient Data</p>
      <p className="max-w-xs text-xs text-slate-400">
        BCG Matrix requires business unit revenue, market growth rate, and relative market share.
        Provide detailed financial context to unlock this exhibit.
      </p>
    </div>
  );
}

export function BcgBubble({ structuredData }: { structuredData: Record<string, any> }) {
  const units = structuredData.business_units || [];

  // Guard: need at least one unit with non-zero market share or growth data
  const hasData = units.length > 0 && units.some(
    (u: Record<string, any>) =>
      (u.relative_market_share !== undefined && u.relative_market_share !== null) ||
      (u.market_growth_rate !== undefined && u.market_growth_rate !== null)
  );

  if (!hasData) return <BcgInsufficientData />;

  const data = units.map((unit: Record<string, any>) => ({
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
          <XAxis type="number" dataKey="x" name="Relative Market Share" stroke="#cbd5e1" reversed
            label={{ value: "← High   Relative Market Share   Low →", position: "insideBottom", offset: -4, fill: "#94a3b8", fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name="Market Growth Rate (%)" stroke="#cbd5e1"
            label={{ value: "Growth Rate (%)", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }} />
          <ZAxis type="number" dataKey="z" range={[80, 900]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload;
              return (
                <div className="rounded-lg border border-white/10 bg-slate-800 p-3 text-xs">
                  <p className="font-semibold text-white">{p.name}</p>
                  <p className="text-slate-300">Growth: {p.y}% | Share: {p.x}x</p>
                  <p className="capitalize text-slate-400">{(p.category || "").replace("_", " ")}</p>
                </div>
              );
            }}
          />
          <Scatter data={data} fill="#38bdf8" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
