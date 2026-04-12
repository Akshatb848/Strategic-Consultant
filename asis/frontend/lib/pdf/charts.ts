import type { StrategicBriefV4 } from "@/lib/api";

const NAVY = "#1a365d";
const BLUE = "#2b6cb0";
const TEXT = "#1a202c";

function svgWrapper(width: number, height: number, content: string): string {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
}

function polarPoints(values: number[], maxValue: number, centerX: number, centerY: number, radius: number) {
  return values
    .map((value, index) => {
      const angle = (-Math.PI / 2) + (index / values.length) * Math.PI * 2;
      const scaled = (value / maxValue) * radius;
      const x = centerX + Math.cos(angle) * scaled;
      const y = centerY + Math.sin(angle) * scaled;
      return `${x},${y}`;
    })
    .join(" ");
}

export function renderPestleRadarSvg(brief: StrategicBriefV4): string {
  const structured = brief.framework_outputs?.pestle?.structured_data || {};
  const labels = ["Political", "Economic", "Social", "Tech", "Legal", "Environmental"];
  const values = [
    structured.political?.score || 0,
    structured.economic?.score || 0,
    structured.social?.score || 0,
    structured.technological?.score || 0,
    structured.legal?.score || 0,
    structured.environmental?.score || 0,
  ];
  const polygon = polarPoints(values, 10, 240, 170, 120);
  const spokes = labels
    .map((label, index) => {
      const angle = (-Math.PI / 2) + (index / labels.length) * Math.PI * 2;
      const x = 240 + Math.cos(angle) * 120;
      const y = 170 + Math.sin(angle) * 120;
      const lx = 240 + Math.cos(angle) * 146;
      const ly = 170 + Math.sin(angle) * 146;
      return `
        <line x1="240" y1="170" x2="${x}" y2="${y}" stroke="#cbd5e0" stroke-width="1" />
        <text x="${lx}" y="${ly}" font-size="11" text-anchor="middle" fill="${TEXT}">${label}</text>
      `;
    })
    .join("");
  return svgWrapper(
    480,
    340,
    `
      <rect width="480" height="340" fill="white" rx="18" />
      <circle cx="240" cy="170" r="120" fill="none" stroke="#cbd5e0" stroke-width="1" />
      <circle cx="240" cy="170" r="80" fill="none" stroke="#e2e8f0" stroke-width="1" />
      <circle cx="240" cy="170" r="40" fill="none" stroke="#e2e8f0" stroke-width="1" />
      ${spokes}
      <polygon points="${polygon}" fill="${BLUE}" fill-opacity="0.35" stroke="${NAVY}" stroke-width="2" />
    `
  );
}

export function renderPorterSvg(brief: StrategicBriefV4): string {
  const structured = brief.framework_outputs?.porters_five_forces?.structured_data || {};
  const labels = [
    ["Rivalry", structured.competitive_rivalry?.score || 0],
    ["Entrants", structured.threat_of_new_entrants?.score || 0],
    ["Substitutes", structured.threat_of_substitutes?.score || 0],
    ["Buyers", structured.bargaining_power_buyers?.score || 0],
    ["Suppliers", structured.bargaining_power_suppliers?.score || 0],
  ] as const;
  const polygon = polarPoints(labels.map((item) => Number(item[1])), 10, 240, 170, 118);
  const points = labels
    .map(([label, score], index) => {
      const angle = (-Math.PI / 2) + (index / labels.length) * Math.PI * 2;
      const x = 240 + Math.cos(angle) * 135;
      const y = 170 + Math.sin(angle) * 135;
      return `<text x="${x}" y="${y}" font-size="11" text-anchor="middle" fill="${TEXT}">${label} (${score})</text>`;
    })
    .join("");
  return svgWrapper(
    480,
    340,
    `
      <rect width="480" height="340" fill="white" rx="18" />
      <polygon points="${polarPoints([10, 10, 10, 10, 10], 10, 240, 170, 118)}" fill="none" stroke="#cbd5e0" stroke-width="1" />
      <polygon points="${polygon}" fill="${NAVY}" fill-opacity="0.18" stroke="${BLUE}" stroke-width="2" />
      ${points}
    `
  );
}

