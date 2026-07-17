"use client";

import type { AnalysisMeta, FrameworkOutput, ReportTheme, StrategicBriefV4 } from "@/lib/api";

import { DecisionStatementBox } from "@/components/report/DecisionStatementBox";
import { ExhibitContainer } from "@/components/report/ExhibitContainer";
import { GanttRoadmap } from "@/components/report/GanttRoadmap";
import { ReportCoverPage } from "@/components/report/ReportCoverPage";
import { ReportExecutiveSummary } from "@/components/report/ReportExecutiveSummary";
import { ReportSection } from "@/components/report/ReportSection";
import { ReportTable, type ReportTableColumn } from "@/components/report/ReportTable";
import { ReportTableOfContents } from "@/components/report/ReportTableOfContents";
import { StatCallout } from "@/components/report/StatCallout";
import {
  ensureFindingTitle,
  reportAnalysisMeta,
  reportCompanyName,
  reportFrameworkEntries,
  reportFrameworkSource,
  reportSections,
  reportSubtitle,
  reportTopFindings,
} from "@/lib/reporting";

interface ConsultantReportViewProps {
  brief: StrategicBriefV4;
  theme: ReportTheme;
  compactAppendix?: boolean;
}

type JsonRecord = Record<string, unknown>;

function toDisplay(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(2);
  }
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((item) => toDisplay(item)).join("; ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function objectRows(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function renderRecordTable(data: JsonRecord) {
  const rows = Object.entries(data)
    .filter(([, value]) => value != null && !(Array.isArray(value) && value.length === 0))
    .map(([label, value]) => ({ label, value: toDisplay(value) }));

  const columns: Array<ReportTableColumn<{ label: string; value: string }>> = [
    { key: "label", label: "Dimension", render: (row) => row.label.replace(/_/g, " ") },
    { key: "value", label: "Finding", render: (row) => row.value },
  ];

  return <ReportTable columns={columns} rows={rows} emptyMessage="No structured findings available for this exhibit." />;
}

function renderObjectArrayTable(data: JsonRecord[]) {
  const keys = Array.from(
    new Set(
      data.flatMap((row) =>
        Object.keys(row).filter((key) => !["id", "uuid", "created_at", "updated_at"].includes(key))
      )
    )
  ).slice(0, 6);

  const columns: Array<ReportTableColumn<JsonRecord>> = keys.map((key) => ({
    key,
    label: key.replace(/_/g, " "),
    align: typeof data.find((row) => typeof row[key] === "number")?.[key] === "number" ? "right" : "left",
    render: (row) => toDisplay(row[key]),
  }));

  return <ReportTable columns={columns} rows={data} />;
}

function renderFrameworkBody(output: FrameworkOutput) {
  const structured = record(output.structured_data);
  const rows = objectRows(structured.items || structured.rows || structured.business_units || structured.scenarios);
  if (rows.length > 0) {
    return renderObjectArrayTable(rows);
  }

  const nestedArrays = Object.entries(structured).find(([, value]) => objectRows(value).length > 0);
  if (nestedArrays) {
    return renderObjectArrayTable(objectRows(nestedArrays[1]));
  }

  return renderRecordTable(structured);
}

function renderMarketSizing(brief: StrategicBriefV4) {
  const marketSizing = record(brief.financial_analysis?.market_sizing || brief.market_analysis?.market_sizing);
  const rows = [
    { label: "TAM", value: toDisplay(marketSizing.tam) },
    { label: "SAM", value: toDisplay(marketSizing.sam) },
    { label: "SOM", value: toDisplay(marketSizing.som) },
    { label: "Growth rate", value: toDisplay(marketSizing.growth_rate) },
    { label: "Primary source", value: toDisplay(record(marketSizing.source).title) },
  ].filter((row) => row.value !== "-");

  const columns: Array<ReportTableColumn<{ label: string; value: string }>> = [
    { key: "label", label: "Metric", render: (row) => row.label },
    { key: "value", label: "Value", render: (row) => row.value },
  ];

  return <ReportTable columns={columns} rows={rows} emptyMessage="Market sizing was not returned for this analysis." />;
}

