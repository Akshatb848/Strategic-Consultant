from __future__ import annotations

from datetime import datetime
from time import perf_counter
from uuid import uuid4

from langgraph.graph import END, START, StateGraph
from sqlalchemy.orm import Session

from asis.backend.agents.cove import CoVeAgent
from asis.backend.agents.ethicist import EthicistAgent
from asis.backend.agents.market_intel import MarketIntelAgent
from asis.backend.agents.orchestrator import OrchestratorAgent
from asis.backend.agents.quant import QuantAgent
from asis.backend.agents.red_team import RedTeamAgent
from asis.backend.agents.risk import RiskAgent
from asis.backend.agents.strategist import StrategistAgent
from asis.backend.agents.synthesis import SynthesisAgent
from asis.backend.agents.types import AgentOutput, PipelineState
from asis.backend.config.logging import logger
from asis.backend.db import models
from asis.backend.db import database as db_state
from asis.backend.evaluation.baseline import SingleAgentBaseline
from asis.backend.evaluation.engine import EvaluationEngine
from asis.backend.graph.context import extract_problem_context
from asis.backend.memory.store import memory_store
from asis.backend.tasks.event_bus import event_bus


class EnterpriseWorkflow:
    def __init__(self) -> None:
        self.orchestrator = OrchestratorAgent()
        self.strategist = StrategistAgent()
        self.quant = QuantAgent()
        self.market_intel = MarketIntelAgent()
        self.risk = RiskAgent()
        self.red_team = RedTeamAgent()
        self.ethicist = EthicistAgent()
        self.cove = CoVeAgent()
        self.synthesis = SynthesisAgent()
        self.baseline = SingleAgentBaseline()
        self.evaluation = EvaluationEngine()
        self.graph = self._build_graph().compile()

    def _build_graph(self):
        graph = StateGraph(PipelineState)
        graph.add_node("orchestrator", self._run_orchestrator)
        graph.add_node("strategist", self._run_strategist)
        graph.add_node("quant", self._run_quant)
        graph.add_node("market_intel", self._run_market_intel)
        graph.add_node("risk", self._run_risk)
        graph.add_node("red_team", self._run_red_team)
        graph.add_node("ethicist", self._run_ethicist)
        graph.add_node("cove", self._run_cove)
        graph.add_node("synthesis", self._run_synthesis)

        graph.add_edge(START, "orchestrator")
        graph.add_edge("orchestrator", "strategist")
        graph.add_edge("strategist", "quant")
        graph.add_edge("strategist", "market_intel")
        graph.add_edge(["quant", "market_intel"], "risk")
        graph.add_edge("risk", "red_team")
        graph.add_edge("risk", "ethicist")
        graph.add_edge(["red_team", "ethicist"], "cove")
        graph.add_conditional_edges(
            "cove",
            self._route_after_cove,
            {
                "strategist": "strategist",
                "quant": "quant",
                "market_intel": "market_intel",
                "risk": "risk",
                "red_team": "red_team",
                "ethicist": "ethicist",
                "synthesis": "synthesis",
            },
        )
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
            db.commit()
            initial_state: PipelineState = {
                "analysis_id": analysis_id,
                "user_id": analysis.user_id,
                "query": analysis.query,
                "company_context": analysis.company_context or {},
                "extracted_context": analysis.extracted_context or {},
                "self_correction_count": analysis.self_correction_count or 0,
                "started_at": started,
            }
            final_state = self.graph.invoke(initial_state)
            analysis = db.get(models.Analysis, analysis_id)
            if analysis:
                analysis.status = "completed"
                analysis.current_agent = None
                analysis.duration_seconds = round(perf_counter() - started, 3)
                analysis.completed_at = datetime.utcnow()
                analysis.strategic_brief = final_state.get("synthesis_output")
                analysis.executive_summary = (final_state.get("synthesis_output") or {}).get("executive_summary")
                analysis.board_narrative = (final_state.get("synthesis_output") or {}).get("board_narrative")
                analysis.decision_recommendation = (final_state.get("synthesis_output") or {}).get("recommendation")
                analysis.overall_confidence = final_state.get("overall_confidence")
                analysis.logic_consistency_passed = final_state.get("logic_consistency_passed")
                analysis.self_correction_count = final_state.get("self_correction_count", 0)
                db.commit()
                self._persist_report(db, analysis)
                event_bus.publish(
                    analysis.id,
                    "analysis_complete",
                    {"analysis_id": analysis.id, "strategic_brief": analysis.strategic_brief},
                )
        except Exception as exc:
            logger.error("analysis_workflow_failed", analysis_id=analysis_id, error=str(exc))
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

    def _run_orchestrator(self, state: PipelineState) -> dict:
        extracted = extract_problem_context(state["query"], state.get("company_context") or {})
        with db_state.SessionLocal() as db:
            analysis = db.get(models.Analysis, state["analysis_id"])
            if analysis:
                analysis.extracted_context = extracted
                db.commit()
        result = self.orchestrator.run({**state, "extracted_context": extracted})
        return {"extracted_context": extracted, "orchestrator_output": result.data}

    def _run_visible_agent(self, state: PipelineState, agent, output_key: str, confidence_key: str) -> dict:
        with db_state.SessionLocal() as db:
            analysis = db.get(models.Analysis, state["analysis_id"])
            if analysis:
                analysis.current_agent = agent.agent_id
                analysis.status = "running"
                db.commit()
        event_bus.publish(state["analysis_id"], "agent_start", {"agent": agent.agent_id})
        result = agent.run(state)
        self._save_agent_result(state["analysis_id"], result)
        event_bus.publish(state["analysis_id"], "agent_complete", {"agent": agent.agent_id, "duration_ms": result.duration_ms})
        return {output_key: result.data, confidence_key: result.confidence_score}

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
                if result.agent_id == "cove":
                    analysis.overall_confidence = result.data.get("overall_verification_score")
                    analysis.logic_consistency_passed = result.data.get("logic_consistent")
                if result.agent_id == "synthesis":
                    analysis.strategic_brief = result.data
                    analysis.executive_summary = result.data.get("executive_summary")
                    analysis.board_narrative = result.data.get("board_narrative")
                    analysis.decision_recommendation = result.data.get("recommendation")
                    analysis.overall_confidence = result.data.get("overall_confidence")
            db.commit()

    def _run_strategist(self, state: PipelineState) -> dict:
        return self._run_visible_agent(state, self.strategist, "strategist_output", "strategist_confidence")

    def _run_quant(self, state: PipelineState) -> dict:
        return self._run_visible_agent(state, self.quant, "quant_output", "quant_confidence")

    def _run_market_intel(self, state: PipelineState) -> dict:
        return self._run_visible_agent(state, self.market_intel, "market_intel_output", "market_intel_confidence")

    def _run_risk(self, state: PipelineState) -> dict:
        return self._run_visible_agent(state, self.risk, "risk_output", "risk_confidence")

    def _run_red_team(self, state: PipelineState) -> dict:
        return self._run_visible_agent(state, self.red_team, "red_team_output", "red_team_confidence")

    def _run_ethicist(self, state: PipelineState) -> dict:
        return self._run_visible_agent(state, self.ethicist, "ethicist_output", "ethicist_confidence")

    def _run_cove(self, state: PipelineState) -> dict:
        result = self._run_visible_agent(state, self.cove, "cove_output", "cove_confidence")
        cove_output = result["cove_output"]
        reroute = cove_output.get("route_back_to")
        self_correction_count = state.get("self_correction_count", 0)
        if cove_output.get("recommendation") == "FAIL_ROUTE_BACK" and reroute:
            self_correction_count += 1
        return {
            **result,
            "overall_confidence": cove_output.get("overall_verification_score"),
            "logic_consistency_passed": cove_output.get("logic_consistent", False),
            "reroute_agent": reroute,
            "self_correction_count": self_correction_count,
        }

    def _route_after_cove(self, state: PipelineState) -> str:
        reroute = state.get("reroute_agent")
        if reroute and state.get("self_correction_count", 0) <= 2:
            return reroute
        return "synthesis"

    def _run_synthesis(self, state: PipelineState) -> dict:
        result = self._run_visible_agent(state, self.synthesis, "synthesis_output", "overall_confidence")
        synthesis_output = result["synthesis_output"]
        synthesis_output["overall_confidence"] = state.get("overall_confidence", synthesis_output.get("overall_confidence"))
        return {"synthesis_output": synthesis_output, "overall_confidence": synthesis_output["overall_confidence"]}


workflow = EnterpriseWorkflow()
