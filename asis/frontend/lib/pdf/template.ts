import type { FrameworkOutput, ReportTheme, SoWhatCallout, StrategicBriefV4 } from "@/lib/api";
import {
  renderAnsoffHtml,
  renderBcgSvg,
  renderBlueOceanSvg,
  renderMckinseySvg,
  renderPestleRadarSvg,
  renderPorterSvg,
  renderRiskHeatmapHtml,
  renderSwotHtml,
} from "@/lib/pdf/charts";

type JsonRecord = Record<string, unknown>;

interface PdfThemeColors {
  primary: string;
  accent: string;
  tint: string;
  text: string;
  muted: string;
  divider: string;
  tableAlt: string;
  tableHeader: string;
}

const PDF_THEME_COLORS: Record<ReportTheme, PdfThemeColors> = {
  mckinsey: {
    primary: "#051C2C",
    accent: "#00A9CE",
    tint: "#E8EDF1",
    text: "#1A1A1A",
    muted: "#666666",
    divider: "#E0E0E0",
    tableAlt: "#F7F7F7",
    tableHeader: "#051C2C",
  },
  bain: {
    primary: "#1A1A1A",
    accent: "#CC0000",
    tint: "#FFF0F0",
    text: "#1A1A1A",
    muted: "#666666",
    divider: "#E7D7D7",
    tableAlt: "#FFF7F7",
    tableHeader: "#1A1A1A",
  },
  bcg: {
    primary: "#2D2D2D",
    accent: "#009B77",
    tint: "#EBF5F2",
    text: "#1A1A1A",
    muted: "#666666",
    divider: "#D7E6E1",
    tableAlt: "#F5FAF8",
    tableHeader: "#2D2D2D",
  },
  neutral: {
    primary: "#1C2B3A",
    accent: "#4A90D9",
    tint: "#EBF2FA",
    text: "#1A1A1A",
    muted: "#666666",
    divider: "#E0E6ED",
    tableAlt: "#F7FAFC",
    tableHeader: "#1C2B3A",
  },
};