function renderCompetitorProfiles(brief: StrategicBriefV4) {
  const competitors = objectRows(brief.market_analysis?.competitor_profiles);
  if (competitors.length === 0) return null;

  const columns: Array<ReportTableColumn<JsonRecord>> = [
    { key: "name", label: "Competitor", render: (row) => toDisplay(row.name) },
    { key: "market_share", label: "Market share", align: "right", render: (row) => toDisplay(row.market_share) },
    { key: "key_strengths", label: "Strengths", render: (row) => toDisplay(row.key_strengths) },
    { key: "key_weaknesses", label: "Weaknesses", render: (row) => toDisplay(row.key_weaknesses) },
  ];

  return <ReportTable columns={columns} rows={competitors} />;
}

function renderStrategicOptions(analysisMeta: AnalysisMeta, brief: StrategicBriefV4) {
  const options = Array.isArray(analysisMeta.three_options) ? analysisMeta.three_options : [];
  if (options.length > 0) {
    const columns: Array<ReportTableColumn<JsonRecord>> = [
      { key: "option", label: "Option", render: (row) => toDisplay(row.option) },
      { key: "label", label: "Strategic path", render: (row) => toDisplay(row.label) },
      { key: "total_cost", label: "Total cost", align: "right", render: (row) => toDisplay(row.total_cost) },
      {
        key: "npv_3yr_risk_adjusted",
        label: "Risk-adjusted NPV",
        align: "right",
        render: (row) => toDisplay(row.npv_3yr_risk_adjusted),
      },
      {
        key: "probability_of_achieving_roi_target",
        label: "Probability of target ROI",
        align: "right",
        render: (row) => toDisplay(row.probability_of_achieving_roi_target),
      },
      { key: "recommended", label: "Recommended", render: (row) => (row.recommended ? "Yes" : "No") },
    ];
    return <ReportTable columns={columns} rows={options as JsonRecord[]} />;
  }

  const pathways = objectRows(record(brief.market_analysis?.strategic_pathways).options);
  if (pathways.length > 0) {
    const columns: Array<ReportTableColumn<JsonRecord>> = [
      { key: "name", label: "Pathway", render: (row) => toDisplay(row.name) },
      { key: "strategic_logic", label: "Strategic logic", render: (row) => toDisplay(row.strategic_logic) },
      { key: "fit_score", label: "Fit", align: "right", render: (row) => toDisplay(row.fit_score) },
      { key: "execution_risk", label: "Execution risk", render: (row) => toDisplay(row.execution_risk) },
      { key: "recommended", label: "Recommended", render: (row) => (row.recommended ? "Yes" : "No") },
    ];
    return <ReportTable columns={columns} rows={pathways} />;
  }

  return null;
}

