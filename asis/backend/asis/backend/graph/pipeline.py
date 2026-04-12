from __future__ import annotations

import asyncio
from datetime import datetime
from time import perf_counter
from uuid import uuid4

from langgraph.graph import END, START, StateGraph
from sqlalchemy.orm import Session

from asis.backend.agents.competitor_analysis import CompetitorAnalysisAgent
from asis.backend.agents.financial_reasoning import FinancialReasoningAgent
from asis.backend.agents.geo_intel import GeoIntelAgent
from asis.backend.agents.market_intel import MarketIntelAgent
from asis.backend.agents.orchestrator import OrchestratorAgent
from asis.backend.agents.risk_assessment import RiskAssessmentAgent
from asis.backend.agents.strategic_options import StrategicOptionsAgent
from asis.backend.agents.synthesis_v4 import V4SynthesisAgent
from asis.backend.agents.types import AgentOutput, now_ms
from asis.backend.config.logging import logger
from asis.backend.db import database as db_state
from asis.backend.db import models
from asis.backend.evaluation.baseline import SingleAgentBaseline
from asis.backend.evaluation.engine import EvaluationEngine
from asis.backend.graph.context import extract_problem_context
from asis.backend.graph.state import V4PipelineState
from asis.backend.memory.store import memory_store
from asis.backend.quality.gate import QualityGate
from asis.backend.schemas.v4 import StrategicBriefV4
from asis.backend.tasks.analysis_events import publish_analysis_event


