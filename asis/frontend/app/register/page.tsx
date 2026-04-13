"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI, type AuthProviders } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function RegisterPageContent() {
  const { register, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "", organisation_name: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState<"google" | "github" | null>(null);
  const [providers, setProviders] = useState<AuthProviders | null>(null);

  const pendingQuestion = useMemo(() => searchParams.get("q"), [searchParams]);

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    let active = true;
    authAPI
      .providers()
      .then((response) => {
        if (active) setProviders(response.data);
      })
      .catch(() => {
        if (active) setProviders({ google: false, github: false });
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await register(form);
      if (pendingQuestion) {
        router.replace(`/analysis/new?q=${encodeURIComponent(pendingQuestion)}`);
      } else {
        router.replace("/dashboard");
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail === "ALREADY_EXISTS" ? "That email is already registered." : "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function startOAuth(provider: "google" | "github") {
    if (!providers?.[provider]) {
      setError(`${provider === "google" ? "Google" : "GitHub"} sign-in is not configured for this deployment.`);
      return;
    }
    setError("");
    setOauthSubmitting(provider);
    setTimeout(() => {
      window.location.href = `${API_BASE}/api/v1/auth/${provider}`;
    }, 400);
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "radial-gradient(circle at 20% 20%, rgba(37,99,235,0.18), transparent 30%), radial-gradient(circle at 80% 70%, rgba(16,185,129,0.14), transparent 28%), #050914", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ fontSize: 13, color: "#8fa1b7", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Enterprise Onboarding</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em", marginBottom: 10 }}>Create your ASIS workspace</h1>
          <p style={{ color: "#96a9bf", lineHeight: 1.7 }}>Spin up the board-intelligence environment, then launch your first strategic analysis.</p>
        </div>

        {pendingQuestion && (
          <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 16, background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.24)", color: "#bde9ff" }}>
            Your analysis will run after signup: <strong>{pendingQuestion}</strong>
          </div>
        )}

        <section style={{ padding: 28, borderRadius: 24, background: "rgba(9,15,28,0.86)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {error && <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 14, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#fecaca" }}>{error}</div>}
          <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
            {(["google", "github"] as const).map((provider) => {
              const enabled = providers?.[provider] ?? false;
              const label = provider === "google" ? "Google" : "GitHub";
              const loadingProviders = providers === null;
              return (
                <button
                  key={provider}
                  type="button"
                  onClick={() => startOAuth(provider)}
                  disabled={!!oauthSubmitting || loadingProviders || !enabled}
                  style={{ padding: "12px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)", color: "#e5eef8", fontWeight: 600, cursor: oauthSubmitting ? "wait" : enabled ? "pointer" : "not-allowed", opacity: enabled || loadingProviders ? 1 : 0.72 }}
                >
                  {loadingProviders
                    ? `Checking ${label}...`
                    : !enabled
                      ? `${label} sign-in unavailable`
                      : oauthSubmitting === provider
                        ? `Redirecting to ${label}...`
                        : `Continue with ${label}`}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            <span style={{ color: "#70839b", fontSize: 12 }}>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <input value={form.first_name} onChange={(e) => setForm((current) => ({ ...current, first_name: e.target.value }))} placeholder="First name" required style={inputStyle} />
              <input value={form.last_name} onChange={(e) => setForm((current) => ({ ...current, last_name: e.target.value }))} placeholder="Last name" required style={inputStyle} />
            </div>
            <input value={form.organisation_name} onChange={(e) => setForm((current) => ({ ...current, organisation_name: e.target.value }))} placeholder="Organisation" style={inputStyle} />
            <input value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} type="email" placeholder="you@company.com" required style={inputStyle} />
            <input value={form.password} onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))} type="password" placeholder="Choose a password" required minLength={8} style={inputStyle} />
            <button type="submit" disabled={submitting} style={{ padding: "13px 18px", borderRadius: 14, border: "none", background: submitting ? "rgba(37,99,235,0.55)" : "linear-gradient(135deg, #2563eb, #0ea5e9)", color: "white", fontWeight: 700, cursor: submitting ? "wait" : "pointer" }}>
              {submitting ? "Creating account..." : "Create account"}
            </button>
          </form>
        </section>

        <p style={{ textAlign: "center", marginTop: 18, color: "#90a4bb" }}>
          Already registered?{" "}
          <Link href="/login" style={{ color: "#9bd0ff", fontWeight: 700 }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<PageShell />}>
      <RegisterPageContent />
    </Suspense>
  );
}

function PageShell() {
  return <div style={{ minHeight: "100vh", background: "#050914" }} />;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.03)",
  color: "#eff6ff",
  outline: "none",
};
