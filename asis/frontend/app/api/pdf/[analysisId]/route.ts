import { NextRequest, NextResponse } from "next/server";

import type { ReportTheme, StrategicBriefV4 } from "@/lib/api";
import { buildPdfHtml } from "@/lib/pdf/template";
import { getServerApiBase } from "@/lib/runtime-urls";

export const runtime = "nodejs";

const API_BASE = getServerApiBase();

interface PdfRequestBody {
  analysis_id?: string;
  brief?: StrategicBriefV4;
  appendix?: Record<string, unknown>;
  pdf_max_pages?: number;
  report_company_logo_url?: string | null;
  theme?: ReportTheme;
}

interface AppendixAgentLog {
  agent_name?: string;
  model_used?: string | null;
  token_usage?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
  } | null;
  duration_ms?: number | null;
  tools_called?: unknown[];
  langfuse_trace_id?: string | null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeFilename(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "") || "ASIS_Report";
}

async function loadBriefFromBackend(analysisId: string, authHeader: string) {
  const response = await fetch(`${API_BASE}/api/v1/analysis/${analysisId}`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Unable to load analysis ${analysisId}`);
  }
  const payload = await response.json();
  return payload.analysis;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  const authHeader = request.headers.get("authorization") || "";
  const internalToken = process.env.INTERNAL_REPORT_TOKEN || process.env.JWT_SECRET || "";
  const providedInternalToken = request.headers.get("x-asis-internal-report-token") || "";
  const isInternalRequest = Boolean(internalToken) && providedInternalToken === internalToken;

  if (!authHeader && !isInternalRequest) {
    return NextResponse.json({ detail: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: PdfRequestBody = {};
  try {
    body = (await request.json()) as PdfRequestBody;
  } catch {
    body = {};
  }

  const { analysisId } = await params;
  let brief = body.brief;
  let appendix = body.appendix || {};
  const maxPages = Math.max(1, Number(body.pdf_max_pages || process.env.PDF_MAX_PAGES || 60));

  if (!brief) {
    const analysis = await loadBriefFromBackend(analysisId, authHeader);
    brief = analysis.strategic_brief as StrategicBriefV4;
    const agentLogs = Array.isArray(analysis.agent_logs) ? (analysis.agent_logs as AppendixAgentLog[]) : [];
    appendix = {
      agent_execution_log: agentLogs.map((log) => ({
        agent: log.agent_name,
        model_used: log.model_used,
        tokens_in: log.token_usage?.prompt_tokens,
        tokens_out: log.token_usage?.completion_tokens,
        latency_ms: log.duration_ms,
        tools_called: log.tools_called || [],
      })),
      trace_id: agentLogs.find((log) => log.langfuse_trace_id)?.langfuse_trace_id || null,
      trace_url: null,
    };
  }

  if (!brief || !brief.framework_outputs || !brief.decision_statement) {
    return NextResponse.json({ detail: "INVALID_V4_BRIEF" }, { status: 422 });
  }

  const html = buildPdfHtml({
    brief,
    appendix,
    logoUrl: body.report_company_logo_url || process.env.REPORT_COMPANY_LOGO_URL || null,
    theme: body.theme || "mckinsey",
  });

  const puppeteerModule = await import("puppeteer");
  const browser = await puppeteerModule.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=medium"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const footerCompanyName = escapeHtml(brief.report_metadata.company_name);
    const reportVersion = escapeHtml(brief.report_metadata.asis_version || "ASIS strategic intelligence");
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="width:100%;font-size:8pt;padding:0 18px;color:#1a202c;display:flex;justify-content:space-between;align-items:center;">
          <span>ASIS</span>
          <span>STRICTLY CONFIDENTIAL</span>
          <span class="pageNumber"></span>
        </div>
      `,
      footerTemplate: `
        <div style="width:100%;font-size:8pt;padding:0 18px;color:#718096;display:flex;justify-content:space-between;align-items:center;">
          <span>${footerCompanyName}</span>
          <span>${reportVersion}</span>
        </div>
      `,
      margin: { top: "25mm", right: "20mm", bottom: "20mm", left: "25mm" },
    });

    const pageCount = Buffer.from(pdfBuffer).toString("latin1").match(/\/Type\s*\/Page\b/g)?.length || 0;
    if (pageCount > maxPages) {
      return NextResponse.json(
        { detail: `PDF_PAGE_LIMIT_EXCEEDED: ${pageCount}/${maxPages}` },
        { status: 422 }
      );
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename(`ASIS_${brief.report_metadata.company_name}_${new Date(brief.report_metadata.generated_at).toISOString().slice(0, 10)}`)}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}
