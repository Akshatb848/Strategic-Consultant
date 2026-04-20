"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, ShieldCheck, Sparkles, Brain, Target, FlaskConical, Scale } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import ParticleBackground from "@/components/ParticleBackground";

const ROTATING_LINES = [
  "Board-ready strategic decisions in one workspace.",
  "Eight-agent analysis grounded in real strategy frameworks.",
  "Enterprise reports with evidence, provenance, and quality gates.",
];

const FRAMEWORK_PILLS = [
  "PESTLE",
  "SWOT",
  "Porter's Five Forces",
  "Ansoff Matrix",
  "BCG Matrix",
  "McKinsey 7S",
  "Blue Ocean Canvas",
  "Balanced Scorecard",
];

const PIPELINE_STEPS = [
  { agent: "Orchestrator", copy: "Validates the question, classifies the decision type, and sets the execution plan." },
  { agent: "Market Intelligence", copy: "Sizes TAM, growth, segmentation, and demand momentum for the target market." },
  { agent: "Risk Assessment", copy: "Builds the risk register, heat map, and downside exposure profile." },
  { agent: "Competitor Analysis", copy: "Scores rivalry, substitutes, entrants, and competitive posture." },
  { agent: "Geo Intelligence", copy: "Maps political stability, legal exposure, trade barriers, and CAGE distance." },
  { agent: "Financial Reasoning", copy: "Tests projections, capital logic, and portfolio implications." },
  { agent: "Strategic Options", copy: "Evaluates Ansoff paths, Blue Ocean moves, and organisational fit." },
  { agent: "Synthesis", copy: "Generates the decision, action titles, roadmap, and quality-scored brief." },
];

const VALUE_PANELS = [
  {
    title: "Decision First",
    body: "Lead with a single explicit PROCEED, CONDITIONAL PROCEED, or DO NOT PROCEED recommendation backed by confidence, evidence, and rationale.",
  },
  {
    title: "Framework Grounded",
    body: "Every brief is structured through eight management frameworks, exhibit-ready narratives, and so-what callouts for executive consumption.",
  },
  {
    title: "Enterprise Export",
    body: "Download a client-ready report with provenance, citations, implementation roadmap, balanced scorecard, and quality report appendices.",
  },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLineIndex((current) => (current + 1) % ROTATING_LINES.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, []);

  const NEW_CAPABILITIES = [
    { icon: Brain, title: "Semantic Memory", body: "ASIS remembers past analyses and surfaces relevant precedents to inform new strategic decisions." },
    { icon: Target, title: "Web-Grounded Analysis", body: "Live web search grounds every Market Intel and Risk agent output with current data, regulations, and competitive intelligence." },
    { icon: FlaskConical, title: "Dissertation Framework", body: "Generate PhD-level research questions, experiments, and expert validation plans from any strategic analysis." },
    { icon: Scale, title: "Patent Readiness", body: "Prior art search, utility proof, and patent claims drafting for novel mechanisms identified in ASIS outputs." },
  ];

  return (
    <main className="relative min-h-screen bg-[radial-gradient(circle_at_top,rgba(32,77,255,0.22),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(24,185,157,0.18),transparent_30%),linear-gradient(180deg,#030712_0%,#07111f_44%,#09182c_100%)] text-slate-50">
      <ParticleBackground />
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#040913]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#275df2,#17b4e6_60%,#8cf0cc)] text-lg font-black text-white shadow-[0_18px_40px_rgba(23,180,230,0.18)]">
              A
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[0.22em] text-slate-300">ASIS v4.0 GOLD</div>
              <div className="text-xs text-slate-500">Strategic Decision Intelligence System</div>
            </div>
          </div>

          <nav className="flex items-center gap-3 text-sm text-slate-300">
            <Link href="/dashboard" className="hidden rounded-full border border-white/10 px-4 py-2 transition hover:border-white/20 hover:bg-white/5 md:inline-flex">
              Dashboard
            </Link>
            {isAuthenticated ? (
              <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-slate-100">
                Open workspace
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

      <section className="relative z-10 mx-auto grid max-w-7xl gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-24">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100"
          >
            <Sparkles size={14} />
            Enterprise strategic intelligence — v4.0 Gold
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-5xl text-[46px] font-semibold leading-[0.95] tracking-[-0.06em] text-white sm:text-[64px] lg:text-[78px]"
          >
            The operating system for
            <span className="mt-4 block bg-[linear-gradient(90deg,#ffffff,#9ad7ff_45%,#84f1cf)] bg-clip-text text-transparent">
              board-level strategic decisions
            </span>
          </motion.h1>

          <p className="mt-8 max-w-3xl text-lg leading-8 text-slate-300">
            ASIS turns an executive question into a structured recommendation using an eight-agent pipeline, management
            frameworks, decision provenance, real-time collaboration traces, and enterprise-grade report generation.
          </p>

          <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300">
            {ROTATING_LINES[lineIndex]}
          </div>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href={isAuthenticated ? "/dashboard" : "/register"}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              {isAuthenticated ? "Go to dashboard" : "Create workspace"}
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/analysis/new"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 px-6 py-3.5 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/5"
            >
              Start a strategic analysis
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
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Eight-Agent System</div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Question to recommendation</div>
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

          <div className="mt-5 rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-emerald-300/10 p-2 text-emerald-100">
                <ShieldCheck size={16} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Quality gate before delivery</div>
                <div className="mt-1 text-sm leading-6 text-emerald-100/80">
                  Decision prefix validation, framework completeness, citation density, collaboration trace integrity,
                  MECE scoring, and internal consistency checks run before the brief is accepted.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          {VALUE_PANELS.map((panel, idx) => (
            <motion.article
              key={panel.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + idx * 0.1 }}
              className="rounded-[26px] border border-white/8 bg-white/[0.04] p-6 transition hover:border-white/14 hover:shadow-[0_8px_40px_rgba(34,211,238,0.06)]"
            >
              <div className="text-lg font-semibold tracking-[-0.03em] text-white">{panel.title}</div>
              <p className="mt-4 text-sm leading-7 text-slate-400">{panel.body}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* New Capabilities Section */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-24">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-8 text-center"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">New in v4.0 Gold</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Production-ready flagship capabilities</h2>
        </motion.div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {NEW_CAPABILITIES.map(({ icon: Icon, title, body }, idx) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.55 + idx * 0.08 }}
              className="rounded-[26px] border border-cyan-400/10 bg-cyan-400/5 p-6 transition hover:border-cyan-400/20 hover:bg-cyan-400/10"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300">
                <Icon size={18} />
              </div>
              <div className="text-base font-semibold text-white">{title}</div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  );
}
