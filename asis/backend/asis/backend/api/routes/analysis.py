from __future__ import annotations

import queue
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from asis.backend.api.dependencies import get_current_user
from asis.backend.api.rate_limit import limiter
from asis.backend.config.settings import get_settings
from asis.backend.db import models
from asis.backend.db.database import get_db
from asis.backend.graph.context import extract_problem_context
from asis.backend.schemas.analysis import AnalysisCreateRequest, AnalysisDetail, AnalysisResponse, AnalysisSummary
from asis.backend.tasks.dispatcher import dispatch_analysis, cancel_analysis
from asis.backend.tasks.event_bus import event_bus

router = APIRouter(prefix="/analysis", tags=["analysis"])


def _analysis_minute_limit() -> str:
    return f"{get_settings().rate_limit_analyses_per_minute}/minute"


def _analysis_day_limit() -> str:
    return f"{get_settings().rate_limit_analyses_per_day}/day"


def _to_summary(analysis: models.Analysis) -> AnalysisSummary:
    return AnalysisSummary(
        id=analysis.id,
        query=analysis.query,
        company_context=analysis.company_context or {},
        extracted_context=analysis.extracted_context or {},
        status=analysis.status,
        current_agent=analysis.current_agent,
        pipeline_version=analysis.pipeline_version,
        overall_confidence=analysis.overall_confidence,
        decision_recommendation=analysis.decision_recommendation,
        executive_summary=analysis.executive_summary,
        error_message=analysis.error_message,
        duration_seconds=analysis.duration_seconds,
        total_cost_usd=analysis.total_cost_usd,
        created_at=analysis.created_at,
        completed_at=analysis.completed_at,
    )


def _to_detail(analysis: models.Analysis) -> AnalysisDetail:
    return AnalysisDetail(
        id=analysis.id,
        query=analysis.query,
        company_context=analysis.company_context or {},
        extracted_context=analysis.extracted_context or {},
        status=analysis.status,
        current_agent=analysis.current_agent,
        pipeline_version=analysis.pipeline_version,
        overall_confidence=analysis.overall_confidence,
        decision_recommendation=analysis.decision_recommendation,
        executive_summary=analysis.executive_summary,
        error_message=analysis.error_message,
        duration_seconds=analysis.duration_seconds,
        created_at=analysis.created_at,
        completed_at=analysis.completed_at,
        strategic_brief=analysis.strategic_brief,
        logic_consistency_passed=analysis.logic_consistency_passed,
        self_correction_count=analysis.self_correction_count,
        agent_logs=[log for log in analysis.agent_logs],
        report_id=analysis.report.id if analysis.report else None,
    )