export function renderBcgSvg(brief: StrategicBriefV4): string {
  const units = brief.framework_outputs?.bcg_matrix?.structured_data?.business_units || [];
  const bubbles = units
    .map((unit: Record<string, any>, index: number) => {
      const x = 60 + (Number(unit.relative_market_share || 0) / 5) * 420;
      const y = 320 - (Number(unit.market_growth_rate || 0) / 100) * 260;
      const r = 18 + (index % 3) * 8;
      return `
        <circle cx="${x}" cy="${y}" r="${r}" fill="${["#2b6cb0", "#1a365d", "#4299e1"][index % 3]}" fill-opacity="0.6" />
        <text x="${x}" y="${y + 4}" text-anchor="middle" font-size="10" fill="white">${unit.name}</text>
      `;
    })
    .join("");
  return svgWrapper(
    540,
    380,
    `
      <rect width="540" height="380" fill="white" rx="18" />
      <line x1="60" y1="40" x2="60" y2="320" stroke="#94a3b8" />
      <line x1="60" y1="320" x2="500" y2="320" stroke="#94a3b8" />
      <line x1="280" y1="40" x2="280" y2="320" stroke="#e2e8f0" stroke-dasharray="6 4" />
      <line x1="60" y1="180" x2="500" y2="180" stroke="#e2e8f0" stroke-dasharray="6 4" />
      <text x="85" y="60" font-size="12" fill="${TEXT}">Question Marks</text>
      <text x="330" y="60" font-size="12" fill="${TEXT}">Stars</text>
      <text x="85" y="302" font-size="12" fill="${TEXT}">Dogs</text>
      <text x="330" y="302" font-size="12" fill="${TEXT}">Cash Cows</text>
      ${bubbles}
    `
  );
}

export function renderMckinseySvg(brief: StrategicBriefV4): string {
  const structured = brief.framework_outputs?.mckinsey_7s?.structured_data || {};
  const values = [
    structured.strategy?.score || 0,
    structured.structure?.score || 0,
    structured.systems?.score || 0,
    structured.staff?.score || 0,
    structured.style?.score || 0,
    structured.skills?.score || 0,
    structured.shared_values?.score || 0,
  ];
  const labels = ["Strategy", "Structure", "Systems", "Staff", "Style", "Skills", "Shared Values"];
  const polygon = polarPoints(values, 10, 240, 170, 118);
  const captions = labels
    .map((label, index) => {
      const angle = (-Math.PI / 2) + (index / labels.length) * Math.PI * 2;
      const x = 240 + Math.cos(angle) * 142;
      const y = 170 + Math.sin(angle) * 142;
      return `<text x="${x}" y="${y}" text-anchor="middle" font-size="11" fill="${TEXT}">${label}</text>`;
    })
    .join("");
  return svgWrapper(
    480,
    340,
    `
      <rect width="480" height="340" fill="white" rx="18" />
      <circle cx="240" cy="170" r="120" fill="none" stroke="#cbd5e0" stroke-width="1" />
      <polygon points="${polygon}" fill="#4c51bf" fill-opacity="0.28" stroke="#4c51bf" stroke-width="2" />
      ${captions}
    `
  );
}

