"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const SERIES_COLORS = ["#38bdf8", "#f59e0b", "#818cf8", "#34d399"];

function BlueOceanInsufficientData() {
  return (
    <div className="flex h-[360px] flex-col items-center justify-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
      <svg className="h-10 w-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <p className="text-sm font-semibold text-amber-300">Blue Ocean Canvas — Insufficient Data</p>
      <p className="max-w-xs text-xs text-slate-400">
        The strategy canvas requires industry key success factors and competitor value curves.
        Provide competitor names and market context to unlock this exhibit.
      </p>
    </div>
  );
}

export function BlueOceanCanvas({ structuredData }: { structuredData: Record<string, any> }) {
  const factors: string[] = structuredData.factors || [];
  const companyCurve = structuredData.company_curve || {};
  const competitorCurves = structuredData.competitor_curves || {};

  // Guard: need factors and at least one company value score
  const hasData =
    factors.length >= 2 &&
    factors.some((f) => (companyCurve[f] !== undefined && companyCurve[f] !== null));

  if (!hasData) return <BlueOceanInsufficientData />;

  const data = factors.map((factor) => {
    const row: Record<string, any> = { factor, "Our Company": companyCurve[factor] ?? 0 };
    Object.entries(competitorCurves).forEach(([name, values]) => {
      row[name] = (values as Record<string, number>)[factor] ?? 0;
    });
    return row;
  });

  const competitorNames = Object.keys(competitorCurves);

  return (
    <div className="space-y-4">
      <div className="h-[360px] rounded-2xl border border-white/10 bg-black/20 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 24, bottom: 32, left: 8 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.14)" />
            <XAxis
              dataKey="factor"
              stroke="#cbd5e1"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis stroke="#cbd5e1" domain={[0, 10]} tick={{ fill: "#94a3b8", fontSize: 11 }}
              label={{ value: "Value Score (0-10)", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
              labelStyle={{ color: "#e2e8f0" }}
            />
            <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12, color: "#cbd5e1" }} />
            <Line type="monotone" dataKey="Our Company" stroke={SERIES_COLORS[0]} strokeWidth={3} dot={{ r: 4 }} />
            {competitorNames.map((name, index) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={SERIES_COLORS[(index + 1) % SERIES_COLORS.length]}
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ERRC Grid */}
      {(structuredData.eliminate?.length || structuredData.reduce?.length ||
        structuredData.raise?.length || structuredData.create?.length) ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["eliminate", "reduce", "raise", "create"] as const).map((action) => {
            const colors: Record<string, string> = {
              eliminate: "border-red-500/30 bg-red-500/5",
              reduce: "border-orange-500/30 bg-orange-500/5",
              raise: "border-blue-500/30 bg-blue-500/5",
              create: "border-green-500/30 bg-green-500/5",
            };
            const labels: Record<string, string> = {
              eliminate: "Eliminate",
              reduce: "Reduce",
              raise: "Raise",
              create: "Create",
            };
            const items: string[] = structuredData[action] || [];
            return (
              <div key={action} className={`rounded-xl border p-3 ${colors[action]}`}>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-300">{labels[action]}</p>
                <ul className="space-y-1">
                  {items.map((item, i) => (
                    <li key={i} className="text-xs text-slate-400">• {item}</li>
                  ))}
                  {items.length === 0 && <li className="text-xs italic text-slate-600">None identified</li>}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