@router.post("", response_model=AnalysisResponse, status_code=201)
@limiter.limit(_analysis_day_limit)
@limiter.limit(_analysis_minute_limit)
def create_analysis(
    request: Request,
    payload: AnalysisCreateRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalysisResponse:
    # Per-user daily cap (in addition to IP rate limit)
    settings = get_settings()
    from datetime import date
    today_start = datetime.combine(date.today(), datetime.min.time())
    user_today_count = (
        db.query(models.Analysis)
        .filter(
            models.Analysis.user_id == user.id,
            models.Analysis.created_at >= today_start,
        )
        .count()
    )
    if user_today_count >= settings.rate_limit_analyses_per_day:
        raise HTTPException(
            status_code=429,
            detail=f"Daily analysis limit of {settings.rate_limit_analyses_per_day} reached. Resets at midnight UTC.",
        )
    extracted = extract_problem_context(payload.query, payload.company_context.model_dump())
    analysis = models.Analysis(
        id=uuid4().hex,
        user_id=user.id,
        organisation_id=user.organisation_id,
        query=payload.query,
        company_context=payload.company_context.model_dump(),
        extracted_context=extracted,
        status="queued",
        pipeline_version="4.0.0",
        run_baseline=payload.run_baseline,
    )
    user.analysis_count += 1
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    dispatch_analysis(analysis.id)
    return AnalysisResponse(analysis=_to_summary(analysis))


@router.get("", response_model=dict)
def list_analyses(
    status: str | None = None,
    search: str | None = None,
    limit: int = 20,
    offset: int = 0,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(models.Analysis).filter(models.Analysis.user_id == user.id)
    if status:
        query = query.filter(models.Analysis.status == status)
    if search:
        query = query.filter(models.Analysis.query.ilike(f"%{search}%"))
    total = query.count()
    analyses = query.order_by(models.Analysis.created_at.desc()).offset(offset).limit(limit).all()
    return {"analyses": [_to_summary(analysis) for analysis in analyses], "total": total}


@router.get("/{analysis_id}", response_model=AnalysisResponse)
def get_analysis(
    analysis_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalysisResponse:
    analysis = (
        db.query(models.Analysis)
        .filter(models.Analysis.id == analysis_id, models.Analysis.user_id == user.id)
        .one_or_none()
    )
    if not analysis:
        raise HTTPException(status_code=404, detail="ANALYSIS_NOT_FOUND")
    return AnalysisResponse(analysis=_to_detail(analysis))


@router.get("/{analysis_id}/events")
def stream_analysis_events(
    analysis_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    analysis = (
        db.query(models.Analysis)
        .filter(models.Analysis.id == analysis_id, models.Analysis.user_id == user.id)
        .one_or_none()
    )
    if not analysis:
        raise HTTPException(status_code=404, detail="ANALYSIS_NOT_FOUND")

    historical_logs = [
        {"agent_id": log.agent_id, "duration_ms": log.duration_ms or 0, "created_at": log.created_at}
        for log in sorted(analysis.agent_logs, key=lambda item: item.created_at)
    ]
    historical_events = sorted(
        analysis.analysis_events,
        key=lambda item: (item.timestamp_ms, item.created_at),
    )
    historical_brief = analysis.strategic_brief
    historical_status = analysis.status
    historical_error = analysis.error_message

    def event_stream():
        if historical_events:
            for event in historical_events:
                yield event_bus.format_message(event.event_name, event.payload)
            if historical_status == "completed" and any(event.event_name == "analysis_complete" for event in historical_events):
                return
            if historical_status == "failed" and any(event.event_name == "analysis_failed" for event in historical_events):
                return
        else:
            for log in historical_logs:
                yield event_bus.format_message("agent_start", {"agent": log["agent_id"]})
                yield event_bus.format_message("agent_complete", {"agent": log["agent_id"], "duration_ms": log["duration_ms"]})
            if historical_status == "completed" and historical_brief:
                for event in historical_brief.get("agent_collaboration_trace", []):
                    yield event_bus.format_message(
                        "agent_collaboration",
                        {
                            "source": event.get("source_agent"),
                            "target": event.get("target_agent"),
                            "field": event.get("data_field"),
                            "summary": event.get("contribution_summary"),
                            "timestamp_ms": event.get("timestamp_ms"),
                        },
                    )
                for framework, output in (historical_brief.get("framework_outputs") or {}).items():
                    yield event_bus.format_message(
                        "framework_complete",
                        {
                            "framework": framework,
                            "agent": output.get("agent_author"),
                            "confidence": output.get("confidence_score"),
                        },
                    )
                if historical_brief.get("decision_statement"):
                    yield event_bus.format_message(
                        "decision_reached",
                        {
                            "statement": historical_brief.get("decision_statement"),
                            "confidence": historical_brief.get("decision_confidence"),
                        },
                    )
                yield event_bus.format_message(
                    "analysis_complete",
                    {"analysis_id": analysis.id, "strategic_brief": historical_brief},
                )
                return
            if historical_status == "failed":
                yield event_bus.format_message(
                    "analysis_failed",
                    {"analysis_id": analysis.id, "message": historical_error or "Analysis failed."},
                )
                return
        subscriber = event_bus.subscribe(analysis_id)
        try:
            while True:
                try:
                    payload = subscriber.get(timeout=10)
                    yield event_bus.format_message(payload["event"], payload["data"])
                    if payload["event"] == "analysis_complete":
                        return
                except queue.Empty:
                    yield ": ping\n\n"
        finally:
            event_bus.unsubscribe(analysis_id, subscriber)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.patch("/{analysis_id}/cancel", status_code=200)
def cancel_analysis_endpoint(
    analysis_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Gracefully cancel a queued or running analysis.

    Sets status to 'cancelled' immediately so no further pipeline work is
    started. Running Celery tasks are sent a revoke signal; in-process
    ThreadPoolExecutor runs check the DB status before each agent step.
    """
    analysis = (
        db.query(models.Analysis)
        .filter(models.Analysis.id == analysis_id, models.Analysis.user_id == user.id)
        .one_or_none()
    )
    if not analysis:
        raise HTTPException(status_code=404, detail="ANALYSIS_NOT_FOUND")
    if analysis.status not in ("queued", "running"):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot cancel analysis in status '{analysis.status}'.",
        )
    analysis.status = "cancelled"
    analysis.completed_at = datetime.utcnow()
    analysis.error_message = "Cancelled by user."
    db.commit()
    cancel_analysis(analysis_id)
    event_bus.publish(
        analysis_id,
        "analysis_failed",
        {"analysis_id": analysis_id, "message": "Analysis cancelled by user."},
    )
    return {"message": "Analysis cancelled.", "analysis_id": analysis_id}