export function renderBlueOceanSvg(brief: StrategicBriefV4): string {
  const structured = brief.framework_outputs?.blue_ocean?.structured_data || {};
  const factors: string[] = structured.factors || [];
  const companyCurve = structured.company_curve || {};
  const lines = ([
    ["Company", companyCurve, "#2b6cb0"],
    ...Object.entries(structured.competitor_curves || {}).map(([name, curve], index) => [
      name,
      curve,
      ["#f59e0b", "#805ad5", "#38a169"][index % 3],
    ]),
  ] as Array<[string, Record<string, number>, string]>)
    .map(([name, curve, color], lineIndex) => {
      const points = factors
        .map((factor, index) => {
          const x = 70 + index * (factors.length > 1 ? 380 / (factors.length - 1) : 1);
          const y = 300 - ((curve[factor] || 0) / 10) * 220;
          return `${index === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");
      return `
        <path d="${points}" fill="none" stroke="${color}" stroke-width="${lineIndex === 0 ? 3 : 2}" />
        <text x="430" y="${34 + lineIndex * 18}" font-size="11" fill="${color}">${name}</text>
      `;
    })
    .join("");
  const labels = factors
    .map((factor, index) => {
      const x = 70 + index * (factors.length > 1 ? 380 / (factors.length - 1) : 1);
      return `<text x="${x}" y="330" text-anchor="middle" font-size="10" fill="${TEXT}">${factor}</text>`;
    })
    .join("");
  return svgWrapper(
    540,
    380,
    `
      <rect width="540" height="380" fill="white" rx="18" />
      <line x1="60" y1="40" x2="60" y2="300" stroke="#94a3b8" />
      <line x1="60" y1="300" x2="470" y2="300" stroke="#94a3b8" />
      ${labels}
      ${lines}
    `
  );
}

export function renderRiskHeatmapHtml(brief: StrategicBriefV4): string {
  const risks = brief.risk_analysis?.summary || [];
  const cells = Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 5 }, (_, col) => {
      const risk = risks.find((item: Record<string, any>) => item.likelihood === col + 1 && item.impact === 5 - row);
      const score = risk?.inherent_score || 0;
      const background = score >= 16 ? "#fc8181" : score >= 9 ? "#f6ad55" : "#68d391";
      return `<div style="border:1px solid #e2e8f0;background:${background};min-height:54px;padding:6px;font-size:10px;color:#1a202c;">${risk ? `${risk.risk_id}<br/>${risk.category}` : ""}</div>`;
    }).join("")
  ).join("");
  return `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0;">${cells}</div>`;
}

export function renderSwotHtml(brief: StrategicBriefV4): string {
  const structured = brief.framework_outputs?.swot?.structured_data || {};
  const quadrant = (items: Array<Record<string, any>>, title: string, background: string) => `
    <div style="border:1px solid #e2e8f0;background:${background};padding:12px;">
      <h4 style="margin:0 0 8px 0;font-size:12px;color:${TEXT};">${title}</h4>
      <ul style="margin:0;padding-left:16px;font-size:10px;color:${TEXT};line-height:1.5;">
        ${items.map((item) => `<li>${item.point}</li>`).join("")}
      </ul>
    </div>
  `;
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${quadrant(structured.strengths || [], "Strengths", "#c6f6d5")}
      ${quadrant(structured.weaknesses || [], "Weaknesses", "#fed7d7")}
      ${quadrant(structured.opportunities || [], "Opportunities", "#bee3f8")}
      ${quadrant(structured.threats || [], "Threats", "#fbd38d")}
    </div>
  `;
}

export function renderAnsoffHtml(brief: StrategicBriefV4): string {
  const structured = brief.framework_outputs?.ansoff?.structured_data || {};
  const cell = (key: string, title: string) => {
    const item = structured[key] || {};
    const recommended = structured.recommended_quadrant === key;
    return `
      <div style="border:2px solid ${recommended ? BLUE : "#e2e8f0"};padding:14px;border-radius:12px;background:${recommended ? "#ebf8ff" : "white"};">
        <div style="font-size:12px;font-weight:700;color:${TEXT};">${title}${recommended ? " - RECOMMENDED" : ""}</div>
        <div style="margin-top:6px;font-size:10px;color:${TEXT};">Feasibility: ${Math.round((item.feasibility || 0) * 100)}%</div>
        <div style="margin-top:6px;font-size:10px;color:${TEXT};line-height:1.5;">${item.rationale || ""}</div>
      </div>
    `;
  };
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      ${cell("market_penetration", "Market Penetration")}
      ${cell("market_development", "Market Development")}
      ${cell("product_development", "Product Development")}
      ${cell("diversification", "Diversification")}
    </div>
  `;
}
