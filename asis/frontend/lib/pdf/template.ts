import type { StrategicBriefV4 } from "@/lib/api";
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

function citationList(citations: Array<Record<string, any>>) {
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

function soWhatBox(callout?: Record<string, any>) {
  if (!callout) return "";
  return `
    <div class="so-what-box">
      <div class="callout-title">So What</div>
      <p><strong>Implication:</strong> ${String(callout.implication || "-")}</p>
      <p><strong>Recommended Action:</strong> ${String(callout.recommended_action || "-")}</p>
      <p><strong>Risk of Inaction:</strong> ${String(callout.risk_of_inaction || "-")}</p>
    </div>
  `;
}

export function buildPdfHtml({
  brief,
  appendix,
  logoUrl,
}: {
  brief: StrategicBriefV4;
  appendix: Record<string, any>;
  logoUrl?: string | null;
}): string {
  const context = brief.context || {};
  const citations = brief.citations || [];
  const riskRegister = brief.risk_analysis?.risk_register || [];
  const competitorProfiles = brief.market_analysis?.competitor_profiles || [];
  const projections = brief.financial_analysis?.financial_projections || {};
  const ansoff = brief.framework_outputs?.ansoff?.structured_data || {};
  const optionRows = [
    ["market_penetration", "Market Penetration"],
    ["market_development", "Market Development"],
    ["product_development", "Product Development"],
    ["diversification", "Diversification"],
  ]
    .map(([key, label]) => {
      const option = ansoff[key] || {};
      return {
        label,
        key,
        feasibility: Math.round((Number(option.feasibility || 0) || 0) * 100),
        rationale: String(option.rationale || ""),
        recommended: ansoff.recommended_quadrant === key,
      };
    })
    .filter((option) => option.feasibility > 0 || option.rationale);
  const geoRiskEntries = Object.entries((brief.risk_analysis?.cage_distance_analysis || {}) as Record<string, string>);
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
        `<tr><td>${key}</td><td>${output.agent_author}</td><td>${Math.round((output.confidence_score || 0) * 100)}%</td><td>${output.narrative}</td></tr>`
    )
    .join("");

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 25mm 20mm 20mm 25mm; }
        body { font-family: Arial, sans-serif; color: ${COLORS.text}; font-size: 10pt; line-height: 1.5; margin: 0; }
        .page-break { page-break-before: always; }
        .cover { min-height: 250mm; display: flex; flex-direction: column; justify-content: space-between; }
        h1, h2, h3, h4 { color: ${COLORS.primary}; margin: 0; }
        h1 { font-size: 28pt; line-height: 1.1; }
        h2 { font-size: 18pt; margin-bottom: 10px; }
        h3 { font-size: 14pt; margin: 18px 0 10px; }
        h4 { font-size: 11pt; margin: 12px 0 8px; }
        p { margin: 8px 0; }
        .subtitle { font-size: 14pt; color: ${COLORS.muted}; }
        .query-box { border-left: 4px solid ${COLORS.accent}; padding: 12px 16px; background: #f7fafc; font-style: italic; }
        .badge { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #fed7d7; color: #9b2c2c; font-size: 9pt; font-weight: 700; }
        .bottom-strip { background: ${COLORS.primary}; color: white; padding: 12px 18px; font-size: 11pt; font-weight: 700; }
        .toc li { display: flex; justify-content: space-between; border-bottom: 1px dotted ${COLORS.divider}; padding: 6px 0; }
        .decision-box { background: ${COLORS.primary}; color: white; padding: 16px; border-radius: 14px; font-size: 14pt; font-weight: 700; }
        .meta-table, .data-table { width: 100%; border-collapse: collapse; }
        .meta-table th, .meta-table td, .data-table th, .data-table td { border: 1px solid ${COLORS.divider}; padding: 8px; text-align: left; vertical-align: top; }
        .meta-table th, .data-table th { width: 28%; background: #f8fafc; }
        .section-card { border: 1px solid ${COLORS.divider}; border-radius: 14px; padding: 16px; margin-top: 12px; }
        .chart { margin: 14px 0; border: 1px solid ${COLORS.divider}; border-radius: 14px; padding: 10px; background: white; }
        .citations { padding-left: 18px; }
        .callout-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
        .callout { border-left: 4px solid ${COLORS.accent}; border-radius: 12px; padding: 12px 14px; }
        .callout-title { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.08em; color: ${COLORS.muted}; font-weight: 700; margin-bottom: 6px; }
        .decision-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0 12px; }
        .metric-card { border: 1px solid ${COLORS.divider}; border-radius: 12px; padding: 12px; background: #f8fafc; }
        .metric-card strong { display: block; font-size: 16px; color: ${COLORS.primary}; margin-top: 4px; }
        .so-what-box { border: 1px solid ${COLORS.divider}; border-radius: 14px; padding: 14px 16px; background: #f8fafc; margin: 14px 0; }
        .so-what-box p { margin: 6px 0; }
        .errc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .errc-grid > div { border: 1px solid ${COLORS.divider}; border-radius: 12px; padding: 10px; }
        .footer-note { font-size: 8pt; color: ${COLORS.muted}; margin-top: 24px; }
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
          <div class="metric-card"><span>Decision Confidence</span><strong>${Math.round(brief.decision_confidence * 100)}%</strong></div>
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
          ["Political", String(brief.framework_outputs.pestle?.structured_data?.political?.factors?.join("; ") || "-")],
          ["Economic", String(brief.framework_outputs.pestle?.structured_data?.economic?.factors?.join("; ") || "-")],
          ["Social", String(brief.framework_outputs.pestle?.structured_data?.social?.factors?.join("; ") || "-")],
          ["Technological", String(brief.framework_outputs.pestle?.structured_data?.technological?.factors?.join("; ") || "-")],
          ["Legal", String(brief.framework_outputs.pestle?.structured_data?.legal?.factors?.join("; ") || "-")],
          ["Environmental", String(brief.framework_outputs.pestle?.structured_data?.environmental?.factors?.join("; ") || "-")],
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
                (profile: Record<string, any>) =>
                  `<tr><td>${profile.name}</td><td>${profile.market_share}</td><td>${(profile.key_strengths || []).join(", ")}</td><td>${(profile.key_weaknesses || []).join(", ")}</td></tr>`
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
                `<div><h4 style="margin-top:0;">${key.toUpperCase()}</h4>${list(brief.framework_outputs.blue_ocean?.structured_data?.[key] || [])}</div>`
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
        ${soWhatBox(brief.so_what_callouts?.ansoff)}
      </section>

      <section class="page-break">
        <h2>${brief.section_action_titles?.financial_analysis || "7.0 Market & Financial Analysis"}</h2>
        <h3>7.1 Market Intelligence Summary</h3>
        ${table([
          ["Market Headline", String(brief.market_analysis?.market_sizing?.tam || "-")],
          ["Growth Rate", String(brief.market_analysis?.market_sizing?.growth_rate || "-")],
          ["Regulatory Landscape", String(brief.market_analysis?.market_sizing?.source?.title || "-")],
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
                  `<tr><td>${period}</td><td>${(values as Record<string, any>).revenue}</td><td>${(values as Record<string, any>).ebitda}</td><td>${(values as Record<string, any>).roi}</td><td>${(values as Record<string, any>).irr}</td></tr>`
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
                (risk: Record<string, any>) =>
                  `<tr><td>${risk.risk_id}</td><td>${risk.category}</td><td>${risk.description}</td><td>${risk.likelihood}</td><td>${risk.impact}</td><td>${risk.mitigation}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
        <h3>8.3 Geopolitical Risk Assessment</h3>
        ${table((geoRiskEntries.length > 0 ? geoRiskEntries : [["status", "Geopolitical assessment unavailable"]]) as Array<[string, string]>)}
        <h3>8.4 SWOT Analysis</h3>
        ${renderSwotHtml(brief)}
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
            ${(appendix.agent_execution_log || [])
              .map(
                (item: Record<string, any>) =>
                  `<tr><td>${item.agent}</td><td>${item.model_used || "-"}</td><td>${item.tokens_in || "-"}</td><td>${item.tokens_out || "-"}</td><td>${item.latency_ms || "-"}</td><td>${(item.tools_called || []).map((tool: Record<string, any>) => tool.tool_name).join(", ") || "-"}</td></tr>`
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
