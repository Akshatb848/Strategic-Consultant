"use client";

import { Fragment } from "react";

import type { AnalysisMeta, FrameworkOutput, ReportTheme, StrategicBriefV4 } from "@/lib/api";

import { DecisionStatementBox } from "@/components/report/DecisionStatementBox";
import { ExhibitContainer } from "@/components/report/ExhibitContainer";
import { GanttRoadmap } from "@/components/report/GanttRoadmap";
import { ReportCoverPage } from "@/components/report/ReportCoverPage";
import { ReportExecutiveSummary } from "@/components/report/ReportExecutiveSummary";
import { ReportSection } from "@/components/report/ReportSection";
import { ReportTable, type ReportTableColumn } from "@/components/report/ReportTable";
import { ReportTableOfContents } from "@/components/report/ReportTableOfContents";
import { SectionLayout } from "@/components/report/SectionLayout";
import {
  ensureFindingTitle,
  reportAnalysisMeta,
  reportCompanyName,
  reportFrameworkEntries,
  reportFrameworkSource,
  reportIsMnaMode,
  reportPriorityActions,
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

export function ConsultantReportView({
  brief,
  theme,
  compactAppendix = false,
}: ConsultantReportViewProps) {
  const analysisMeta = reportAnalysisMeta(brief);
  const topFindings = reportTopFindings(brief);
  const priorityActions = reportPriorityActions(brief);
  const tocItems = reportSections(brief);
  const frameworkEntries = reportFrameworkEntries(brief);
  const mnaMode = reportIsMnaMode(brief);

  return (
    <div className="report-root" data-report-theme={theme}>
      <div className="report-page py-10">
        <ReportCoverPage
          title="Strategic decision report"
          subtitle={brief.report_metadata?.query || reportSubtitle(brief)}
          client={reportCompanyName(brief)}
          date={new Date(brief.report_metadata.generated_at).toLocaleDateString()}
          confidentiality={brief.report_metadata.confidentiality_level || "Strictly confidential"}
        />

        <ReportTableOfContents items={tocItems} />

        <ReportExecutiveSummary
          brief={brief}
          topFindings={topFindings}
          priorityActions={priorityActions}
          analysisMeta={analysisMeta}
        />

        <section id="decision" className="report-section py-12">
          <div className="rpt-section-header">2. Decision statement</div>
          <DecisionStatementBox brief={brief} analysisMeta={analysisMeta} />
        </section>

        <ReportSection
          id="market-landscape"
          number="3"
          title="Market landscape and sizing"
          narrative={brief.market_analysis?.strategic_implication as string | undefined}
        >
          <SectionLayout
            aside={
              reportCompanyName(brief) ? (
                <div className="rounded-[18px] border border-[var(--c-divider)] bg-[var(--c-surface)] p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">
                    Context
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-[var(--c-text)]">
                    <div>{reportCompanyName(brief)}</div>
                    <div>{reportSubtitle(brief)}</div>
                    <div>{String(brief.context?.decision_type || "General strategy")}</div>
                  </div>
                </div>
              ) : null
            }
          >
            <ExhibitContainer
              exhibitNumber={1}
              title={ensureFindingTitle(
                "The quantified addressable market supports a staged strategic commitment.",
                "The quantified addressable market supports a staged strategic commitment."
              )}
              source="Source: ASIS quant and market-intelligence synthesis."
            >
              {renderMarketSizing(brief)}
            </ExhibitContainer>
            {renderCompetitorProfiles(brief) ? (
              <ExhibitContainer
                exhibitNumber={2}
                title={ensureFindingTitle(
                  "Named competitors reveal where the client is over- and under-positioned.",
                  "Named competitors reveal where the client is over- and under-positioned."
                )}
                source="Source: ASIS competitor and market-intelligence outputs."
              >
                {renderCompetitorProfiles(brief)}
              </ExhibitContainer>
            ) : null}
          </SectionLayout>
        </ReportSection>

        {frameworkEntries.map(([key, output]) => (
          <ReportSection
            key={key}
            id={`framework-${key}`}
            number={String(output.exhibit_number + 2)}
            title={output.framework_name}
            narrative={output.narrative}
            callout={brief.so_what_callouts?.[key]}
          >
            <ExhibitContainer
              exhibitNumber={output.exhibit_number + 2}
              title={ensureFindingTitle(
                output.exhibit_title,
                `${output.framework_name} sharpens the recommended course of action.`
              )}
              source={reportFrameworkSource(output)}
            >
              {renderFrameworkBody(output)}
            </ExhibitContainer>
          </ReportSection>
        ))}

        <ReportSection
          id="strategic-options"
          number={String(frameworkEntries.length + 4)}
          title="Strategic options"
          narrative={String(brief.board_narrative || "")}
        >
          <ExhibitContainer
            exhibitNumber={frameworkEntries.length + 4}
            title={ensureFindingTitle(
              "The option set favors the path with the strongest value-to-risk trade-off.",
              "The option set favors the path with the strongest value-to-risk trade-off."
            )}
            source="Source: ASIS synthesis and quant outputs."
          >
            {renderStrategicOptions(analysisMeta, brief) || (
              <div className="text-sm text-[var(--c-text-muted)]">No structured strategic options were returned.</div>
            )}
          </ExhibitContainer>
          {analysisMeta.build_vs_buy_verdict ? (
            <div className="so-what-callout">
              <div className="so-what-label">Build versus buy verdict</div>
              <div className="so-what-body">{analysisMeta.build_vs_buy_verdict}</div>
            </div>
          ) : null}
        </ReportSection>

        <ReportSection
          id="roadmap"
          number={String(frameworkEntries.length + 5)}
          title="Implementation roadmap"
          narrative="Execution is sequenced to protect speed, governance, and measurable milestones."
        >
          <GanttRoadmap roadmap={brief.implementation_roadmap || []} />
        </ReportSection>

        {mnaMode ? (
          <ReportSection
            id="mna"
            number={String(frameworkEntries.length + 6)}
            title="M&A and build-versus-buy"
            narrative="Acquisition-mode analyses require an explicit counterfactual before capital is committed."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[18px] border border-[var(--c-divider)] bg-[var(--c-surface)] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">
                  Recommendation shift
                </div>
                <p className="mt-3 text-sm text-[var(--c-text)]">
                  {analysisMeta.recommendation_downgraded
                    ? `The recommendation was adjusted from ${analysisMeta.original_recommendation || "the initial position"} after red-team review.`
                    : "No forced downgrade was applied by the red-team response."}
                </p>
              </div>
              <div className="rounded-[18px] border border-[var(--c-divider)] bg-[var(--c-surface)] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">
                  Build-versus-buy verdict
                </div>
                <p className="mt-3 text-sm text-[var(--c-text)]">
                  {analysisMeta.build_vs_buy_verdict || "No explicit build-versus-buy verdict was returned."}
                </p>
              </div>
            </div>
          </ReportSection>
        ) : null}

        <ReportSection
          id="appendix"
          number={String(frameworkEntries.length + (mnaMode ? 7 : 6))}
          title="Appendix: methodology and sources"
        >
          {renderAppendix(brief, compactAppendix)}
        </ReportSection>
      </div>
    </div>
  );
}
