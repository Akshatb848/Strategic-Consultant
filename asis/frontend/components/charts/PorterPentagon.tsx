"use client";

const FORCE_KEYS = [
  ["competitive_rivalry", "Rivalry"],
  ["threat_of_new_entrants", "Entrants"],
  ["threat_of_substitutes", "Substitutes"],
  ["bargaining_power_buyers", "Buyers"],
  ["bargaining_power_suppliers", "Suppliers"],
] as const;

function vertexColor(score: number) {
  if (score >= 7) return "#ef4444";
  if (score >= 4) return "#f59e0b";
  return "#22c55e";
}

export function PorterPentagon({ structuredData }: { structuredData: Record<string, any> }) {
  const centerX = 210;
  const centerY = 210;
  const radius = 150;
  const polygonPoints = FORCE_KEYS.map(([, label], index) => {
    const angle = (-90 + index * 72) * (Math.PI / 180);
    const score = Number(structuredData[FORCE_KEYS[index][0]]?.score || 0);
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    const innerRadius = (score / 10) * radius;
    const innerX = centerX + innerRadius * Math.cos(angle);
    const innerY = centerY + innerRadius * Math.sin(angle);
    return { label, score, x, y, innerX, innerY };
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <svg viewBox="0 0 420 420" className="w-full">
        <polygon
          points={polygonPoints.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke="rgba(148,163,184,0.28)"
          strokeWidth="2"
        />
        <polygon
          points={polygonPoints.map((point) => `${point.innerX},${point.innerY}`).join(" ")}
          fill="rgba(56,189,248,0.18)"
          stroke="#38bdf8"
          strokeWidth="3"
        />
        {polygonPoints.map((point) => (
          <g key={point.label}>
            <line x1={centerX} y1={centerY} x2={point.x} y2={point.y} stroke="rgba(148,163,184,0.18)" />
            <circle cx={point.innerX} cy={point.innerY} r="7" fill={vertexColor(point.score)} />
            <text x={point.x} y={point.y - 12} textAnchor="middle" fill="#cbd5e1" fontSize="13">
              {point.label}
            </text>
            <text x={point.x} y={point.y + 6} textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="700">
              {point.score}/10
            </text>
          </g>
        ))}
        <text x={centerX} y={centerY - 6} textAnchor="middle" fill="#cbd5e1" fontSize="12">
          Attractiveness
        </text>
        <text x={centerX} y={centerY + 16} textAnchor="middle" fill="#f8fafc" fontSize="24" fontWeight="700">
          {Number(structuredData.overall_attractiveness || 0)}
        </text>
      </svg>
    </div>
  );
}
