"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronRight, Sparkles } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";

const ROTATING_ROLES = [
  "a McKinsey Senior Partner",
  "a Board-Level Strategist",
  "a Chief Risk Officer",
  "a BCG Strategy Director",
  "a Bain & Company Advisor",
];

const FRAMEWORK_PILLS = [
  "McKinsey 7-S",
  "COSO ERM 2017",
  "Porter's Five Forces",
  "NIST CSF 2.0",
  "Balanced Scorecard",
  "Monte Carlo",
  "Minto Pyramid",
  "PESTLE",
];

const PIPELINE_STEPS = [
  { agent: "Strategist", copy: "Frames the board question using MECE decomposition." },
  { agent: "Quant", copy: "Runs scenario economics, Monte Carlo, and capital logic." },
  { agent: "Market Intel", copy: "Builds PESTLE, competition, and demand signals." },
  { agent: "Risk", copy: "Maps the risk register and escalation posture." },
  { agent: "Red Team", copy: "Attempts to invalidate the thesis before the board sees it." },
  { agent: "Ethicist", copy: "Checks ESG, reputation, and stakeholder consequences." },
  { agent: "CoVe", copy: "Verifies logic consistency and confidence adjustments." },
  { agent: "Synthesis", copy: "Assembles the final decision-ready board narrative." },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [roleIndex, setRoleIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRoleIndex((current) => (current + 1) % ROTATING_ROLES.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(32,77,255,0.20),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(24,185,157,0.16),transparent_28%),linear-gradient(180deg,#030712_0%,#07111f_44%,#09182c_100%)] text-slate-50">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#040913]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#275df2,#17b4e6_60%,#8cf0cc)] text-lg font-black text-white shadow-[0_18px_40px_rgba(23,180,230,0.18)]">
              A
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[0.22em] text-slate-300">ASIS</div>
              <div className="text-xs text-slate-500">Autonomous Strategic Intelligence System</div>
            </div>
          </div>

          <nav className="flex items-center gap-3 text-sm text-slate-300">
            <Link href="/dashboard" className="hidden rounded-full border border-white/10 px-4 py-2 transition hover:border-white/20 hover:bg-white/5 md:inline-flex">
              Dashboard
            </Link>
            {isAuthenticated ? (
              <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-slate-100">
                Open Workspace
                <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden rounded-full border border-white/10 px-4 py-2 transition hover:border-white/20 hover:bg-white/5 md:inline-flex">
                  Sign in
                </Link>
                <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-slate-100">
                  Launch ASIS
                  <ArrowRight size={15} />
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pt-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
            <Sparkles size={14} />
            Enterprise strategic intelligence
          </div>

          <h1 className="max-w-4xl text-[46px] font-semibold leading-[0.95] tracking-[-0.06em] text-white sm:text-[64px] lg:text-[78px]">
            The AI That Thinks Like
            <span className="mt-4 block bg-[linear-gradient(90deg,#ffffff,#9ad7ff_45%,#84f1cf)] bg-clip-text text-transparent">
              {ROTATING_ROLES[roleIndex]}
            </span>
          </h1>

          <p className="mt-8 max-w-3xl text-lg leading-8 text-slate-300">
            ASIS turns ambiguous strategic decisions into board-ready recommendations by routing the question through
            specialist agents for strategy, market intelligence, financial reasoning, risk, red-teaming, ethics, and
            verification before a final synthesis is produced.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href={isAuthenticated ? "/dashboard" : "/register"}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              {isAuthenticated ? "Open dashboard" : "Create workspace"}
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 px-6 py-3.5 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/5"
            >
              View product flow
              <ChevronRight size={16} />
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            {FRAMEWORK_PILLS.map((framework) => (
              <span
                key={framework}
                className="rounded-full border border-white/8 bg-white/[0.04] px-4 py-2 text-xs font-medium tracking-[0.06em] text-slate-300"
              >
                {framework}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,22,39,0.96),rgba(10,18,34,0.92))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Multi-Agent Debate</div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Board question to decision</div>
            </div>
            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              8 agents
            </div>
          </div>

          <div className="space-y-3">
            {PIPELINE_STEPS.map((step, index) => (
              <div
                key={step.agent}
                className="flex items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4"
              >
                <div className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[linear-gradient(135deg,#1842c5,#1fb5dc)] text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{step.agent}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-400">{step.copy}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Decision-ready output", "Every analysis returns a clear verdict, confidence score, board narrative, roadmap, and supporting evidence."],
            ["Pressure-tested reasoning", "Red Team and CoVe do not simply polish the answer. They actively try to break it before the board sees it."],
            ["Framework-grounded analysis", "PESTLE, Porter, Monte Carlo, risk registers, and scorecards are built into the operating logic of the workflow."],
          ].map(([title, body]) => (
            <article key={title} className="rounded-[26px] border border-white/8 bg-white/[0.04] p-6">
              <div className="text-lg font-semibold tracking-[-0.03em] text-white">{title}</div>
              <p className="mt-4 text-sm leading-7 text-slate-400">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
