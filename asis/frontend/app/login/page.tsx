"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function LoginPageContent() {
  const { login, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState<"google" | "github" | null>(null);
  const [lockedUntilPasswordChange, setLockedUntilPasswordChange] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, loading, router]);

  const oauthError = useMemo(() => {
    const code = searchParams.get("error");
    if (code === "google_failed" || code === "google_unavailable") return "Google sign-in is unavailable right now. Please use email.";
    if (code === "github_failed" || code === "github_unavailable") return "GitHub sign-in is unavailable right now. Please use email.";
    if (code === "oauth_failed") return "OAuth sign-in failed. Please try again.";
    return "";
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lockedUntilPasswordChange) return;
    setSubmitting(true);
    setError("");
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err: any) {
      const message = err?.response?.data?.detail === "INVALID_CREDENTIALS" ? "Incorrect email or password." : "Sign-in failed. Please try again.";
      setError(message);
      setPassword("");
      setLockedUntilPasswordChange(true);
      requestAnimationFrame(() => passwordRef.current?.focus());
    } finally {
      setSubmitting(false);
    }
  }

  function startOAuth(provider: "google" | "github") {
    setOauthSubmitting(provider);
    setTimeout(() => {
      window.location.href = `${API_BASE}/api/v1/auth/${provider}`;
    }, 400);
  }

  if (loading) {
    return <div style={{ minHeight: "100vh", background: "#050914" }} />;
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "radial-gradient(circle at 20% 20%, rgba(14,165,233,0.18), transparent 28%), radial-gradient(circle at 80% 30%, rgba(249,115,22,0.12), transparent 26%), #050914", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: "#8fa1b7", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Secure Workspace</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em", marginBottom: 10 }}>Sign in to ASIS</h1>
          <p style={{ color: "#96a9bf", lineHeight: 1.7 }}>Access strategic briefs, verification trails, risk registers, and board-ready recommendations.</p>
        </div>

        <section style={{ padding: 28, borderRadius: 24, background: "rgba(9,15,28,0.86)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 30px 80px rgba(0,0,0,0.35)" }}>
          {oauthError && <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 14, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#fecaca" }}>{oauthError}</div>}
          {error && <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 14, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#fecaca" }}>{error}</div>}

          <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
            {(["google", "github"] as const).map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => startOAuth(provider)}
                disabled={!!oauthSubmitting}
                style={{ padding: "12px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)", color: "#e5eef8", fontWeight: 600, cursor: oauthSubmitting ? "wait" : "pointer" }}
              >
                {oauthSubmitting === provider ? `Redirecting to ${provider}...` : `Continue with ${provider === "google" ? "Google" : "GitHub"}`}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            <span style={{ color: "#70839b", fontSize: 12 }}>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#8fa1b7" }}>Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required style={inputStyle} placeholder="you@company.com" />
            </label>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#8fa1b7" }}>Password</span>
              <input
                ref={passwordRef}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (lockedUntilPasswordChange) setLockedUntilPasswordChange(false);
                }}
                type="password"
                required
                style={inputStyle}
                placeholder="Enter your password"
              />
            </label>
            <button type="submit" disabled={submitting || lockedUntilPasswordChange} style={{ padding: "13px 18px", borderRadius: 14, border: "none", background: submitting ? "rgba(37,99,235,0.55)" : "linear-gradient(135deg, #2563eb, #0ea5e9)", color: "white", fontWeight: 700, cursor: submitting ? "wait" : "pointer" }}>
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </section>

        <p style={{ textAlign: "center", marginTop: 18, color: "#90a4bb" }}>
          Need an account?{" "}
          <Link href="/register" style={{ color: "#9bd0ff", fontWeight: 700 }}>
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageShell />}>
      <LoginPageContent />
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