const FRAMEWORK_ORDER = [
  "pestle",
  "porters_five_forces",
  "swot",
  "ansoff",
  "bcg_matrix",
  "mckinsey_7s",
  "blue_ocean",
  "balanced_scorecard",
];

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function firstPresent(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function text(value: unknown, fallback = "-"): string {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function sentence(value: unknown, fallback: string): string {
  const clean = text(value, fallback).trim();
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function frameworkDisplayName(key: string): string {
  return (
    {
      pestle: "PESTLE",
      swot: "SWOT",
      porters_five_forces: "Porter's Five Forces",
      ansoff: "Ansoff Matrix",
      bcg_matrix: "BCG Matrix",
      mckinsey_7s: "McKinsey 7S",
      blue_ocean: "Blue Ocean Strategy Canvas",
      balanced_scorecard: "Balanced Scorecard",
    }[key] || key.replace(/_/g, " ")
  );
}

function genericExhibitTitle(title: string): boolean {
  return [
    "market analysis",
    "revenue chart",
    "segment overview",
    "competition",
    "growth",
    "vrio analysis",
    "market size",
    "risk register",
    "framework analysis",
  ].includes(title.trim().toLowerCase());
}

function findingTitle(candidate: unknown, fallback: string): string {
  const clean = text(candidate, "");
  if (!clean || clean.split(/\s+/).length < 4 || genericExhibitTitle(clean)) {
    return sentence(fallback, fallback);
  }
  return sentence(clean, fallback);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const multiplier = /\bbn\b|billion/i.test(value) ? 1000 : 1;
    const cleaned = value.replace(/[$,%]/g, "").replace(/,/g, "").replace(/\b(?:mn|m|bn|billion|million)\b/gi, "").trim();
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed * multiplier;
  }
  return null;
}

function formatUsdMn(value: unknown): string {
  const numeric = asNumber(value);
  if (numeric == null) return "-";
  if (Math.abs(numeric) >= 1000) return `$${(numeric / 1000).toFixed(1)}B`;
  return `$${numeric.toFixed(1)}M`;
}

function formatPercent(value: unknown, digits = 0): string {
  const numeric = asNumber(value);
  if (numeric == null) return "-";
  const display = numeric <= 1 ? numeric * 100 : numeric;
  return `${display.toFixed(digits)}%`;
}

function formatMonths(value: unknown): string {
  const numeric = asNumber(value);
  if (numeric == null) return "-";
  return `${Math.round(numeric)} months`;
}

function compactValue(value: unknown): string {
  if (value == null || value === "") return "-";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => compactValue(item)).join("; ");
  if (typeof value === "object") {
    const record = asRecord(value);
    const preferred = firstPresent(
      record.summary,
      record.finding,
      record.rationale,
      record.implication,
      record.recommendation,
      record.description
    );
    if (preferred) return compactValue(preferred);
    return Object.entries(record)
      .slice(0, 4)
      .map(([key, entry]) => `${key.replace(/_/g, " ")}: ${compactValue(entry)}`)
      .join("; ");
  }
  return String(value);
}

function normalizedConfidence(value: unknown): number {
  const numeric = asNumber(value) ?? 0;
  const score = numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function sourceFromCitation(citation: JsonRecord | undefined): string {
  if (!citation) return "";
  const publisher = text(firstPresent(citation.publisher, citation.source, citation.author), "");
  const title = text(firstPresent(citation.title, citation.name), "");
  const year = text(firstPresent(citation.year, citation.published_at, citation.date), "");
  return [publisher || title, year].filter(Boolean).join(", ");
}

function sourceForFramework(output?: FrameworkOutput | null): string {
  const primary = output?.citations?.[0];
  const source = sourceFromCitation(primary);
  if (source) return `Source: ${source}.`;
  if (output?.agent_author) return `Source: ASIS ${output.agent_author.replace(/_/g, " ")} analysis.`;
  return "Source: ASIS multi-agent synthesis.";
}

function globalSource(brief: StrategicBriefV4, fallback = "Source: ASIS multi-agent synthesis."): string {
  const source = sourceFromCitation(asRecordArray(brief.citations)[0]);
  return source ? `Source: ${source}; ASIS synthesis.` : fallback;
}

function inlineLogo(colors: PdfThemeColors, logoUrl?: string | null): string {
  if (logoUrl) {
    return `<img src="${escapeHtml(logoUrl)}" alt="Company logo" style="max-height:42px;max-width:180px;" />`;
  }
  return `
    <svg width="128" height="34" viewBox="0 0 128 34" xmlns="http://www.w3.org/2000/svg">
      <rect width="128" height="34" rx="0" fill="${colors.primary}" />
      <text x="64" y="22" text-anchor="middle" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700">ASIS</text>
    </svg>
  `;
}

function list(items: unknown[]): string {
  const filtered = items.map((item) => text(item, "")).filter(Boolean);
  if (filtered.length === 0) return `<p class="muted">No items returned for this section.</p>`;
  return `<ul class="tight-list">${filtered.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function reportTable(headers: string[], rows: unknown[][], numericColumns: number[] = []): string {
  if (rows.length === 0) {
    return `<div class="empty-state">No structured data was returned for this exhibit.</div>`;
  }
  return `
    <table class="data-table">
      <thead>
        <tr>${headers.map((header, index) => `<th class="${numericColumns.includes(index) ? "num" : ""}">${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell, index) => `<td class="${numericColumns.includes(index) ? "num" : ""}">${escapeHtml(compactValue(cell))}</td>`)
                .join("")}</tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function tableFromRecords(records: JsonRecord[], preferredKeys?: string[]): string {
  if (records.length === 0) return `<div class="empty-state">No structured rows were returned for this exhibit.</div>`;
  const keys = (preferredKeys?.filter((key) => records.some((record) => record[key] != null)) || []).concat(
    Array.from(new Set(records.flatMap((record) => Object.keys(record))))
  );
  const uniqueKeys = Array.from(new Set(keys)).filter((key) => !["id", "uuid", "created_at", "updated_at"].includes(key)).slice(0, 7);
  const numericColumns = uniqueKeys
    .map((key, index) => (records.some((record) => typeof record[key] === "number") ? index : -1))
    .filter((index) => index >= 0);
  return reportTable(
    uniqueKeys.map((key) => key.replace(/_/g, " ")),
    records.map((record) => uniqueKeys.map((key) => record[key])),
    numericColumns
  );
}

function tableFromRecord(record: JsonRecord): string {
  const rows = Object.entries(record)
    .filter(([, value]) => value != null && !(Array.isArray(value) && value.length === 0))
    .map(([key, value]) => [key.replace(/_/g, " "), compactValue(value)]);
  return reportTable(["Dimension", "Finding"], rows);
}

function sectionHeader(number: string, title: string): string {
  return `
    <div class="section-header">
      <div class="section-number">${escapeHtml(number)}</div>
      <h2>${escapeHtml(title)}</h2>
    </div>
  `;
}

function exhibit(number: number, title: string, source: string, body: string, footnote?: string): string {
  return `
    <div class="exhibit">
      <div class="exhibit-label">Exhibit ${number}</div>
      <h3>${escapeHtml(title)}</h3>
      <div class="exhibit-body">${body}</div>
      <div class="source-line">${escapeHtml(source)}</div>
      ${footnote ? `<div class="footnote">${escapeHtml(footnote)}</div>` : ""}
    </div>
  `;
}

function soWhatBox(callout?: SoWhatCallout | JsonRecord): string {
  if (!callout) return "";
  const data = asRecord(callout);
  const implication = text(data.implication, "");
  const action = text(data.recommended_action, "");
  const risk = text(data.risk_of_inaction, "");
  if (!implication && !action && !risk) return "";
  return `
    <div class="so-what-box">
      <div class="so-what-label">So what</div>
      ${implication ? `<p><strong>Implication:</strong> ${escapeHtml(implication)}</p>` : ""}
      ${action ? `<p><strong>Recommended action:</strong> ${escapeHtml(action)}</p>` : ""}
      ${risk ? `<p><strong>Risk of inaction:</strong> ${escapeHtml(risk)}</p>` : ""}
    </div>
  `;
}

function summaryParagraphs(brief: StrategicBriefV4): string[] {
  return [
    brief.executive_summary?.headline,
    brief.executive_summary?.key_argument_1,
    brief.executive_summary?.key_argument_2,
    brief.executive_summary?.key_argument_3,
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function topFindings(brief: StrategicBriefV4): string[] {
  const fromSummary = [
    brief.executive_summary?.key_argument_1,
    brief.executive_summary?.key_argument_2,
    brief.executive_summary?.key_argument_3,
  ];
  const fromSoWhat = Object.values(brief.so_what_callouts || {}).map((callout) => callout?.implication);
  return Array.from(
    new Set([...fromSummary, ...fromSoWhat].filter((value): value is string => typeof value === "string" && value.trim().length > 0))
  ).slice(0, 5);
}

function priorityActions(brief: StrategicBriefV4): string[] {
  const roadmapActions = (brief.implementation_roadmap || []).flatMap((phase) => phase.actions || []);
  const soWhatActions = Object.values(brief.so_what_callouts || {}).map((callout) => callout?.recommended_action);
  return Array.from(
    new Set([...roadmapActions, ...soWhatActions].filter((value): value is string => typeof value === "string" && value.trim().length > 0))
  ).slice(0, 5);
}

function orderedFrameworkEntries(brief: StrategicBriefV4): Array<[string, FrameworkOutput]> {
  const outputs = Object.entries(brief.framework_outputs || {});
  const known = FRAMEWORK_ORDER.flatMap((key) => {
    const output = brief.framework_outputs?.[key];
    return output ? ([[key, output]] as Array<[string, FrameworkOutput]>) : [];
  });
  const extra = outputs.filter(([key]) => !FRAMEWORK_ORDER.includes(key));
  return [...known, ...extra];
}

function marketSizingHtml(brief: StrategicBriefV4): string {
  const marketSizing = asRecord(firstPresent(brief.market_analysis?.market_sizing, brief.financial_analysis?.market_sizing));
  const rows = [
    ["TAM", firstPresent(marketSizing.tam, marketSizing.total_addressable_market)],
    ["SAM", firstPresent(marketSizing.sam, marketSizing.serviceable_available_market)],
    ["SOM", firstPresent(marketSizing.som, marketSizing.serviceable_obtainable_market)],
    ["Growth rate", firstPresent(marketSizing.growth_rate, marketSizing.cagr, marketSizing.market_growth_rate)],
    ["Evidence base", firstPresent(asRecord(marketSizing.source).title, marketSizing.source, "ASIS market intelligence")],
  ].filter(([, value]) => value != null && value !== "");
  return reportTable(["Metric", "Value"], rows);
}

function bottomUpRevenueHtml(brief: StrategicBriefV4): string {
  const bottomUp = asRecord(brief.financial_analysis?.bottom_up_revenue_model);
  const sectorBuild = asRecordArray(bottomUp.sector_build);
  if (sectorBuild.length === 0) return tableFromRecord(bottomUp);
  return reportTable(
    ["Segment", "Target clients", "ACV", "Win rate", "Expansion", "Scale", "Year 3 revenue", "Formula / basis"],
    sectorBuild.map((entry) => [
      firstPresent(entry.sector, entry.segment, entry.customer_segment),
      firstPresent(entry.target_clients, entry.client_count, entry.addressable_clients),
      formatUsdMn(firstPresent(entry.average_contract_value_usd_mn, entry.acv_usd_mn, entry.average_contract_value)),
      formatPercent(firstPresent(entry.win_rate, entry.conversion_rate)),
      `${text(firstPresent(entry.account_expansion_multiplier, entry.expansion_multiplier), "1.0")}x`,
      `${text(firstPresent(entry.scale_multiplier, entry.scaling_multiplier), "1.0")}x`,
      formatUsdMn(firstPresent(entry.year_3_revenue_usd_mn, entry.base_year_3_revenue_usd_mn, entry.revenue_year_3_usd_mn)),
      firstPresent(entry.formula_basis, entry.source_or_assumption, "Formula basis not supplied"),
    ]),
    [1, 2, 3, 4, 5, 6]
  );
}

function scenarioHtml(brief: StrategicBriefV4): string {
  const scenarioAnalysis = asRecord(brief.financial_analysis?.scenario_analysis);
  const scenarios = asRecordArray(scenarioAnalysis.scenarios);
  return reportTable(
    ["Scenario", "Year 3 revenue", "EBITDA margin", "ROI", "IRR", "Payback", "Investment basis", "Formula / assumption"],
    scenarios.map((scenario) => [
      firstPresent(scenario.name, scenario.scenario),
      formatUsdMn(firstPresent(scenario.revenue_year_3_usd_mn, scenario.year_3_revenue_usd_mn)),
      formatPercent(firstPresent(scenario.ebitda_margin_pct, scenario.ebitda_margin), 1),
      `${text(firstPresent(scenario.roi_multiple, scenario.roi), "-")}x`,
      formatPercent(firstPresent(scenario.irr_pct, scenario.irr), 1),
      formatMonths(scenario.payback_months),
      firstPresent(scenario.investment_basis, scenario.payback_basis, "Investment basis not supplied"),
      firstPresent(scenario.formula_basis, scenario.source_or_assumption, compactValue(scenario.assumptions)),
    ]),
    [1, 2, 3, 4, 5]
  );
}

function frameworkBody(key: string, output: FrameworkOutput, brief: StrategicBriefV4): string {
  const structured = asRecord(output.structured_data);
  switch (key) {
    case "pestle": {
      const dimensions = ["political", "economic", "social", "technological", "legal", "environmental"];
      const tableRows = dimensions.map((dimension) => {
        const dimensionRecord = asRecord(structured[dimension]);
        return [
          dimension.charAt(0).toUpperCase() + dimension.slice(1),
          firstPresent(dimensionRecord.score, dimensionRecord.rating),
          asStringArray(dimensionRecord.factors).join("; "),
          firstPresent(dimensionRecord.implication, dimensionRecord.so_what),
        ];
      });
      return `${renderPestleRadarSvg(brief)}${reportTable(["Dimension", "Score", "Evidence", "Implication"], tableRows, [1])}`;
    }
    case "porters_five_forces": {
      const rows = [
        ["Competitive rivalry", structured.competitive_rivalry],
        ["Threat of new entrants", structured.threat_of_new_entrants],
        ["Threat of substitutes", structured.threat_of_substitutes],
        ["Buyer power", structured.bargaining_power_buyers],
        ["Supplier power", structured.bargaining_power_suppliers],
      ].map(([label, value]) => {
        const record = asRecord(value);
        return [label, firstPresent(record.score, record.rating), firstPresent(record.rationale, record.finding, record.summary)];
      });
      return `${renderPorterSvg(brief)}${reportTable(["Force", "Score", "Finding"], rows, [1])}`;
    }
    case "swot":
      return renderSwotHtml(brief);
    case "ansoff":
      return renderAnsoffHtml(brief);
    case "bcg_matrix": {
      const units = asRecordArray(structured.business_units);
      return `${renderBcgSvg(brief)}${tableFromRecords(units, [
        "name",
        "quadrant",
        "relative_market_share",
        "market_growth_rate",
        "recommended_action",
      ])}`;
    }
    case "mckinsey_7s": {
      const rows = ["strategy", "structure", "systems", "staff", "style", "skills", "shared_values"].map((dimension) => {
        const dimensionRecord = asRecord(structured[dimension]);
        return [
          dimension.replace(/_/g, " "),
          firstPresent(dimensionRecord.score, dimensionRecord.rating),
          firstPresent(dimensionRecord.current_state, dimensionRecord.finding, dimensionRecord.rationale),
          firstPresent(dimensionRecord.desired_state, dimensionRecord.target_state),
          firstPresent(dimensionRecord.gap, dimensionRecord.implication),
        ];
      });
      return `${renderMckinseySvg(brief)}${reportTable(["Element", "Score", "Current state", "Desired state", "Gap"], rows, [1])}`;
    }
    case "blue_ocean": {
      const errcRows = ["eliminate", "reduce", "raise", "create"].map((dimension) => [
        dimension.charAt(0).toUpperCase() + dimension.slice(1),
        asStringArray(structured[dimension]).join("; "),
      ]);
      return `${renderBlueOceanSvg(brief)}${reportTable(["ERRC lever", "Strategic moves"], errcRows)}`;
    }
    case "balanced_scorecard": {
      const scorecard = brief.balanced_scorecard || structured;
      const rows = ["financial", "customer", "internal_process", "learning_and_growth"].map((perspective) => {
        const item = asRecord(asRecord(scorecard)[perspective]);
        return [
          perspective.replace(/_/g, " "),
          compactValue(item.objectives),
          compactValue(item.measures),
          compactValue(item.targets),
          compactValue(item.initiatives),
        ];
      });
      return reportTable(["Perspective", "Objectives", "Measures", "Targets", "Initiatives"], rows);
    }
    default: {
      const rows = asRecordArray(structured.items || structured.rows || structured.business_units || structured.scenarios);
      return rows.length > 0 ? tableFromRecords(rows) : tableFromRecord(structured);
    }
  }
}

function strategicOptionsHtml(brief: StrategicBriefV4): string {
  const meta = asRecord(brief.analysis_meta);
  const threeOptions = asRecordArray(meta.three_options);
  if (threeOptions.length > 0) {
    return tableFromRecords(threeOptions, [
      "option",
      "label",
      "total_cost",
      "timeline_to_value",
      "npv_3yr_risk_adjusted",
      "probability_of_achieving_roi_target",
      "recommended",
    ]);
  }
  const pathwayOptions = asRecordArray(asRecord(brief.market_analysis?.strategic_pathways).options);
  if (pathwayOptions.length > 0) {
    return tableFromRecords(pathwayOptions, ["name", "strategic_logic", "fit_score", "capital_intensity", "flexibility", "execution_risk", "recommended"]);
  }
  return `<div class="empty-state">Strategic options were not returned for this analysis.</div>`;
}

function roadmapHtml(brief: StrategicBriefV4): string {
  return reportTable(
    ["Phase", "Actions", "Owner", "Success metrics", "Investment"],
    (brief.implementation_roadmap || []).map((item) => [
      item.phase,
      (item.actions || []).join("; "),
      item.owner_function,
      (item.success_metrics || []).join("; "),
      item.estimated_investment_usd ? formatUsdMn((item.estimated_investment_usd || 0) / 1_000_000) : "-",
    ]),
    [4]
  );
}

function redTeamHtml(brief: StrategicBriefV4): string {
  const redTeam = asRecord(brief.red_team);
  const invalidated = asRecordArray(redTeam.invalidated_claims);
  if (invalidated.length === 0) {
    return `<div class="empty-state">No red-team invalidations were returned for this analysis.</div>`;
  }
  return tableFromRecords(invalidated, ["severity", "original_claim", "challenge", "invalidation_reason", "required_evidence", "evidence", "source_agent"]);
}

function redTeamCounts(brief: StrategicBriefV4): { fatal: number; major: number } {
  const redTeam = asRecord(brief.red_team);
  const invalidated = asRecordArray(redTeam.invalidated_claims);
  const counted = invalidated.reduce<{ fatal: number; major: number }>(
    (totals, item) => {
      const severity = text(item.severity, "").toUpperCase();
      if (severity === "FATAL") totals.fatal += 1;
      if (severity === "MAJOR") totals.major += 1;
      return totals;
    },
    { fatal: 0, major: 0 }
  );
  return {
    fatal: counted.fatal || Number(asNumber(redTeam.fatal_count) ?? asNumber(asRecord(brief.analysis_meta).fatal_invalidation_count) ?? 0),
    major: counted.major || Number(asNumber(redTeam.major_count) ?? asNumber(asRecord(brief.analysis_meta).major_invalidation_count) ?? 0),
  };
}

function citationsHtml(brief: StrategicBriefV4): string {
  const citations = asRecordArray(brief.citations);
  if (citations.length === 0) return `<div class="empty-state">No external citations were returned for this analysis.</div>`;
  const seen = new Set<string>();
  const deduped = citations.filter((citation) => {
    const key = [citation.title, citation.url, citation.source, citation.publisher].map((value) => text(value, "")).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return tableFromRecords(deduped, ["title", "publisher", "source", "year", "url"]);
}

function collaborationHtml(brief: StrategicBriefV4): string {
  return reportTable(
    ["From", "To", "Shared artifact", "Decision contribution"],
    (brief.agent_collaboration_trace || []).map((event) => [
      event.source_agent,
      event.target_agent,
      event.data_field?.replace(/_/g, " "),
      event.contribution_summary,
    ])
  );
}

function agentLogHtml(appendix: JsonRecord): string {
  const logs = asRecordArray(appendix.agent_execution_log);
  return tableFromRecords(logs, ["agent", "model_used", "tokens_in", "tokens_out", "latency_ms"]);
}

function exportValidationHtml(brief: StrategicBriefV4): string {
  const validation = asRecord(brief.export_validation);
  const evidence = asRecord(brief.evidence_contract);
  const checks = asRecordArray(validation.checks);
  const sourceRoles = asRecordArray(evidence.source_roles);
  const failedBlocks = checks.filter((check) => check.level === "BLOCK" && check.passed === false);
  const validationRows = checks.length > 0
    ? checks.map((check) => [
        check.id,
        check.level,
        check.passed === true ? "Passed" : "Failed",
        firstPresent(check.notes, check.description),
      ])
    : [["Export validation", "INFO", "Not attached", "This PDF was generated before export validation metadata was attached."]];
  const sourceRows = sourceRoles.map((source) => [
    firstPresent(source.source, source.title),
    compactValue(source.roles),
    source.url,
  ]);
  return `
    ${failedBlocks.length > 0 ? `<div class="priority-box"><h3>Export validation warning</h3><p>${failedBlocks.length} blocking issue(s) were recorded in the export validation metadata.</p></div>` : ""}
    ${reportTable(["Check", "Level", "Status", "Notes"], validationRows)}
    <h3>Source role coverage</h3>
    ${sourceRows.length > 0 ? reportTable(["Source", "Roles", "URL"], sourceRows) : `<div class="empty-state">Source role coverage was not attached to this report.</div>`}
  `;
}

export function buildPdfHtml({
  brief,
  appendix,
  logoUrl,
  theme = "mckinsey",
}: {
  brief: StrategicBriefV4;
  appendix: JsonRecord;
  logoUrl?: string | null;
  theme?: ReportTheme;
}): string {
  const colors = PDF_THEME_COLORS[theme] || PDF_THEME_COLORS.mckinsey;
  const context = asRecord(brief.context);
  const meta = asRecord(brief.analysis_meta);
  const companyName = text(firstPresent(brief.report_metadata?.company_name, context.company_name, context.organisation), "Client organisation");
  const generatedAt = text(brief.report_metadata?.generated_at, new Date().toISOString());
  const generatedDate = Number.isNaN(Date.parse(generatedAt))
    ? generatedAt
    : new Date(generatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const query = text(firstPresent(brief.report_metadata?.query, context.query), "Strategic question not provided");
  const subtitle = [context.sector || context.industry, context.geography].map((item) => text(item, "")).filter(Boolean).join(" | ");
  const confidence = normalizedConfidence(firstPresent(brief.decision_confidence, brief.overall_confidence));
  const qualityGrade = text(brief.quality_report?.overall_grade, "B");
  const recommendation = text(firstPresent(brief.recommendation, brief.decision_statement), "Recommendation pending");
  const frameworkEntries = orderedFrameworkEntries(brief);
  const redTeamSummary = redTeamCounts(brief);
  let exhibitNumber = 0;
  const nextExhibit = () => {
    exhibitNumber += 1;
    return exhibitNumber;
  };

  const sections = [
    "Executive summary",
    "Decision statement",
    "Market and financial model",
    "Framework analysis",
    "Strategic options",
    "Implementation roadmap",
    ...(meta.three_options || meta.build_vs_buy_verdict ? ["M&A and build-versus-buy"] : []),
    "Appendix: sources and methodology",
  ];

  const frameworkSections = frameworkEntries
    .map(([key, output], index) => {
      const displayName = frameworkDisplayName(key);
      const sectionTitle = text(brief.section_action_titles?.[key], displayName);
      const title = findingTitle(output.exhibit_title, `${displayName} clarifies the main implication for the strategic decision`);
      return `
        <section class="report-section framework-section">
          ${sectionHeader(`4.${index + 1}`, sectionTitle)}
          <p class="section-lead">${escapeHtml(sentence(output.narrative, `${displayName} evidence supports the final recommendation.`))}</p>
          ${exhibit(nextExhibit(), title, sourceForFramework(output), frameworkBody(key, output, brief))}
          ${soWhatBox(brief.so_what_callouts?.[key] || output)}
        </section>
      `;
    })
    .join("");

  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 24mm 18mm 20mm 22mm; }
        @page:first { margin: 18mm 18mm 18mm 22mm; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          background: #ffffff;
          color: ${colors.text};
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10pt;
          line-height: 1.48;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        h1, h2, h3, h4, p { margin-top: 0; }
        h1 {
          color: ${colors.primary};
          font-family: Georgia, "Times New Roman", serif;
          font-size: 31pt;
          font-weight: 500;
          letter-spacing: -0.02em;
          line-height: 1.05;
          margin: 24mm 0 8mm;
          max-width: 165mm;
        }
        h2 {
          color: ${colors.primary};
          font-size: 16pt;
          letter-spacing: 0.08em;
          line-height: 1.2;
          margin: 0;
          text-transform: uppercase;
        }
        h3 {
          color: ${colors.primary};
          font-size: 11.5pt;
          line-height: 1.25;
          margin: 0 0 8px;
        }
        h4 {
          color: ${colors.primary};
          font-size: 10pt;
          margin: 14px 0 6px;
        }
        p { margin-bottom: 9px; }
        .page-break { break-before: page; page-break-before: always; }
        .cover {
          min-height: 252mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .cover-kicker {
          color: ${colors.muted};
          font-size: 8.5pt;
          font-weight: 700;
          letter-spacing: 0.18em;
          margin-top: 12mm;
          text-transform: uppercase;
        }
        .cover-rule {
          background: ${colors.accent};
          height: 4px;
          margin-top: 10mm;
          width: 42mm;
        }
        .cover-meta {
          border-top: 1px solid ${colors.divider};
          color: ${colors.muted};
          display: grid;
          gap: 8px;
          grid-template-columns: 1fr 1fr;
          padding-top: 8mm;
        }
        .confidential {
          background: ${colors.tint};
          color: ${colors.primary};
          display: inline-block;
          font-size: 8pt;
          font-weight: 700;
          letter-spacing: 0.08em;
          margin-top: 7mm;
          padding: 6px 9px;
          text-transform: uppercase;
        }
        .toc {
          list-style: none;
          margin: 18px 0 0;
          padding: 0;
        }
        .toc li {
          border-bottom: 1px dotted ${colors.divider};
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
        }
        .toc span:first-child { color: ${colors.text}; }
        .toc span:last-child { color: ${colors.muted}; }
        .report-section { padding-top: 2mm; }
        .framework-section {
          break-before: auto;
          margin-top: 12px;
          page-break-before: auto;
        }
        .section-header {
          border-bottom: 1.5px solid ${colors.accent};
          display: grid;
          gap: 12px;
          grid-template-columns: 18mm 1fr;
          margin-bottom: 12px;
          padding-bottom: 7px;
        }
        .section-number {
          color: ${colors.accent};
          font-size: 8.5pt;
          font-weight: 700;
          letter-spacing: 0.16em;
          padding-top: 3px;
          text-transform: uppercase;
        }
        .section-lead {
          color: ${colors.text};
          font-family: Georgia, "Times New Roman", serif;
          font-size: 13pt;
          line-height: 1.35;
          margin: 0 0 14px;
        }
        .summary-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(3, 1fr);
          margin: 14px 0 18px;
        }
        .metric {
          border-top: 3px solid ${colors.accent};
          background: ${colors.tableAlt};
          padding: 12px;
        }
        .metric-label {
          color: ${colors.muted};
          font-size: 7.5pt;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .metric-value {
          color: ${colors.primary};
          font-family: Georgia, "Times New Roman", serif;
          font-size: 22pt;
          line-height: 1;
          margin-top: 6px;
        }
        .decision-box {
          border: 1px solid ${colors.divider};
          border-left: 5px solid ${colors.accent};
          background: #ffffff;
          margin: 12px 0 16px;
          padding: 13px 15px;
        }
        .decision-box strong {
          color: ${colors.primary};
          display: block;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 15pt;
          font-weight: 500;
          line-height: 1.25;
          margin-bottom: 7px;
        }
        .key-findings {
          display: grid;
          gap: 10px;
          margin-top: 12px;
        }
        .key-finding {
          border-left: 3px solid ${colors.accent};
          padding-left: 10px;
        }
        .priority-box {
          background: ${colors.tint};
          border: 1px solid ${colors.divider};
          margin-top: 14px;
          padding: 12px 14px;
        }
        .exhibit {
          border: 1px solid ${colors.divider};
          break-inside: avoid;
          margin: 14px 0;
          page-break-inside: avoid;
          padding: 12px 14px;
        }
        .exhibit-label {
          color: ${colors.accent};
          font-size: 7.5pt;
          font-weight: 700;
          letter-spacing: 0.14em;
          margin-bottom: 5px;
          text-transform: uppercase;
        }
        .exhibit-body {
          margin-top: 10px;
        }
        .exhibit svg {
          display: block;
          height: auto;
          margin: 0 auto 10px;
          max-width: 100%;
        }
        .source-line {
          border-top: 1px solid ${colors.divider};
          color: ${colors.muted};
          font-size: 7.2pt;
          margin-top: 9px;
          padding-top: 6px;
          text-transform: uppercase;
        }
        .footnote {
          color: ${colors.muted};
          font-size: 7.5pt;
          margin-top: 4px;
        }
        .data-table {
          border-collapse: collapse;
          margin: 8px 0 0;
          page-break-inside: auto;
          width: 100%;
        }
        .data-table thead { display: table-header-group; }
        .data-table tr { break-inside: avoid; page-break-inside: avoid; }
        .data-table th {
          background: ${colors.tableHeader};
          border: 1px solid ${colors.tableHeader};
          color: #ffffff;
          font-size: 7.8pt;
          letter-spacing: 0.05em;
          padding: 7px 8px;
          text-align: left;
          text-transform: uppercase;
        }
        .data-table td {
          border: 1px solid ${colors.divider};
          font-size: 8.2pt;
          padding: 7px 8px;
          text-align: left;
          vertical-align: top;
        }
        .data-table tbody tr:nth-child(even) td { background: ${colors.tableAlt}; }
        .data-table .num { text-align: right; font-variant-numeric: tabular-nums; }
        .tight-list {
          margin: 6px 0 0;
          padding-left: 16px;
        }
        .tight-list li { margin-bottom: 4px; }
        .so-what-box {
          background: ${colors.tint};
          border-left: 4px solid ${colors.accent};
          break-inside: avoid;
          margin: 13px 0 0;
          padding: 12px 14px;
        }
        .so-what-label {
          color: ${colors.primary};
          font-size: 8pt;
          font-weight: 700;
          letter-spacing: 0.15em;
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        .so-what-box p { margin: 4px 0; }
        .muted, .empty-state {
          color: ${colors.muted};
        }
        .empty-state {
          border: 1px dashed ${colors.divider};
          padding: 10px;
        }
        .appendix-note {
          color: ${colors.muted};
          font-size: 8.5pt;
          margin-top: 16px;
        }
      </style>
    </head>
    <body>
      <section class="cover">
        <div>
          ${inlineLogo(colors, logoUrl)}
          <div class="cover-kicker">Board-ready strategic intelligence report</div>
          <h1>${escapeHtml(companyName)} strategic decision report</h1>
          <p class="section-lead">${escapeHtml(query)}</p>
          <div class="cover-rule"></div>
          <div class="confidential">${escapeHtml(text(brief.report_metadata?.confidentiality_level, "Strictly confidential"))}</div>
        </div>
        <div class="cover-meta">
          <div><strong>Prepared for</strong><br />${escapeHtml(companyName)}</div>
          <div><strong>Date</strong><br />${escapeHtml(generatedDate)}</div>
          <div><strong>Scope</strong><br />${escapeHtml(subtitle || "Strategic decision support")}</div>
          <div><strong>System</strong><br />ASIS strategic intelligence platform</div>
        </div>
      </section>

      <section class="page-break">
        ${sectionHeader("0", "Table of contents")}
        <ol class="toc">
          ${sections.map((section, index) => `<li><span>${index + 1}. ${escapeHtml(section)}</span><span>${index + 1}</span></li>`).join("")}
        </ol>
      </section>

      <section class="report-section page-break">
        ${sectionHeader("1", "Executive summary")}
        <p class="section-lead">${escapeHtml(sentence(brief.executive_summary?.headline, "The analysis identifies a decision path that should be governed by evidence, execution risk, and capital discipline."))}</p>
        <div class="summary-grid">
          <div class="metric"><div class="metric-label">Decision confidence</div><div class="metric-value">${confidence}%</div></div>
          <div class="metric"><div class="metric-label">Quality grade</div><div class="metric-value">${escapeHtml(qualityGrade)}</div></div>
          <div class="metric"><div class="metric-label">Frameworks used</div><div class="metric-value">${frameworkEntries.length}</div></div>
        </div>
        <div class="key-findings">
          ${topFindings(brief).map((finding) => `<div class="key-finding">${escapeHtml(finding)}</div>`).join("")}
        </div>
        <div class="priority-box">
          <h3>Priority actions</h3>
          ${list(priorityActions(brief))}
        </div>
        ${
          meta.has_blocking_warnings
            ? `<div class="priority-box"><h3>Pre-flight caveat</h3><p>Blocking warnings were acknowledged before execution and should be revisited before final commitment.</p></div>`
            : ""
        }
        ${
          meta.build_vs_buy_verdict
            ? `<div class="priority-box"><h3>M&A verdict</h3><p>${escapeHtml(text(meta.build_vs_buy_verdict))}</p></div>`
            : ""
        }
      </section>

      <section class="report-section page-break">
        ${sectionHeader("2", "Decision statement")}
        <div class="decision-box">
          <strong>${escapeHtml(brief.decision_statement)}</strong>
          <p>${escapeHtml(sentence(brief.decision_rationale, "The recommendation is based on the current evidence base, financial logic, risk profile, and implementation feasibility."))}</p>
        </div>
        ${exhibit(
          nextExhibit(),
          findingTitle(brief.section_action_titles?.decision, "The recommended path is conditional on execution discipline and evidence quality"),
          globalSource(brief),
          reportTable(
            ["Decision element", "Current position"],
            [
              ["Recommendation", recommendation],
              ["Confidence", `${confidence}%`],
              ["Evidence base", (brief.decision_evidence || []).join("; ")],
              ["Quality grade", qualityGrade],
              ["Red-team challenges", `${redTeamSummary.fatal} fatal; ${redTeamSummary.major} major`],
            ]
          )
        )}
      </section>

      <section class="report-section page-break">
        ${sectionHeader("3", "Market and financial model")}
        <p class="section-lead">The commercial case is strongest when market sizing, bottom-up revenue build, and scenario economics point to the same strategic pathway.</p>
        ${exhibit(
          nextExhibit(),
          findingTitle(brief.section_action_titles?.market_analysis, "Market sizing frames the reachable opportunity before strategic options are selected"),
          globalSource(brief),
          marketSizingHtml(brief)
        )}
        ${exhibit(
          nextExhibit(),
          "Bottom-up revenue build tests whether the ambition is commercially plausible.",
          "Source: ASIS financial reasoning agent.",
          bottomUpRevenueHtml(brief)
        )}
        ${exhibit(
          nextExhibit(),
          "Scenario economics define the capital-at-risk envelope for the recommendation.",
          "Source: ASIS financial reasoning agent.",
          scenarioHtml(brief)
        )}
      </section>

      ${frameworkSections}

      <section class="report-section page-break">
        ${sectionHeader("5", "Strategic options")}
        <p class="section-lead">Options are compared on strategic logic, capital intensity, value timing, and execution risk rather than on headline ambition alone.</p>
        ${exhibit(
          nextExhibit(),
          "The preferred option must dominate alternatives after risk adjustment.",
          "Source: ASIS strategic options and synthesis agents.",
          strategicOptionsHtml(brief)
        )}
        ${soWhatBox(brief.so_what_callouts?.ansoff)}
      </section>

      <section class="report-section page-break">
        ${sectionHeader("6", "Implementation roadmap")}
        <p class="section-lead">The roadmap converts the recommendation into accountable workstreams, owners, metrics, and investment gates.</p>
        ${exhibit(
          nextExhibit(),
          "Execution should be phased through measurable gates before full commitment.",
          "Source: ASIS synthesis agent.",
          roadmapHtml(brief)
        )}
      </section>

      ${
        meta.three_options || meta.build_vs_buy_verdict
          ? `
            <section class="report-section page-break">
              ${sectionHeader("7", "M&A and build-versus-buy")}
              <p class="section-lead">${escapeHtml(sentence(meta.build_vs_buy_verdict, "Build-versus-buy logic should be evaluated before committing to any acquisition path."))}</p>
              ${exhibit(
                nextExhibit(),
                "Build, partner, and acquire options should be compared on risk-adjusted value rather than speed alone.",
                "Source: ASIS acquisition-mode synthesis.",
                strategicOptionsHtml(brief)
              )}
            </section>
          `
          : ""
      }

      <section class="report-section page-break">
        ${sectionHeader(meta.three_options || meta.build_vs_buy_verdict ? "8" : "7", "Appendix: sources and methodology")}
        <h3>Red-team challenges</h3>
        ${redTeamHtml(brief)}
        <h3>Sources and citations</h3>
        ${citationsHtml(brief)}
        <h3>Collaboration trace</h3>
        ${collaborationHtml(brief)}
        <h3>Agent execution log</h3>
        ${agentLogHtml(appendix)}
        <h3>Export validation and evidence contract</h3>
        ${exportValidationHtml(brief)}
        <p class="appendix-note">Methodology: ASIS uses an eight-stage specialist workflow covering orchestration, market intelligence, risk assessment, competitor analysis, geo-intelligence, financial reasoning, strategic options, and synthesis. Outputs are persisted as structured report data and require executive review before material decisions.</p>
        <p class="appendix-note">${escapeHtml(text(brief.report_metadata?.disclaimer, "This document is decision-support material and is not legal, tax, investment, or accounting advice."))}</p>
      </section>
    </body>
  </html>
  `;
}
