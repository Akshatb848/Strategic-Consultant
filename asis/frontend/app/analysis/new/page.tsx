"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader, Zap } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { analysesAPI } from "@/lib/api";

function NewAnalysisPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading } = useAuth();

  const [problem, setProblem] = useState(searchParams.get("q") || "");
  const [companyName, setCompanyName] = useState("");
  const [sector, setSector] = useState("");
  const [geography, setGeography] = useState("");
  const [headquarters, setHeadquarters] = useState("");
  const [annualRevenue, setAnnualRevenue] = useState("");
  const [employees, setEmployees] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (problem.trim().length < 20) {
      setError("Please provide more detail in the board question.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await analysesAPI.create({
        query: problem.trim(),
        company_context: {
          company_name: companyName || undefined,
          sector: sector || undefined,
          geography: geography || undefined,
          headquarters: headquarters || undefined,
          annual_revenue: annualRevenue || undefined,
          employees: employees || undefined,
        },
      });
      router.replace(`/analysis/${response.data.analysis.id}`);
    } catch (caughtError: any) {
      setError(caughtError?.response?.data?.detail || "Failed to create analysis. Please try again.");
      setSubmitting(false);
    }
  }

  const contextFields = [
    { label: "Company", value: companyName, setter: setCompanyName, placeholder: "Acme Financial" },
    { label: "Sector", value: sector, setter: setSector, placeholder: "Financial Services" },
    { label: "Geography", value: geography, setter: setGeography, placeholder: "India" },
    { label: "Headquarters", value: headquarters, setter: setHeadquarters, placeholder: "London, UK" },
    { label: "Annual Revenue", value: annualRevenue, setter: setAnnualRevenue, placeholder: "GBP 850M" },
    { label: "Employees", value: employees, setter: setEmployees, placeholder: "4200" },
  ];

  const tips = [
    "Name the organisation, sector, and geography to raise confidence scores.",
    "State the decision type clearly: enter, invest, restructure, acquire, or exit.",
    "Add operating constraints or KPIs so the Quant and Risk agents can anchor trade-offs.",
    "Include timing and scale if the board decision is capital-intensive or regulated.",
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#070b14" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 32px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0c1220" }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 13, textDecoration: "none" }}>
          <ArrowLeft size={14} />Dashboard
        </Link>
        <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.06)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg, #6366f1, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={12} color="white" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600 }}>New Analysis</span>
        </div>
      </header>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>What strategic decision is in front of the board?</h1>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7 }}>
            ASIS will route your question through Strategist, Quant, Market Intelligence, Risk, Red Team, Ethicist, CoVe, and Synthesis to generate a cited enterprise brief.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 24 }}>
            <textarea
              value={problem}
              onChange={(event) => setProblem(event.target.value)}
              placeholder="Should Acme Financial enter the Indian fintech market in 2026 with a phased launch strategy and a 24-month payback target?"
              rows={7}
              style={{ width: "100%", padding: "16px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "#0c1220", color: "#f1f5f9", fontSize: 14, lineHeight: 1.6, outline: "none", resize: "vertical" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ fontSize: 11, color: "#334155" }}>{problem.length} characters</span>
              <span style={{ fontSize: 11, color: problem.length >= 20 ? "#10b981" : "#475569" }}>
                {problem.length >= 20 ? "Ready to submit" : "Minimum 20 characters"}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 24 }}>
            {contextFields.map((field) => (
              <label key={field.label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{field.label}</span>
                <input
                  value={field.value}
                  onChange={(event) => field.setter(event.target.value)}
                  placeholder={field.placeholder}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "#0c1220", color: "#f1f5f9", outline: "none" }}
                />
              </label>
            ))}
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 12, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || problem.trim().length < 20}
            style={{ width: "100%", padding: "13px 24px", borderRadius: 10, background: submitting || problem.trim().length < 20 ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #7c3aed)", color: "white", fontSize: 15, fontWeight: 600, border: "none", cursor: submitting || problem.trim().length < 20 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            {submitting ? <><Loader size={16} style={{ animation: "spin 1s linear infinite" }} />Running 8-agent pipeline...</> : <><Zap size={16} />Run Strategic Analysis</>}
          </button>
        </form>

        <div style={{ marginTop: 28, padding: "16px 18px", borderRadius: 10, background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.12)" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#818cf8", marginBottom: 10 }}>Tips for stronger briefs</p>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {tips.map((tip) => (
              <li key={tip} style={{ fontSize: 12, color: "#64748b", display: "flex", gap: 8 }}>
                <span style={{ color: "#6366f1", flexShrink: 0 }}>&gt;</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", background: "#0c1220" }}>
          <p style={{ fontSize: 11, color: "#334155", lineHeight: 1.6 }}>
            The execution order is Strategist {"->"} Quant and Market Intel in parallel {"->"} Risk {"->"} Red Team and Ethicist in parallel {"->"} CoVe {"->"} Synthesis.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function NewAnalysisPage() {
  return (
    <Suspense fallback={<PageShell />}>
      <NewAnalysisPageContent />
    </Suspense>
  );
}

function PageShell() {
  return <div style={{ minHeight: "100vh", background: "#070b14" }} />;
}