class V4EnterpriseWorkflow:
    def __init__(self) -> None:
        self.orchestrator = OrchestratorAgent()
        self.market_intel = MarketIntelAgent()
        self.risk_assessment = RiskAssessmentAgent()
        self.competitor_analysis = CompetitorAnalysisAgent()
        self.geo_intel = GeoIntelAgent()
        self.financial_reasoning = FinancialReasoningAgent()
        self.strategic_options = StrategicOptionsAgent()
        self.synthesis = V4SynthesisAgent()
        self.quality_gate = QualityGate()
        self.baseline = SingleAgentBaseline()
        self.evaluation = EvaluationEngine()
        self.graph = self._build_graph().compile()

    def _build_graph(self):
        graph = StateGraph(V4PipelineState)
        graph.add_node("orchestrator", self._run_orchestrator)
        graph.add_node("market_intel", self._run_market_intel)
        graph.add_node("risk_assessment", self._run_risk_assessment)
        graph.add_node("competitor_analysis", self._run_competitor_analysis)
        graph.add_node("geo_intel", self._run_geo_intel)
        graph.add_node("financial_reasoning", self._run_financial_reasoning)
        graph.add_node("strategic_options", self._run_strategic_options)
        graph.add_node("synthesis", self._run_synthesis)

        graph.add_edge(START, "orchestrator")
        graph.add_edge("orchestrator", "market_intel")
        graph.add_edge("orchestrator", "risk_assessment")
        graph.add_edge("orchestrator", "competitor_analysis")
        graph.add_edge("orchestrator", "geo_intel")
        graph.add_edge(
            ["market_intel", "risk_assessment", "competitor_analysis", "geo_intel"],
            "financial_reasoning",
        )
        graph.add_edge("financial_reasoning", "strategic_options")
        graph.add_edge("strategic_options", "synthesis")
        graph.add_edge("synthesis", END)
        return graph

    def run(self, analysis_id: str) -> None:
        db = db_state.SessionLocal()
        started = perf_counter()
        try:
            analysis = db.get(models.Analysis, analysis_id)
            if not analysis:
                return
            analysis.status = "running"
            analysis.pipeline_version = "4.0.0"
            db.commit()
            initial_state: V4PipelineState = {
                "analysis_id": analysis_id,
                "user_id": analysis.user_id,
                "query": analysis.query,
                "company_context": analysis.company_context or {},
                "extracted_context": analysis.extracted_context or {},
                "framework_outputs": {},
                "framework_citations": {},
                "agent_collaboration_trace": [],
                "decision_statement": "",
                "decision_confidence": 0.0,
                "decision_rationale": "",
                "decision_evidence": [],
                "mece_score": 0.0,
                "internal_consistency_score": 0.0,
                "quality_retry_count": 0,
                "quality_failures": [],
                "section_action_titles": {},
                "so_what_callouts": {},
                "exhibit_registry": [],
                "started_at": started,
            }
            final_state = self.graph.invoke(initial_state)
            analysis = db.get(models.Analysis, analysis_id)
            if analysis:
                synthesis_output = StrategicBriefV4.model_validate(final_state.get("synthesis_output") or {}).model_dump(mode="json")
                analysis.status = "completed"
                analysis.current_agent = None
                analysis.duration_seconds = round(perf_counter() - started, 3)
                analysis.completed_at = datetime.utcnow()
                analysis.strategic_brief = synthesis_output
                analysis.executive_summary = self._executive_summary_text(synthesis_output)
                analysis.board_narrative = synthesis_output.get("board_narrative")
                analysis.decision_recommendation = synthesis_output.get("recommendation")
                analysis.overall_confidence = synthesis_output.get("overall_confidence")
                analysis.logic_consistency_passed = (synthesis_output.get("internal_consistency_score") or 0) >= 0.7
                db.commit()
                self._persist_report(db, analysis)
                publish_analysis_event(
                    analysis.id,
                    "analysis_complete",
                    {"analysis_id": analysis.id, "strategic_brief": synthesis_output},
                )
        except Exception as exc:
            logger.error("v4_analysis_workflow_failed", analysis_id=analysis_id, error=str(exc))
            analysis = db.get(models.Analysis, analysis_id)
            if analysis:
                analysis.status = "failed"
                analysis.error_message = str(exc)
                db.commit()
        finally:
            db.close()

    def _persist_report(self, db: Session, analysis: models.Analysis) -> None:
        if not analysis.strategic_brief:
            return
        report = analysis.report
        if not report:
            report = models.Report(
                id=uuid4().hex,
                analysis_id=analysis.id,
                user_id=analysis.user_id,
                strategic_brief=analysis.strategic_brief,
                pdf_status="ready",
                pdf_progress=0,
            )
            db.add(report)
        else:
            report.strategic_brief = analysis.strategic_brief
            report.pdf_status = "ready"
            report.pdf_progress = 0
            report.pdf_error = None
        if analysis.run_baseline:
            baseline_brief = self.baseline.build_brief(analysis.query, analysis.extracted_context or analysis.company_context or {})
            report.evaluation = self.evaluation.score(analysis.strategic_brief, baseline_brief)
        db.commit()
        try:
            memory_store.remember_analysis(
                db,
                analysis.user_id,
                analysis.id,
                analysis.query,
                analysis.executive_summary or "Strategic analysis completed.",
            )
        except Exception as exc:
            logger.warning("analysis_memory_persist_failed", analysis_id=analysis.id, error=str(exc))

    def _run_orchestrator(self, state: V4PipelineState) -> dict:
        extracted = extract_problem_context(state["query"], state.get("company_context") or {})
        with db_state.SessionLocal() as db:
            analysis = db.get(models.Analysis, state["analysis_id"])
            if analysis:
                analysis.extracted_context = extracted
                db.commit()
        publish_analysis_event(state["analysis_id"], "agent_start", {"agent": self.orchestrator.agent_id, "timestamp_ms": now_ms()})
        result = self.orchestrator.run({**state, "extracted_context": extracted})
        self._save_agent_result(state["analysis_id"], result)
        publish_analysis_event(
            state["analysis_id"],
            "agent_complete",
            {"agent": self.orchestrator.agent_id, "duration_ms": result.duration_ms, "timestamp_ms": now_ms()},
        )
        publish_analysis_event(
            state["analysis_id"],
            "orchestrator_complete",
            {
                "section_action_titles": result.data.get("section_action_titles") or {},
                "query_type": result.data.get("query_type"),
                "timestamp_ms": now_ms(),
            },
        )
        return {
            "extracted_context": extracted,
            "orchestrator_output": result.data,
            "section_action_titles": result.data.get("section_action_titles") or {},
        }

    @staticmethod
    def _normalize_confidence(value: float | int | None) -> float:
        if value is None:
            return 0.0
        numeric = float(value)
        if numeric > 1:
            numeric /= 100
        return round(max(0.0, min(1.0, numeric)), 3)

    def _run_market_intel(self, state: V4PipelineState) -> dict:
        dependencies = [
            ("orchestrator", "market_intel", "extracted_context", "Structured company context framed market attractiveness and demand lenses."),
        ]
        return self._run_visible_agent(
            state,
            self.market_intel,
            "market_intel_output",
            "market_intel_confidence",
            dependencies,
        )

    def _run_risk_assessment(self, state: V4PipelineState) -> dict:
        dependencies = [
            ("orchestrator", "risk_assessment", "extracted_context", "Problem framing anchored the risk taxonomy and exposure priorities."),
        ]
        return self._run_visible_agent(
            state,
            self.risk_assessment,
            "risk_assessment_output",
            "risk_assessment_confidence",
            dependencies,
        )

    def _run_competitor_analysis(self, state: V4PipelineState) -> dict:
        dependencies = [
            ("orchestrator", "competitor_analysis", "extracted_context", "Context established the target market, sector, and comparison set."),
        ]
        return self._run_visible_agent(
            state,
            self.competitor_analysis,
            "competitor_analysis_output",
            "competitor_analysis_confidence",
            dependencies,
        )

    def _run_geo_intel(self, state: V4PipelineState) -> dict:
        dependencies = [
            ("orchestrator", "geo_intel", "extracted_context", "Geography and decision framing guided geopolitical and regulatory scanning."),
        ]
        return self._run_visible_agent(
            state,
            self.geo_intel,
            "geo_intel_output",
            "geo_intel_confidence",
            dependencies,
        )

    def _run_financial_reasoning(self, state: V4PipelineState) -> dict:
        dependencies = [
            ("market_intel", "financial_reasoning", "market_intel_output", "Demand sizing shaped revenue pacing and capital assumptions."),
            ("risk_assessment", "financial_reasoning", "risk_assessment_output", "Risk gating adjusted downside and sequencing assumptions."),
            ("competitor_analysis", "financial_reasoning", "competitor_analysis_output", "Rivalry and barrier data informed share-capture expectations."),
            ("geo_intel", "financial_reasoning", "geo_intel_output", "Geopolitical friction informed timing and scenario discounting."),
        ]
        return self._run_visible_agent(
            state,
            self.financial_reasoning,
            "financial_reasoning_output",
            "financial_reasoning_confidence",
            dependencies,
        )

    def _run_strategic_options(self, state: V4PipelineState) -> dict:
        dependencies = [
            ("market_intel", "strategic_options", "market_intel_output", "Market trends narrowed the viable growth paths."),
            ("risk_assessment", "strategic_options", "risk_assessment_output", "Risk concentrations constrained option design."),
            ("competitor_analysis", "strategic_options", "competitor_analysis_output", "Competitive posture shaped the differentiation thesis."),
            ("geo_intel", "strategic_options", "geo_intel_output", "Administrative distance set the entry conditions."),
            ("financial_reasoning", "strategic_options", "financial_reasoning_output", "Capital efficiency and BCG logic scored the options."),
        ]
        return self._run_visible_agent(
            state,
            self.strategic_options,
            "strategic_options_output",
            "strategic_options_confidence",
            dependencies,
        )

    def _run_synthesis(self, state: V4PipelineState) -> dict:
        dependencies = [
            ("market_intel", "synthesis", "market_intel_output", "Market evidence anchored the external demand narrative."),
            ("risk_assessment", "synthesis", "risk_assessment_output", "Risk register evidence framed downside and contingencies."),
            ("competitor_analysis", "synthesis", "competitor_analysis_output", "Competitive evidence informed threat and positioning logic."),
            ("geo_intel", "synthesis", "geo_intel_output", "Geopolitical evidence informed legal and timing conditions."),
            ("financial_reasoning", "synthesis", "financial_reasoning_output", "Financial evidence validated capital discipline and BCG positioning."),
            ("strategic_options", "synthesis", "strategic_options_output", "Option scoring and framework fit guided the final recommendation."),
        ]
        active_state = dict(state)
        attempts = int(state.get("quality_retry_count") or 0)
        quality_report_payload: dict | None = None

        while True:
            result = self._run_visible_agent(
                active_state,
                self.synthesis,
                "synthesis_output",
                "overall_confidence",
                dependencies,
            )
            brief = StrategicBriefV4.model_validate(result["synthesis_output"])
            quality_report = asyncio.run(self.quality_gate.validate(brief, retry_count=attempts))
            quality_report_payload = quality_report.model_dump(mode="json")
            synthesis_output = brief.model_dump(mode="json")
            synthesis_output["quality_report"] = quality_report_payload
            synthesis_output["mece_score"] = quality_report.mece_score
            synthesis_output["internal_consistency_score"] = quality_report.internal_consistency_score
            synthesis_output["decision_confidence"] = self._normalize_confidence(synthesis_output.get("decision_confidence"))
            synthesis_output["overall_confidence"] = self._normalize_confidence(synthesis_output.get("overall_confidence"))

            if not self.quality_gate.has_block_failures(quality_report) or attempts >= 2:
                break

            attempts += 1
            active_state = {
                **state,
                "quality_retry_count": attempts,
                "quality_failures": [
                    check.notes or check.id
                    for check in quality_report.checks
                    if check.level == "BLOCK" and not check.passed
                ],
            }

        publish_analysis_event(
            state["analysis_id"],
            "quality_complete",
            {
                "overall_grade": quality_report_payload.get("overall_grade") if quality_report_payload else "FAIL",
                "quality_flags": quality_report_payload.get("quality_flags", []) if quality_report_payload else [],
                "checks": quality_report_payload.get("checks", []) if quality_report_payload else [],
                "mece_score": synthesis_output.get("mece_score", 0.0),
                "internal_consistency_score": synthesis_output.get("internal_consistency_score", 0.0),
                "timestamp_ms": now_ms(),
            },
        )
        publish_analysis_event(
            state["analysis_id"],
            "decision_reached",
            {
                "statement": synthesis_output.get("decision_statement"),
                "confidence": synthesis_output.get("decision_confidence"),
                "timestamp_ms": now_ms(),
            },
        )
        return {
            **result,
            "synthesis_output": synthesis_output,
            "decision_statement": synthesis_output.get("decision_statement", ""),
            "decision_confidence": synthesis_output.get("decision_confidence", 0.0),
            "decision_rationale": synthesis_output.get("decision_rationale", ""),
            "decision_evidence": synthesis_output.get("decision_evidence", []),
            "section_action_titles": synthesis_output.get("section_action_titles", {}),
            "so_what_callouts": synthesis_output.get("so_what_callouts", {}),
            "exhibit_registry": synthesis_output.get("exhibit_registry", []),
            "quality_report": quality_report_payload or {},
            "quality_retry_count": attempts,
            "mece_score": synthesis_output.get("mece_score", 0.0),
            "internal_consistency_score": synthesis_output.get("internal_consistency_score", 0.0),
        }

    def _run_visible_agent(
        self,
        state: V4PipelineState,
        agent,
        output_key: str,
        confidence_key: str,
        dependencies: list[tuple[str, str, str, str]],
    ) -> dict:
        with db_state.SessionLocal() as db:
            analysis = db.get(models.Analysis, state["analysis_id"])
            if analysis:
                analysis.current_agent = agent.agent_id
                analysis.status = "running"
                db.commit()

        collaboration_trace: list[dict] = []
        for source, target, field, summary in dependencies:
            event = {
                "source_agent": source,
                "target_agent": target,
                "data_field": field,
                "timestamp_ms": now_ms(),
                "contribution_summary": summary,
            }
            collaboration_trace.append(event)
            publish_analysis_event(
                state["analysis_id"],
                "agent_collaboration",
                {
                    "source": source,
                    "target": target,
                    "field": field,
                    "summary": summary,
                    "timestamp_ms": event["timestamp_ms"],
                },
            )

        publish_analysis_event(state["analysis_id"], "agent_start", {"agent": agent.agent_id, "timestamp_ms": now_ms()})
        result = agent.run(state)
        self._save_agent_result(state["analysis_id"], result)
        publish_analysis_event(
            state["analysis_id"],
            "agent_complete",
            {"agent": agent.agent_id, "duration_ms": result.duration_ms, "timestamp_ms": now_ms()},
        )

        framework_outputs = result.data.get("framework_outputs") or {}
        framework_citations: dict[str, list[dict]] = {}
        for framework_name, framework_output in (result.data.get("framework_outputs") or {}).items():
            framework_citations[framework_name] = framework_output.get("citations") or []
            publish_analysis_event(
                state["analysis_id"],
                "framework_complete",
                {
                    "framework": framework_name,
                    "agent": agent.agent_id,
                    "confidence": framework_output.get("confidence_score"),
                    "timestamp_ms": now_ms(),
                },
            )

        return {
            output_key: result.data,
            confidence_key: self._normalize_confidence(result.confidence_score),
            "framework_outputs": framework_outputs,
            "framework_citations": framework_citations,
            "agent_collaboration_trace": collaboration_trace,
        }

    def _save_agent_result(self, analysis_id: str, result: AgentOutput) -> None:
        with db_state.SessionLocal() as db:
            log = models.AgentLog(
                id=uuid4().hex,
                analysis_id=analysis_id,
                agent_id=result.agent_id,
                agent_name=result.agent_name,
                event_type="agent_complete",
                status=result.status,
                confidence_score=result.confidence_score,
                model_used=result.model_used,
                tools_called=result.tools_called,
                langfuse_trace_id=result.langfuse_trace_id,
                attempt_number=result.attempt_number,
                self_corrected=result.self_corrected,
                correction_reason=result.correction_reason,
                duration_ms=result.duration_ms,
                token_usage=result.token_usage,
                citations=result.citations,
                parsed_output=result.data,
            )
            db.add(log)
            analysis = db.get(models.Analysis, analysis_id)
            if analysis:
                analysis.current_agent = result.agent_id
                if result.agent_id == "synthesis":
                    analysis.strategic_brief = result.data
                    analysis.executive_summary = self._executive_summary_text(result.data)
                    analysis.board_narrative = result.data.get("board_narrative")
                    analysis.decision_recommendation = result.data.get("recommendation")
                    analysis.overall_confidence = result.data.get("overall_confidence")
            db.commit()

    @staticmethod
    def _executive_summary_text(brief: dict) -> str | None:
        summary = brief.get("executive_summary")
        if isinstance(summary, dict):
            parts = [
                summary.get("headline"),
                summary.get("key_argument_1"),
                summary.get("key_argument_2"),
                summary.get("key_argument_3"),
                summary.get("critical_risk"),
                summary.get("next_step"),
            ]
            return "\n".join(str(part) for part in parts if part)
        if isinstance(summary, str):
            return summary
        return None


v4_workflow = V4EnterpriseWorkflow()
