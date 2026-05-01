import type { ReportTheme, SoWhatCallout, StrategicBriefV4 } from "@/lib/api";
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

const COLORS = {
  primary: "#1a365d",
  accent: "#2b6cb0",
  text: "#1a202c",
  muted: "#718096",
  divider: "#e2e8f0",
};

const PDF_THEME_COLORS: Record<ReportTheme, typeof COLORS> = {
  mckinsey: {
    primary: "#051C2C",
    accent: "#00A9CE",
    text: "#1A1A1A",
    muted: "#666666",
    divider: "#E0E0E0",
  },
  bain: {
    primary: "#1A1A1A",
    accent: "#CC0000",
    text: "#1A1A1A",
    muted: "#666666",
    divider: "#E7D7D7",
  },
  bcg: {
    primary: "#2D2D2D",
    accent: "#009B77",
    text: "#1A1A1A",
    muted: "#666666",
    divider: "#D7E6E1",
  },
  neutral: {
    primary: "#1C2B3A",
    accent: "#4A90D9",
    text: "#1A1A1A",
    muted: "#666666",
    divider: "#E0E6ED",
  },
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function inlineLogo(logoUrl?: string | null): string {
  if (logoUrl) {
    return `<img src="${logoUrl}" alt="Company logo" style="max-height:42px;max-width:180px;" />`;
  }
  return `
    <svg width="128" height="34" viewBox="0 0 128 34" xmlns="http://www.w3.org/2000/svg">
      <rect width="128" height="34" rx="10" fill="${COLORS.primary}" />
      <text x="64" y="22" text-anchor="middle" fill="white" font-family="Arial" font-size="16" font-weight="700">ASIS</text>
    </svg>
  `;
}

function list(items: string[]) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function citationList(citations: JsonRecord[]) {
  return `
    <ol class="citations">
      ${citations
        .map(
          (citation) =>
            `<li><a href="${String(citation.url || "#")}">${String(citation.title || "Source")}</a> - ${String(citation.source || "")}. ${String(citation.published_at || "")}</li>`
        )
        .join("")}
    </ol>
  `;
}

function table(rows: Array<[string, string]>) {
  return `
    <table class="meta-table">
      <tbody>
        ${rows.map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,%]/g, "").replace(/,/g, "").trim();
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatUsdMn(value: unknown): string {
  const numeric = asNumber(value);
  if (numeric == null) return "-";
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

function decisionTone(decisionStatement: string) {
  if (decisionStatement.startsWith("DO NOT PROCEED")) {
    return { bg: "#7f1d1d" };
  }
  if (decisionStatement.startsWith("CONDITIONAL PROCEED")) {
    return { bg: "#92400e" };
  }
  return { bg: COLORS.primary };
}

function calloutBox(title: string, body: string, tone: "amber" | "blue" | "slate" = "slate") {
  const palette = {
    amber: { border: "#f59e0b", bg: "#fff7ed" },
    blue: { border: COLORS.accent, bg: "#eff6ff" },
    slate: { border: "#94a3b8", bg: "#f8fafc" },
  }[tone];
  return `
    <div class="callout" style="border-color:${palette.border};background:${palette.bg};">
      <div class="callout-title">${title}</div>
      <div>${body}</div>
    </div>
  `;
}

function soWhatBox(callout?: SoWhatCallout | JsonRecord) {
  if (!callout) return "";
  const data = asRecord(callout);
  return `
    <div class="so-what-box">
      <div class="callout-title">So What</div>
      <p><strong>Implication:</strong> ${String(data.implication || "-")}</p>
      <p><strong>Recommended Action:</strong> ${String(data.recommended_action || "-")}</p>
      <p><strong>Risk of Inaction:</strong> ${String(data.risk_of_inaction || "-")}</p>
    </div>
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
  const themeColors = PDF_THEME_COLORS[theme];
  const context = asRecord(brief.context);
  const citations = brief.citations || [];
  const riskRegister = asRecordArray(brief.risk_analysis?.risk_register);
  const competitorProfiles = asRecordArray(brief.market_analysis?.competitor_profiles);
  const marketSizing = asRecord(brief.market_analysis?.market_sizing);
  const projections = asRecord(brief.financial_analysis?.financial_projections);
  const bottomUp = asRecord(brief.financial_analysis?.bottom_up_revenue_model);
  const sectorBuild = asRecordArray(bottomUp.sector_build);
  const scenarioAnalysis = asRecord(brief.financial_analysis?.scenario_analysis);
  const scenarios = asRecordArray(scenarioAnalysis.scenarios);
  const pathwayAnalysis = asRecord(brief.market_analysis?.strategic_pathways);
  const pathwayOptions = asRecordArray(pathwayAnalysis.options);
  const capabilityFit = asRecord(brief.market_analysis?.capability_fit_matrix);
  const capabilityRows = asRecordArray(capabilityFit.rows);
  const executionRealism = asRecord(brief.risk_analysis?.execution_realism);
  const executionItems = asRecordArray(executionRealism.items);
  const ansoff = asRecord(brief.framework_outputs?.ansoff?.structured_data);
  const optionRows = [
    ["market_penetration", "Market Penetration"],
    ["market_development", "Market Development"],
    ["product_development", "Product Development"],
    ["diversification", "Diversification"],
  ]
    .map(([key, label]) => {
      const option = asRecord(ansoff[key]);
      return {
        label,
        key,
        feasibility: Math.round((Number(option.feasibility || 0) || 0) * 100),
        rationale: String(option.rationale || ""),
        recommended: ansoff.recommended_quadrant === key,
      };
    })
    .filter((option) => option.feasibility > 0 || option.rationale);
  const geoRiskEntries = Object.entries(asRecord(brief.risk_analysis?.cage_distance_analysis)).map(
    ([key, value]) => [key, String(value)] as [string, string]
  );
  const decisionPalette = decisionTone(brief.decision_statement);
  const collaborationRows = (brief.agent_collaboration_trace || [])
    .map(
      (item) =>
        `<tr><td>${item.source_agent}</td><td>${item.target_agent}</td><td>${item.data_field}</td><td>${item.contribution_summary}</td></tr>`
    )
    .join("");
  const frameworkRows = Object.entries(brief.framework_outputs || {})
    .map(
      ([key, output]) =>
        `<tr><td>${key}</td><td>${output.agent_author}</td><td>${formatPercent(output.confidence_score)}</td><td>${output.narrative}</td></tr>`
    )
    .join("");

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 25mm 20mm 20mm 25mm; }
        body { font-family: Arial, sans-serif; color: ${themeColors.text}; font-size: 10pt; line-height: 1.5; margin: 0; background:#fff; }
        .page-break { page-break-before: always; }
        .cover { min-height: 250mm; display: flex; flex-direction: column; justify-content: space-between; }
        h1, h2, h3, h4 { color: ${themeColors.primary}; margin: 0; }
        h1 { font-size: 28pt; line-height: 1.1; }
        h2 { font-size: 18pt; margin-bottom: 10px; letter-spacing: 0.04em; text-transform: uppercase; }
        h3 { font-size: 14pt; margin: 18px 0 10px; }
        h4 { font-size: 11pt; margin: 12px 0 8px; }
        p { margin: 8px 0; }
        .subtitle { font-size: 14pt; color: ${themeColors.muted}; }
        .query-box { border-left: 4px solid ${themeColors.accent}; padding: 12px 16px; background: #f7fafc; font-style: italic; }
        .badge { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #fed7d7; color: #9b2c2c; font-size: 9pt; font-weight: 700; }
        .bottom-strip { background: ${themeColors.primary}; color: white; padding: 12px 18px; font-size: 11pt; font-weight: 700; }
        .toc li { display: flex; justify-content: space-between; border-bottom: 1px dotted ${themeColors.divider}; padding: 6px 0; }
        .decision-box { background: ${themeColors.primary}; color: white; padding: 16px; border-radius: 14px; font-size: 14pt; font-weight: 700; }
        .meta-table, .data-table { width: 100%; border-collapse: collapse; }
        .meta-table th, .meta-table td, .data-table th, .data-table td { border: 1px solid ${themeColors.divider}; padding: 8px; text-align: left; vertical-align: top; }
        .meta-table th, .data-table th { width: 28%; background: #f8fafc; }
        .section-card { border: 1px solid ${themeColors.divider}; border-radius: 14px; padding: 16px; margin-top: 12px; }
        .chart { margin: 14px 0; border: 1px solid ${themeColors.divider}; border-radius: 14px; padding: 10px; background: white; }
        .citations { padding-left: 18px; }
        .callout-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
        .callout { border-left: 4px solid ${themeColors.accent}; border-radius: 12px; padding: 12px 14px; }
        .callout-title { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.08em; color: ${themeColors.muted}; font-weight: 700; margin-bottom: 6px; }
        .decision-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0 12px; }
        .metric-card { border: 1px solid ${themeColors.divider}; border-radius: 12px; padding: 12px; background: #f8fafc; }
        .metric-card strong { display: block; font-size: 16px; color: ${themeColors.primary}; margin-top: 4px; }
        .so-what-box { border: 1px solid ${themeColors.divider}; border-radius: 14px; padding: 14px 16px; background: #f8fafc; margin: 14px 0; }
        .so-what-box p { margin: 6px 0; }
        .errc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .errc-grid > div { border: 1px solid ${themeColors.divider}; border-radius: 12px; padding: 10px; }
        .footer-note { font-size: 8pt; color: ${themeColors.muted}; margin-top: 24px; }
      </style>
    </head>
    <body>
      <section class="cover">
        <div>
          ${inlineLogo(logoUrl)}
          <div style="margin-top:28px;">
            <h1>Strategic Decision Intelligence Report</h1>
            <p class="subtitle">${brief.report_metadata.company_name} | ${context.geography || "Target market"} | ${new Date(brief.report_metadata.generated_at).toDateString()}</p>
            <div class="query-box">${brief.report_metadata.query}</div>
            <div style="margin-top:18px;"><span class="badge">STRICTLY CONFIDENTIAL - For Board Use Only</span></div>
          </div>
        </div>
        <div class="bottom-strip">Autonomous Strategic Intelligence System v4.0</div>
      </section>

      <section class="page-break">
        <h2>Table of Contents</h2>
        <ul class="toc">
          ${[
            "1.0 Executive Summary",
            "2.0 Strategic Context & Problem Framing",
            "3.0 Multi-Agent Analytical Methodology",
            "4.0 Environmental Analysis (PESTLE)",
            "5.0 Competitive Landscape",
            "6.0 Strategic Options Analysis",
            "7.0 Market & Financial Analysis",
            "8.0 Risk Register",
            "9.0 Strategic Recommendation & Roadmap",
            "Appendix A-C",
          ]
            .map((item, index) => `<li><span>${item}</span><span>${index + 1}</span></li>`)
            .join("")}
        </ul>
      </section>

      <section class="page-break">
        <h2>1.0 Executive Summary</h2>
        <h3>1.1 Strategic Decision</h3>
        <div class="decision-box" style="background:${decisionPalette.bg};">${brief.decision_statement}</div>
        <div class="decision-metrics">
          <div class="metric-card"><span>Decision Confidence</span><strong>${formatPercent(brief.decision_confidence)}</strong></div>
          <div class="metric-card"><span>Quality Grade</span><strong>${brief.quality_report?.overall_grade || "B"}</strong></div>
          <div class="metric-card"><span>Recommendation</span><strong>${brief.recommendation}</strong></div>
        </div>
        <h3>1.3 Summary Narrative</h3>
        ${[
          brief.executive_summary.headline,
          brief.executive_summary.key_argument_1,
          brief.executive_summary.key_argument_2,
          brief.executive_summary.key_argument_3,
        ]
          .filter(Boolean)
          .map((paragraph) => `<p>${paragraph}</p>`)
          .join("")}
        <div class="callout-grid">
          ${calloutBox("Critical Risk", brief.executive_summary.critical_risk, "amber")}
          ${calloutBox("Recommended Next Step", brief.executive_summary.next_step, "blue")}
        </div>
      </section>

      <section class="page-break">
        <h2>2.0 Strategic Context & Problem Framing</h2>
        <h3>2.1 Company Context</h3>
        ${table([
          ["Company Name", brief.report_metadata.company_name],
          ["Sector", String(context.sector || "-")],
          ["HQ", String(context.headquarters || "-")],
          ["Revenue", String(context.annual_revenue || "-")],
          ["Target Market", String(context.geography || "-")],
        ])}
        <h3>2.2 Strategic Question</h3>
        <p>${brief.report_metadata.query}</p>
        <h3>2.3 Analytical Scope</h3>
        ${list(brief.frameworks_applied || [])}
      </section>

      <section class="page-break">
        <h2>3.0 Multi-Agent Analytical Methodology</h2>
        <h3>3.1 Agent Architecture Overview</h3>
        <div class="section-card">
          <pre style="margin:0;font-family:Arial, sans-serif;">Orchestrator -> [Market Intel | Risk Assessment | Competitor Analysis | Geo Intel] -> Financial Reasoning -> Strategic Options -> Synthesis</pre>
        </div>
        <h3>3.2 Agent Collaboration Map</h3>
        <table class="data-table">
          <thead><tr><th>Source Agent</th><th>Target Agent</th><th>Data Shared</th><th>Contribution Summary</th></tr></thead>
          <tbody>${collaborationRows}</tbody>
        </table>
        <h3>3.3 Analytical Frameworks Applied</h3>
        <table class="data-table">
          <thead><tr><th>Framework</th><th>Owning Agent</th><th>Confidence</th><th>Key Output</th></tr></thead>
          <tbody>${frameworkRows}</tbody>
        </table>
      </section>

      <section class="page-break">
        <h2>${brief.section_action_titles?.pestle || "4.0 Environmental Analysis (PESTLE)"}</h2>
        <div class="chart">${renderPestleRadarSvg(brief)}</div>
        <h3>4.2 Dimension-by-dimension analysis</h3>
        ${table([
          ["Political", asStringArray(asRecord(brief.framework_outputs.pestle?.structured_data).political && asRecord(asRecord(brief.framework_outputs.pestle?.structured_data).political).factors).join("; ") || "-"],
          ["Economic", asStringArray(asRecord(brief.framework_outputs.pestle?.structured_data).economic && asRecord(asRecord(brief.framework_outputs.pestle?.structured_data).economic).factors).join("; ") || "-"],
          ["Social", asStringArray(asRecord(brief.framework_outputs.pestle?.structured_data).social && asRecord(asRecord(brief.framework_outputs.pestle?.structured_data).social).factors).join("; ") || "-"],
          ["Technological", asStringArray(asRecord(brief.framework_outputs.pestle?.structured_data).technological && asRecord(asRecord(brief.framework_outputs.pestle?.structured_data).technological).factors).join("; ") || "-"],
          ["Legal", asStringArray(asRecord(brief.framework_outputs.pestle?.structured_data).legal && asRecord(asRecord(brief.framework_outputs.pestle?.structured_data).legal).factors).join("; ") || "-"],
          ["Environmental", asStringArray(asRecord(brief.framework_outputs.pestle?.structured_data).environmental && asRecord(asRecord(brief.framework_outputs.pestle?.structured_data).environmental).factors).join("; ") || "-"],
        ])}
        <h3>4.3 PESTLE Narrative</h3>
        <p>${brief.framework_outputs.pestle?.narrative || ""}</p>
        ${soWhatBox(brief.so_what_callouts?.pestle)}
        <h3>4.4 Citations</h3>
        ${citationList(brief.framework_outputs.pestle?.citations || [])}
      </section>

      <section class="page-break">
        <h2>${brief.section_action_titles?.porters_five_forces || "5.0 Competitive Landscape"}</h2>
        <h3>5.1 Porter's Five Forces Diagram</h3>
        <div class="chart">${renderPorterSvg(brief)}</div>
        <h3>5.2 Competitor Profiles</h3>
        <table class="data-table">
          <thead><tr><th>Name</th><th>Market Share</th><th>Key Strengths</th><th>Key Weaknesses</th></tr></thead>
          <tbody>
            ${competitorProfiles
              .map(
                (profile) =>
                  `<tr><td>${String(profile.name || "-")}</td><td>${String(profile.market_share || "-")}</td><td>${asStringArray(profile.key_strengths).join(", ")}</td><td>${asStringArray(profile.key_weaknesses).join(", ")}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
        <h3>5.4 Blue Ocean Strategy Canvas</h3>
        <div class="chart">${renderBlueOceanSvg(brief)}</div>
        <h3>5.5 ERRC Grid</h3>
        <div class="errc-grid">
          ${["eliminate", "reduce", "raise", "create"]
            .map(
              (key) =>
                `<div><h4 style="margin-top:0;">${key.toUpperCase()}</h4>${list(asStringArray(asRecord(brief.framework_outputs.blue_ocean?.structured_data)[key]))}</div>`
            )
            .join("")}
        </div>
        ${soWhatBox(brief.so_what_callouts?.porters_five_forces)}
      </section>

      <section class="page-break">
        <h2>${brief.section_action_titles?.ansoff || "6.0 Strategic Options Analysis"}</h2>
        <h3>6.1 Ansoff Matrix</h3>
        ${renderAnsoffHtml(brief)}
        <h3>6.2 Option Evaluation</h3>
        <table class="data-table">
          <thead><tr><th>Option</th><th>Ansoff Quadrant</th><th>Feasibility</th><th>Recommended</th></tr></thead>
          <tbody>
            ${optionRows
              .map(
                (option) =>
                  `<tr${option.recommended ? ` style="background:${COLORS.primary};color:white;"` : ""}><td>${option.label}</td><td>${option.key}</td><td>${option.feasibility}%</td><td>${option.recommended ? "Yes" : "No"}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
        <h3>6.3 McKinsey 7S Alignment</h3>
        <div class="chart">${renderMckinseySvg(brief)}</div>
        <p>${brief.framework_outputs.mckinsey_7s?.narrative || ""}</p>
        <h3>6.4 Strategic Pathway Comparison</h3>
        <table class="data-table">
          <thead><tr><th>Pathway</th><th>Strategic Logic</th><th>Fit Score</th><th>Capital Intensity</th><th>Flexibility</th><th>Execution Risk</th></tr></thead>
          <tbody>
            ${pathwayOptions
              .map(
                (option) =>
                  `<tr${option.recommended ? ` style="background:${COLORS.primary};color:white;"` : ""}><td>${String(option.name || "-")}</td><td>${String(option.strategic_logic || "-")}</td><td>${formatPercent(option.fit_score)}</td><td>${String(option.capital_intensity || "-")}</td><td>${String(option.flexibility || "-")}</td><td>${String(option.execution_risk || "-")}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
        <h3>6.5 Capability Fit Matrix</h3>
        <table class="data-table">
          <thead><tr><th>Capability</th><th>Gap</th><th>Build Fit</th><th>External Fit</th><th>Integration Risk</th><th>Recommended Action</th></tr></thead>
          <tbody>
            ${capabilityRows
              .map(
                (row) =>
                  `<tr><td>${String(row.capability || "-")}</td><td>${String(row.gap || "-")}</td><td>${String(row.build_fit || "-")}</td><td>${String(row.acquisition_fit || "-")}</td><td>${String(row.integration_risk || "-")}</td><td>${String(row.recommended_action || "-")}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
        ${soWhatBox(brief.so_what_callouts?.ansoff)}
      </section>

      <section class="page-break">
        <h2>${brief.section_action_titles?.financial_analysis || "7.0 Market & Financial Analysis"}</h2>
        <h3>7.1 Market Intelligence Summary</h3>
        ${table([
          ["Market Headline", String(marketSizing.tam || "-")],
          ["Growth Rate", String(marketSizing.growth_rate || "-")],
          ["Regulatory Landscape", String(asRecord(marketSizing.source).title || "-")],
        ])}
        <h3>7.2 BCG Matrix</h3>
        <div class="chart">${renderBcgSvg(brief)}</div>
        <h3>7.3 Financial Projections</h3>
        <table class="data-table">
          <thead><tr><th>Period</th><th>Revenue</th><th>EBITDA</th><th>ROI</th><th>IRR</th></tr></thead>
          <tbody>
            ${Object.entries(projections)
              .map(
                ([period, values]) =>
                  `<tr><td>${period}</td><td>${String(asRecord(values).revenue || "-")}</td><td>${String(asRecord(values).ebitda || "-")}</td><td>${String(asRecord(values).roi || "-")}</td><td>${String(asRecord(values).irr || "-")}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
        <h3>7.4 Bottom-Up Revenue Build</h3>
        <p>${String(bottomUp.summary || "Bottom-up economics were not available.")}</p>
        <table class="data-table">
          <thead><tr><th>Sector</th><th>Target Clients</th><th>ACV</th><th>Win Rate</th><th>Sales Cycle</th><th>Year 3 Revenue</th></tr></thead>
          <tbody>
            ${sectorBuild
              .map(
                (entry) =>
                  `<tr><td>${String(entry.sector || "-")}</td><td>${String(entry.target_clients || "-")}</td><td>${formatUsdMn(entry.average_contract_value_usd_mn)}</td><td>${formatPercent(entry.win_rate)}</td><td>${formatMonths(entry.sales_cycle_months)}</td><td>${formatUsdMn(entry.year_3_revenue_usd_mn)}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
        <h3>7.5 Scenario Analysis</h3>
        <p>${String(scenarioAnalysis.decision_rule || "Base-case commitment should be protected by milestone-based capital release.")}</p>
        <table class="data-table">
          <thead><tr><th>Scenario</th><th>Year 3 Revenue</th><th>EBITDA Margin</th><th>ROI</th><th>IRR</th><th>Payback</th></tr></thead>
          <tbody>
            ${scenarios
              .map(
                (scenario) =>
                  `<tr${String(scenario.name || "").toLowerCase() === String(scenarioAnalysis.recommended_case || "Base").toLowerCase() ? ` style="background:${COLORS.primary};color:white;"` : ""}><td>${String(scenario.name || "-")}</td><td>${formatUsdMn(scenario.revenue_year_3_usd_mn)}</td><td>${formatPercent(scenario.ebitda_margin_pct, 1)}</td><td>${asNumber(scenario.roi_multiple)?.toFixed(2) || "-"}x</td><td>${formatPercent(scenario.irr_pct, 1)}</td><td>${formatMonths(scenario.payback_months)}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
        ${soWhatBox(brief.so_what_callouts?.bcg_matrix)}
      </section>

      <section class="page-break">
        <h2>${brief.section_action_titles?.risk_assessment || "8.0 Risk Register"}</h2>
        <h3>8.1 Risk Matrix</h3>
        ${renderRiskHeatmapHtml(brief)}
        <h3>8.2 Risk Register Table</h3>
        <table class="data-table">
          <thead><tr><th>Risk ID</th><th>Category</th><th>Description</th><th>Likelihood</th><th>Impact</th><th>Mitigation</th></tr></thead>
          <tbody>
            ${riskRegister
              .map(
                (risk) =>
                  `<tr><td>${risk.risk_id}</td><td>${risk.category}</td><td>${risk.description}</td><td>${risk.likelihood}</td><td>${risk.impact}</td><td>${risk.mitigation}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
        <h3>8.3 Geopolitical Risk Assessment</h3>
        ${table((geoRiskEntries.length > 0 ? geoRiskEntries : [["status", "Geopolitical assessment unavailable"]]) as Array<[string, string]>)}
        <h3>8.4 SWOT Analysis</h3>
        ${renderSwotHtml(brief)}
        <h3>8.5 Execution Realism</h3>
        ${table([
          ["Execution Pressure", String(executionRealism.execution_pressure || "-")],
          ["Commercial Model", String(executionRealism.commercial_model || "-")],
          ["Pricing Model", String(executionRealism.pricing_model || "-")],
        ])}
        <table class="data-table">
          <thead><tr><th>Factor</th><th>Baseline</th><th>Risk</th><th>Mitigation</th></tr></thead>
          <tbody>
            ${executionItems
              .map(
                (item) =>
                  `<tr><td>${String(item.factor || "-")}</td><td>${String(item.baseline || "-")}</td><td>${String(item.risk || "-")}</td><td>${String(item.mitigation || "-")}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
        ${soWhatBox(brief.so_what_callouts?.swot)}
      </section>

      <section class="page-break">
        <h2>${brief.section_action_titles?.decision || "9.0 Strategic Recommendation & Roadmap"}</h2>
        <div class="decision-box" style="background:${decisionPalette.bg};">${brief.decision_statement}</div>
        <h3>9.2 Decision Rationale</h3>
        <p>${brief.decision_rationale}</p>
        <h3>9.3 Balanced Scorecard</h3>
        ${table([
          ["Financial", (brief.balanced_scorecard.financial.objectives || []).join("; ")],
          ["Customer", (brief.balanced_scorecard.customer.objectives || []).join("; ")],
          ["Internal Process", (brief.balanced_scorecard.internal_process.objectives || []).join("; ")],
          ["Learning & Growth", (brief.balanced_scorecard.learning_and_growth.objectives || []).join("; ")],
        ])}
        <h3>9.4 Implementation Roadmap</h3>
        <table class="data-table">
          <thead><tr><th>Phase</th><th>Actions</th><th>Owner</th><th>Metrics</th><th>Investment</th></tr></thead>
          <tbody>
            ${(brief.implementation_roadmap || []).map(
              (item) =>
                `<tr><td>${item.phase}</td><td>${(item.actions || []).join("; ")}</td><td>${item.owner_function}</td><td>${(item.success_metrics || []).join("; ")}</td><td>${item.estimated_investment_usd || "-"}</td></tr>`
            ).join("")}
          </tbody>
        </table>
      </section>

      <section class="page-break">
        <h2>Appendix A: Bibliography</h2>
        ${citationList(citations)}
        <h2>Appendix B: Agent Execution Log</h2>
        <table class="data-table">
          <thead><tr><th>Agent</th><th>Model Used</th><th>Tokens In</th><th>Tokens Out</th><th>Latency</th><th>Tools Called</th></tr></thead>
          <tbody>
            ${asRecordArray(appendix.agent_execution_log)
              .map(
                (item) =>
                  `<tr><td>${String(item.agent || "-")}</td><td>${String(item.model_used || "-")}</td><td>${String(item.tokens_in || "-")}</td><td>${String(item.tokens_out || "-")}</td><td>${String(item.latency_ms || "-")}</td><td>${asRecordArray(item.tools_called).map((tool) => String(tool.tool_name || "-")).join(", ") || "-"}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
        <p>${appendix.trace_url ? `<a href="${appendix.trace_url}">Langfuse Trace</a>` : "No Langfuse trace available."}</p>
        <h2>Appendix C: Methodology & Limitations</h2>
        <p>ASIS v4.0 uses a multi-agent framework-grounded architecture to produce decision-ready strategic analysis. Each specialist agent owns a named strategic management framework or framework section, and synthesis combines them into a board-level recommendation.</p>
        <p>Known limitations include model uncertainty, evidence freshness constraints, and the need for human review before material decisions. This report is AI-assisted analysis and not investment advice.</p>
        <div class="footer-note">${brief.report_metadata.disclaimer}</div>
      </section>
    </body>
  </html>
  `;
}