function renderAppendix(brief: StrategicBriefV4, compactAppendix: boolean) {
  const citations = (brief.citations || []).map((citation, index) => ({
    no: String(index + 1),
    title: toDisplay(citation.title || citation.source || citation.publisher || "Source"),
    source: toDisplay(citation.publisher || citation.source || "-"),
    year: toDisplay(citation.year || citation.published_at || "-"),
    url: toDisplay(citation.url || "-"),
  }));

  const collaboration = (brief.agent_collaboration_trace || []).map((item) => ({
    source: item.source_agent,
    target: item.target_agent,
    field: item.data_field,
    summary: item.contribution_summary,
  }));

  const citationColumns: Array<ReportTableColumn<{ no: string; title: string; source: string; year: string; url: string }>> = [
    { key: "no", label: "No.", render: (row) => row.no, align: "right" },
    { key: "title", label: "Source", render: (row) => row.title },
    { key: "source", label: "Publisher", render: (row) => row.source },
    { key: "year", label: "Date", render: (row) => row.year },
  ];

  const collaborationColumns: Array<ReportTableColumn<{ source: string; target: string; field: string; summary: string }>> = [
    { key: "source", label: "From", render: (row) => row.source },
    { key: "target", label: "To", render: (row) => row.target },
    { key: "field", label: "Shared artifact", render: (row) => row.field.replace(/_/g, " ") },
    { key: "summary", label: "Decision contribution", render: (row) => row.summary },
  ];

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">
          Methodology
        </div>
        <p className="mt-3 text-sm text-[var(--c-text)]">
          ASIS generated this report through an eight-agent sequential pipeline spanning orchestration, market intelligence,
          risk assessment, competitor analysis, geo-intel, financial reasoning, strategic options, and synthesis. Each
          section in the report is grounded in the persisted agent output rather than a presentation-only rewrite.
        </p>
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">
          Citations and source register
        </div>
        <div className="mt-4">
          <ReportTable columns={citationColumns} rows={citations} emptyMessage="No citations were stored for this analysis." />
        </div>
      </div>

      {!compactAppendix ? (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">
            Collaboration trace summary
          </div>
          <div className="mt-4">
            <ReportTable
              columns={collaborationColumns}
              rows={collaboration}
              emptyMessage="No collaboration trace was captured for this analysis."
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function evidenceRows(brief: StrategicBriefV4) {
  return (brief.citations || []).map((citation) => ({
    id: String(citation.id || ""),
    title: toDisplay(citation.title || citation.source),
    source: toDisplay(citation.source),
    status: toDisplay(citation.verification_status || ""),
    retrieved: toDisplay(citation.retrieved_at || ""),
    url: toDisplay(citation.url),
  }));
}

function reportRiskRows(brief: StrategicBriefV4) {
  const risks = objectRows(brief.risk_analysis?.risk_register || brief.risk_analysis?.summary);
  return risks.map((risk, index) => ({
    id: toDisplay(risk.risk_id || risk.id || `R${index + 1}`),
    category: toDisplay(risk.category),
    description: toDisplay(risk.description || risk.risk),
    score: toDisplay(risk.inherent_score || risk.score),
    mitigation: toDisplay(risk.mitigation || risk.response),
  }));
}

function reportOpportunityRows(brief: StrategicBriefV4) {
  const opportunities = objectRows(brief.market_analysis?.opportunities || brief.framework_outputs?.swot?.structured_data?.opportunities);
  return opportunities.map((item, index) => ({
    id: `O${index + 1}`,
    opportunity: toDisplay(item.opportunity || item.description || item.name || item),
    evidence: toDisplay(item.evidence || item.rationale || item.implication),
    action: toDisplay(item.action || item.recommended_action),
  }));
}

function reportInsightRows(brief: StrategicBriefV4) {
  return reportTopFindings(brief).slice(0, 8).map((finding, index) => ({ id: String(index + 1), finding }));
}

function reportRecommendationRows(brief: StrategicBriefV4) {
  return (brief.executive_recommendations || []).slice(0, 5).map((item, index) => ({
    priority: toDisplay(item.priority || index + 1),
    recommendation: toDisplay(item.recommendation),
    impact: toDisplay(item.expected_impact),
    horizon: toDisplay(item.time_horizon),
  }));
}

export function ConsultantReportView({ brief, theme, compactAppendix = false }: ConsultantReportViewProps) {
  const analysisMeta = reportAnalysisMeta(brief);
  const tocItems = reportSections(brief);
  const frameworkEntries = reportFrameworkEntries(brief);
  const evidence = evidenceRows(brief);
  const sourceColumns: Array<ReportTableColumn<(typeof evidence)[number]>> = [
    { key: "id", label: "ID", render: (row) => row.id },
    { key: "title", label: "Source", render: (row) => row.title },
    { key: "source", label: "Publisher", render: (row) => row.source },
    { key: "status", label: "Status", render: (row) => row.status },
    { key: "retrieved", label: "Retrieved", render: (row) => row.retrieved },
  ];

  return (
    <div className="report-root" data-report-theme={theme}>
      <div className="report-page py-10">
        <ReportCoverPage
          title="ASIS Strategic Intelligence Report"
          subtitle={brief.report_metadata?.query || reportSubtitle(brief)}
          client={reportCompanyName(brief)}
          date={new Date(brief.report_metadata.generated_at).toLocaleDateString()}
          confidentiality={brief.report_metadata.confidentiality_level || "Strictly confidential"}
          metadata={[
            { label: "Report ID", value: toDisplay(brief.report_metadata.analysis_id) },
            { label: "Scenario ID", value: toDisplay(brief.context?.scenario_id || brief.context?.scenario) },
            { label: "Industry", value: toDisplay(brief.context?.industry || brief.context?.sector) },
            { label: "Country / Region", value: toDisplay(brief.context?.country || brief.context?.geography) },
            { label: "Report version", value: toDisplay(brief.report_metadata.template_version || brief.report_metadata.asis_version) },
            { label: "Confidence level", value: `${Math.round(brief.decision_confidence * 100)}%` },
            { label: "Executive classification", value: toDisplay(brief.report_metadata.confidentiality_level) },
          ]}
        />
        <ReportTableOfContents items={tocItems} />

        <ReportExecutiveSummary brief={brief} />

        <ReportSection id="scenario-context" number="2" title="Scenario Context" narrative={brief.decision_rationale}>
          <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
            <DecisionStatementBox brief={brief} analysisMeta={analysisMeta} />
            <ReportTable
              columns={[
                { key: "field", label: "Context", render: (row: { field: string; value: string }) => row.field },
                { key: "value", label: "Value", render: (row: { field: string; value: string }) => row.value },
              ]}
              rows={[
                { field: "Company", value: reportCompanyName(brief) },
                { field: "Sector", value: toDisplay(brief.context?.sector || brief.context?.industry) },
                { field: "Geography", value: toDisplay(brief.context?.geography) },
                { field: "Decision type", value: toDisplay(brief.context?.decision_type) },
                { field: "Time horizon", value: toDisplay(brief.context?.time_horizon_years) },
              ]}
            />
          </div>
        </ReportSection>

        <ReportSection id="evidence-base" number="3" title="Evidence Base" narrative="Only verified live sources recorded by the evidence provider are eligible for this report.">
          <ReportTable columns={sourceColumns} rows={evidence} emptyMessage="No verified evidence was retrieved; this report is not publishable." />
          <div className="mt-5 text-sm text-[var(--c-text-muted)]">
            Provider: {toDisplay(brief.evidence_provenance?.provider)} · Verified sources: {toDisplay(brief.evidence_provenance?.verified_source_count)}
          </div>
        </ReportSection>

        <ReportSection id="multi-agent-analysis" number="4" title="Multi-Agent Analysis" narrative={brief.board_narrative}>
          <div className="space-y-8">
            {frameworkEntries.map(([key, output]) => (
              <ExhibitContainer key={key} exhibitNumber={output.exhibit_number} title={ensureFindingTitle(output.exhibit_title, `${output.framework_name} produces a query-specific finding.`)} source={reportFrameworkSource(output)}>
                <ReportSection id={`framework-${key}`} number={String(output.exhibit_number)} title={output.framework_name} narrative={output.narrative} callout={brief.so_what_callouts?.[key]}>
                  {renderFrameworkBody(output)}
                </ReportSection>
              </ExhibitContainer>
            ))}
          </div>
        </ReportSection>

        <ReportSection id="strategic-intelligence-dashboard" number="5" title="Strategic Intelligence Dashboard">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCallout label="Decision confidence" value={`${Math.round(brief.decision_confidence * 100)}%`} detail="Evidence-calibrated" />
            <StatCallout label="Quality grade" value={brief.quality_report?.overall_grade || "FAIL"} detail="Quality gate result" />
            <StatCallout label="Frameworks" value={String(frameworkEntries.length)} detail="Completed analytical lenses" />
            <StatCallout label="Verified sources" value={String(evidence.length)} detail="Live source register" />
          </div>
          <div className="mt-6">
            <ExhibitContainer exhibitNumber={0} title="The decision is governed by evidence, risk, economics, and execution readiness." source="Source: ASIS quality-gated synthesis.">
              {renderMarketSizing(brief)}
            </ExhibitContainer>
          </div>
        </ReportSection>

        <ReportSection id="strategic-insights" number="6" title="Strategic Insights">
          <ReportTable columns={[{ key: "id", label: "No.", render: (row) => row.id }, { key: "finding", label: "Finding", render: (row) => row.finding }]} rows={reportInsightRows(brief)} />
        </ReportSection>

        <ReportSection id="executive-recommendations" number="7" title="Executive Recommendations" narrative="Five actions are required; no additional recommendations are presented in the formal deliverable.">
          <ReportTable
            columns={[
              { key: "priority", label: "Priority", render: (row) => row.priority },
              { key: "recommendation", label: "Recommendation", render: (row) => row.recommendation },
              { key: "impact", label: "Expected impact", render: (row) => row.impact },
              { key: "horizon", label: "Time horizon", render: (row) => row.horizon },
            ]}
            rows={reportRecommendationRows(brief)}
            emptyMessage="No recommendations were returned; the report is not publishable."
          />
        </ReportSection>

        <ReportSection id="strategic-roadmap" number="8" title="Strategic Roadmap">
          <GanttRoadmap roadmap={brief.implementation_roadmap || []} />
        </ReportSection>

        <ReportSection id="evidence-traceability" number="9" title="Evidence Traceability Matrix">
          <ReportTable columns={[{ key: "framework", label: "Framework", render: (row) => row.framework }, { key: "sources", label: "Source IDs", render: (row) => row.sources }, { key: "finding", label: "Finding", render: (row) => row.finding }]} rows={frameworkEntries.map(([key, output]) => ({ framework: output.framework_name || key, sources: (output.citations || []).map((item) => toDisplay(item.id)).join(", "), finding: output.narrative }))} />
        </ReportSection>

        <ReportSection id="risk-matrix" number="10" title="Risk Matrix">
          <ReportTable columns={[{ key: "id", label: "ID", render: (row) => row.id }, { key: "category", label: "Category", render: (row) => row.category }, { key: "description", label: "Risk", render: (row) => row.description }, { key: "score", label: "Score", render: (row) => row.score }, { key: "mitigation", label: "Mitigation", render: (row) => row.mitigation }]} rows={reportRiskRows(brief)} />
        </ReportSection>

        <ReportSection id="opportunity-matrix" number="11" title="Opportunity Matrix">
          <ReportTable columns={[{ key: "id", label: "ID", render: (row) => row.id }, { key: "opportunity", label: "Opportunity", render: (row) => row.opportunity }, { key: "evidence", label: "Evidence", render: (row) => row.evidence }, { key: "action", label: "Action", render: (row) => row.action }]} rows={reportOpportunityRows(brief)} />
        </ReportSection>

        <ReportSection id="benchmark-comparison" number="12" title="Benchmark Comparison Sheet" narrative="Reserved for post-generation comparison. This section is intentionally blank during generation.">
          <div className="min-h-32 border border-dashed border-[var(--c-divider)]" aria-label="Blank benchmark comparison sheet" />
        </ReportSection>

        <ReportSection id="citation-register" number="13" title="Citation Register">
          <ReportTable columns={sourceColumns} rows={evidence} emptyMessage="No citation register is available." />
        </ReportSection>

        <ReportSection id="appendices" number="14" title="Appendices">
          {renderAppendix(brief, compactAppendix)}
        </ReportSection>
      </div>
    </div>
  );
}
