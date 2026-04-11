"use client";

import Link from "next/link";

const differentiators = [
  { title: "Debate-to-Verify", body: "Red Team and CoVe challenge the recommendation before it reaches the board." },
  { title: "Weighted Confidence", body: "Confidence is propagated across specialist agents instead of hardcoded to a static comfort score." },
  { title: "Board-Ready Output", body: "Every analysis ships with a recommendation, roadmap, scorecard, risk register, and citations." },
];

const processSteps = [
  "Strategist decomposes the board question into MECE workstreams.",
  "Quant and Market Intel run in parallel on economics and market structure.",
  "Risk assembles the enterprise register and heat-map priorities.",
  "Red Team and Ethicist challenge the thesis from adversarial and stakeholder angles.",
  "CoVe verifies claims, adjusts confidence, and gates the final synthesis.",
];

export default function LandingPage() {
  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, rgba(25,87,255,0.22), transparent 32%), radial-gradient(circle at 80% 20%, rgba(244,114,182,0.16), transparent 28%), radial-gradient(circle at bottom right, rgba(16,185,129,0.14), transparent 30%), #050914" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 40, backdropFilter: "blur(16px)", background: "rgba(5,9,20,0.72)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg, #0ea5e9, #2563eb 55%, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>A</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>ASIS v4.0</div>
              <div style={{ fontSize: 11, color: "#93a3b8" }}>The Silicon Consultancy</div>
            </div>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 13 }}>
            <span style={{ color: "#93a3b8" }}>For Enterprises</span>
            <Link href="/login" style={{ color: "#dbe6f4" }}>Sign in</Link>
            <Link href="/register" style={{ padding: "10px 16px", borderRadius: 999, background: "linear-gradient(135deg, #2563eb, #0ea5e9)", color: "white", fontWeight: 600 }}>Get Started</Link>
          </nav>
        </div>
      </header>

      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "84px 24px 64px", display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(360px, 0.85fr)", gap: 40, alignItems: "center" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 14px", borderRadius: 999, background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.24)", color: "#9bd0ff", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 24 }}>
            Powered By Multi-Agent AI
          </div>
          <h1 style={{ fontSize: "clamp(42px, 7vw, 76px)", lineHeight: 0.98, letterSpacing: "-0.05em", marginBottom: 18 }}>
            Strategic decisions,
            <br />
            stress-tested before the board sees them.
          </h1>
          <p style={{ maxWidth: 680, fontSize: 17, color: "#9db0c7", lineHeight: 1.75, marginBottom: 28 }}>
            ASIS is an enterprise strategic intelligence system for boards, partners, and transformation leaders. It decomposes ambiguous decisions, debates them across specialist agents, verifies claims, and returns a cited strategic brief with confidence, risk, and financial reasoning.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 34 }}>
            <Link href="/register" style={{ padding: "14px 20px", borderRadius: 14, background: "linear-gradient(135deg, #2563eb, #0ea5e9)", color: "white", fontWeight: 700 }}>Start Enterprise Trial</Link>
            <Link href="/login" style={{ padding: "14px 20px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", color: "#dbe6f4", fontWeight: 600 }}>View Secure Workspace</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
            {[
              ["8", "visible specialist agents"],
              ["1000", "Monte Carlo iterations"],
              ["3", "board horizons in every roadmap"],
            ].map(([metric, label]) => (
              <div key={metric} style={{ padding: "16px 18px", borderRadius: 16, background: "rgba(10,18,34,0.82)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{metric}</div>
                <div style={{ fontSize: 12, color: "#8fa1b7" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 26, borderRadius: 24, background: "rgba(10,18,34,0.82)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 28px 80px rgba(0,0,0,0.38)" }}>
          <div style={{ display: "grid", gap: 14 }}>
            {["Strategist", "Quant", "Market Intel", "Risk", "Red Team", "Ethicist", "CoVe", "Synthesis"].map((agent, index) => (
              <div key={agent} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 14, background: index % 2 === 0 ? "rgba(255,255,255,0.03)" : "rgba(37,99,235,0.08)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ width: 12, height: 12, borderRadius: 999, background: index < 2 ? "#0ea5e9" : index < 4 ? "#f59e0b" : index < 6 ? "#ef4444" : "#10b981" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{agent}</div>
                  <div style={{ fontSize: 12, color: "#8fa1b7" }}>{processSteps[index] || "Board-ready assembly and verification."}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 24px 54px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 18 }}>
          {differentiators.map((item) => (
            <article key={item.title} style={{ padding: 24, borderRadius: 20, background: "rgba(10,18,34,0.82)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{item.title}</h2>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "#97a9bf" }}>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "16px 24px 72px" }}>
        <div style={{ padding: 28, borderRadius: 24, background: "rgba(8,14,28,0.86)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 18, marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8fa1b7", marginBottom: 8 }}>Debate-To-Verify</div>
              <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" }}>How every recommendation gets pressure-tested</h2>
            </div>
            <Link href="/register?q=Should%20we%20enter%20the%20Indian%20fintech%20market%20in%202026%3F" style={{ color: "#9bd0ff", fontWeight: 600 }}>Try a live question</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
            {processSteps.map((step, index) => (
              <div key={step} style={{ padding: "18px 16px", borderRadius: 18, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 999, background: "rgba(37,99,235,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, marginBottom: 12 }}>{index + 1}</div>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: "#9db0c7" }}>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
