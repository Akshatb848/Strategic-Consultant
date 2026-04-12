"use client";

import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE}/api/v1/auth/refresh`, {}, { withCredentials: true })
      .then((response) => {
        const token = response.data.access_token as string;
        setAccessToken(token);
        return token;
      })
      .catch(() => {
        clearAccessToken();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError & { config: InternalAxiosRequestConfig & { _retry?: boolean } }) => {
    const original = error.config;
    const url = original?.url || "";
    const isAuthRoute = url.includes("/api/v1/auth/login") || url.includes("/api/v1/auth/register") || url.includes("/api/v1/auth/refresh");
    if (error.response?.status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      const token = await refreshAccessToken();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  title: string;
  role: string;
  organisation_name: string;
  plan: string;
  avatar_initials: string;
  avatar_url?: string | null;
  auth_provider: string;
  is_active: boolean;
  is_admin: boolean;
  analysis_count: number;
  last_login_at?: string | null;
  created_at: string;
}

export interface AgentLog {
  id: string;
  agent_id: string;
  agent_name: string;
  event_type: string;
  status: string;
  confidence_score?: number | null;
  model_used?: string | null;
  tools_called?: AgentToolCall[] | null;
  langfuse_trace_id?: string | null;
  attempt_number: number;
  self_corrected: boolean;
  correction_reason?: string | null;
  duration_ms?: number | null;
  token_usage?: Record<string, number> | null;
  citations?: Array<Record<string, unknown>> | null;
  parsed_output?: Record<string, unknown> | null;
  created_at: string;
}

export interface AgentToolCall {
  tool_name: string;
  query: string;
  response_size: number;
  latency_ms: number;
}

export interface AgentCollaborationEvent {
  source_agent: string;
  target_agent: string;
  data_field: string;
  timestamp_ms: number;
  contribution_summary: string;
}

export interface FrameworkOutput {
  framework_name: string;
  agent_author: string;
  structured_data: Record<string, any>;
  narrative: string;
  citations: Array<Record<string, any>>;
  confidence_score: number;
}

export interface RoadmapItem {
  phase: string;
  actions: string[];
  owner_function: string;
  success_metrics: string[];
  estimated_investment_usd?: number | null;
}

export interface BalancedScorecardPerspective {
  objectives: string[];
  measures: string[];
  targets: string[];
  initiatives: string[];
}

export interface BalancedScorecardOutput {
  financial: BalancedScorecardPerspective;
  customer: BalancedScorecardPerspective;
  internal_process: BalancedScorecardPerspective;
  learning_and_growth: BalancedScorecardPerspective;
}

export interface ReportMetadata {
  analysis_id: string;
  company_name: string;
  query: string;
  generated_at: string;
  asis_version: string;
  confidentiality_level: string;
  disclaimer: string;
}

export interface StrategicBriefV4 {
  decision_statement: string;
  decision_confidence: number;
  decision_rationale: string;
  framework_outputs: Record<string, FrameworkOutput>;
  agent_collaboration_trace: AgentCollaborationEvent[];
  executive_summary: string;
  implementation_roadmap: RoadmapItem[];
  balanced_scorecard: BalancedScorecardOutput;
  report_metadata: ReportMetadata;
  board_narrative: string;
  recommendation: string;
  overall_confidence: number;
  frameworks_applied: string[];
  context: Record<string, any>;
  market_analysis: Record<string, any>;
  financial_analysis: Record<string, any>;
  risk_analysis: Record<string, any>;
  red_team: Record<string, any>;
  verification: Record<string, any>;
  roadmap: RoadmapItem[];
  citations: Array<Record<string, any>>;
}

export interface DecisionPayload {
  decision_statement: string;
  decision_confidence: number;
  decision_rationale: string;
  supporting_frameworks: string[];
}

export interface PdfStatus {
  status: "generating" | "ready" | "error";
  progress: number;
  error?: string | null;
}

export interface Analysis {
  id: string;
  query: string;
  company_context: Record<string, unknown>;
  extracted_context: Record<string, unknown>;
  status: "queued" | "running" | "completed" | "failed";
  current_agent?: string | null;
  pipeline_version: string;
  overall_confidence?: number | null;
  decision_recommendation?: string | null;
  executive_summary?: string | null;
  board_narrative?: string | null;
  duration_seconds?: number | null;
  created_at: string;
  completed_at?: string | null;
  strategic_brief?: Record<string, any> | StrategicBriefV4 | null;
  logic_consistency_passed?: boolean | null;
  self_correction_count?: number;
  agent_logs?: AgentLog[];
  report_id?: string | null;
}

export interface Report {
  id: string;
  analysis_id: string;
  user_id: string;
  strategic_brief: Record<string, any> | StrategicBriefV4;
  evaluation?: Record<string, any> | null;
  pdf_url?: string | null;
  pdf_status?: string | null;
  pdf_progress?: number | null;
  pdf_error?: string | null;
  pdf_generated_at?: string | null;
  report_version: number;
  created_at: string;
  updated_at: string;
}

export async function bootstrapSession(): Promise<User | null> {
  const token = await refreshAccessToken();
  if (!token) return null;
  const response = await api.get("/api/v1/auth/me");
  return response.data.user as User;
}

export const authAPI = {
  register: (payload: { email: string; password: string; first_name: string; last_name: string; organisation_name?: string; title?: string }) =>
    api.post("/api/v1/auth/register", payload),
  login: (email: string, password: string) => api.post("/api/v1/auth/login", { email, password }),
  me: () => api.get("/api/v1/auth/me"),
  refresh: () => refreshAccessToken(),
  logout: () => api.post("/api/v1/auth/logout"),
};

export const analysesAPI = {
  create: (payload: { query: string; company_context: Record<string, unknown>; run_baseline?: boolean }) =>
    api.post("/api/v1/analysis", payload),
  list: (params?: { status?: string; search?: string; limit?: number; offset?: number }) =>
    api.get("/api/v1/analysis", { params }),
  get: (id: string) => api.get(`/api/v1/analysis/${id}`),
};

export const reportsAPI = {
  list: () => api.get("/api/v1/reports"),
  get: (id: string) => api.get(`/api/v1/reports/${id}`),
  evaluation: (id: string) => api.get(`/api/v1/reports/${id}/evaluation`),
  frameworks: (analysisId: string) => api.get(`/api/v1/reports/${analysisId}/frameworks`),
  collaboration: (analysisId: string) => api.get(`/api/v1/reports/${analysisId}/collaboration`),
  decision: (analysisId: string) => api.get(`/api/v1/reports/${analysisId}/decision`),
  pdf: (analysisId: string) => api.post(`/api/v1/reports/${analysisId}/pdf`, {}, { responseType: "blob" }),
  pdfStatus: (analysisId: string) => api.get(`/api/v1/reports/${analysisId}/pdf/status`),
  remove: (id: string) => api.delete(`/api/v1/reports/${id}`),
};
