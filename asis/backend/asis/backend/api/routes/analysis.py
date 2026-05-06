from __future__ import annotations

import queue
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from asis.backend.api.dependencies import get_current_user
from asis.backend.api.rate_limit import limiter
from asis.backend.config.logging import logger
from asis.backend.config.settings import get_settings
from asis.backend.db import models
from asis.backend.db.database import get_db
from asis.backend.graph.context import extract_problem_context
from asis.backend.schemas.analysis import AgentLogResponse, AnalysisCreateRequest, AnalysisDetail, AnalysisResponse, AnalysisSummary
from asis.backend.tasks.dispatcher import dispatch_analysis, cancel_analysis
from asis.backend.tasks.event_bus import event_bus

router = APIRouter(prefix="/analysis", tags=["analysis"])


def _analysis_minute_limit() -> str:
    return f"{get_settings().rate_limit_analyses_per_minute}/minute"


def _analysis_day_limit() -> str:
    return f"{get_settings().rate_limit_analyses_per_day}/day"


def _safe_dict(value: object) -> dict:
    return value if isinstance(value, dict) else {}


def _safe_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_text(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    if isinstance(value, dict):
        ordered_keys = (
            "headline",
            "key_argument_1",
            "key_argument_2",
            "key_argument_3",
            "critical_risk",
            "next_step",
        )
        parts = [str(value.get(key)).strip() for key in ordered_keys if value.get(key)]
        return "\n".join(parts) or None
    return str(value).strip() or None


def _coerce_executive_summary(analysis: models.Analysis) -> str | None:
    summary = _safe_text(getattr(analysis, "executive_summary", None))
    if summary:
        return summary
    return _safe_text((getattr(analysis, "strategic_brief", None) or {}).get("executive_summary"))


def _safe_agent_logs(analysis: models.Analysis) -> list[AgentLogResponse]:
    safe_logs: list[AgentLogResponse] = []
    for log in getattr(analysis, "agent_logs", []) or []:
        try:
            safe_logs.append(AgentLogResponse.model_validate(log))
        except Exception as exc:
            logger.warning(
                "agent_log_serialization_skipped",
                analysis_id=getattr(analysis, "id", None),
                agent_log_id=getattr(log, "id", None),
                error=str(exc),
            )
    return safe_logs


def _resolve_user_organisation_id(user: models.User, db: Session) -> str | None:
    organisation_id = getattr(user, "organisation_id", None)
    if not organisation_id:
        return None

    exists = (
        db.query(models.Organisation.id)
        .filter(models.Organisation.id == organisation_id)
        .scalar()
    )
    if exists:
        return organisation_id

    logger.warning(
        "analysis_create_stale_organisation_reference",
        user_id=user.id,
        organisation_id=organisation_id,
    )
    user.organisation_id = None
    return None


def _to_summary(analysis: models.Analysis) -> AnalysisSummary:
    _status = _safe_text(analysis.status) or "queued"
    return AnalysisSummary(
        id=analysis.id,
        query=_safe_text(analysis.query) or "Strategic analysis",
        company_context=_safe_dict(analysis.company_context),
        extracted_context=_safe_dict(analysis.extracted_context),
        status=_status,
        current_agent=_safe_text(analysis.current_agent),
        pipeline_version=_safe_text(analysis.pipeline_version) or "4.0.0",
        used_fallback=bool(getattr(analysis, "used_fallback", False)),
        overall_confidence=_safe_float(analysis.overall_confidence),
        decision_recommendation=None if _status in ("failed", "cancelled") else analysis.decision_recommendation,
        executive_summary=_coerce_executive_summary(analysis),
        error_message=_safe_text(analysis.error_message),
        duration_seconds=_safe_float(analysis.duration_seconds),
        total_cost_usd=_safe_float(analysis.total_cost_usd),
        created_at=analysis.created_at,
        completed_at=analysis.completed_at,
    )


def _to_detail(analysis: models.Analysis) -> AnalysisDetail:
    _status = _safe_text(analysis.status) or "queued"
    return AnalysisDetail(
        id=analysis.id,
        query=_safe_text(analysis.query) or "Strategic analysis",
        company_context=_safe_dict(analysis.company_context),
        extracted_context=_safe_dict(analysis.extracted_context),
        status=_status,
        current_agent=_safe_text(analysis.current_agent),
        pipeline_version=_safe_text(analysis.pipeline_version) or "4.0.0",
        used_fallback=bool(getattr(analysis, "used_fallback", False)),
        overall_confidence=_safe_float(analysis.overall_confidence),
        decision_recommendation=None if _status in ("failed", "cancelled") else analysis.decision_recommendation,
        executive_summary=_coerce_executive_summary(analysis),
        error_message=_safe_text(analysis.error_message),
        duration_seconds=_safe_float(analysis.duration_seconds),
        total_cost_usd=_safe_float(analysis.total_cost_usd),
        created_at=analysis.created_at,
        completed_at=analysis.completed_at,
        strategic_brief=analysis.strategic_brief,
        logic_consistency_passed=analysis.logic_consistency_passed,
        self_correction_count=analysis.self_correction_count,
        agent_logs=_safe_agent_logs(analysis),
        report_id=analysis.report.id if analysis.report else None,
    )


@router.post("", response_model=AnalysisResponse, status_code=201)
@limiter.limit(_analysis_day_limit)
@limiter.limit(_analysis_minute_limit)
def create_analysis(
    request: Request,
    payload_data: dict = Body(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalysisResponse:
    payload = AnalysisCreateRequest.model_validate(payload_data)
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
    company_context = payload.company_context.model_dump(exclude_none=True)
    extracted = extract_problem_context(payload.query, company_context)
    organisation_id = _resolve_user_organisation_id(user, db)
    analysis = models.Analysis(
        id=uuid4().hex,
        user_id=user.id,
        organisation_id=organisation_id,
        query=payload.query,
        company_context=company_context,
        extracted_context=extracted,
        status="queued",
        pipeline_version="4.0.0",
        run_baseline=payload.run_baseline,
    )
    user.analysis_count = int(getattr(user, "analysis_count", 0) or 0) + 1
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    try:
        dispatch_analysis(analysis.id)
    except Exception as exc:
        logger.error(
            "analysis_dispatch_failed",
            analysis_id=analysis.id,
            user_id=user.id,
            error=str(exc),
            exc_info=True,
        )
        analysis.status = "failed"
        analysis.error_message = "ASIS could not start the analysis pipeline. Please try again."
        analysis.completed_at = datetime.utcnow()
        db.commit()
        raise HTTPException(
            status_code=503,
            detail="ASIS could not start the analysis pipeline. Please try again.",
        ) from exc
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
    safe_summaries: list[AnalysisSummary] = []
    skipped = 0
    for analysis in analyses:
        try:
            safe_summaries.append(_to_summary(analysis))
        except Exception as exc:
            skipped += 1
            logger.warning(
                "analysis_summary_serialization_skipped",
                analysis_id=getattr(analysis, "id", None),
                user_id=user.id,
                error=str(exc),
            )
    return {"analyses": safe_summaries, "total": max(total - skipped, 0)}


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
    try:
        return AnalysisResponse(analysis=_to_detail(analysis))
    except Exception as exc:
        logger.error(
            "analysis_detail_serialization_failed",
            analysis_id=analysis_id,
            user_id=user.id,
            error=str(exc),
            exc_info=True,
        )
        raise HTTPException(status_code=422, detail="ANALYSIS_RECORD_INVALID") from exc


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
                                                   