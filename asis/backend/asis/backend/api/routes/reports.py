from __future__ import annotations

from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from asis.backend.api.dependencies import get_current_user
from asis.backend.config.settings import get_settings
from asis.backend.db import models
from asis.backend.db.database import get_db
from asis.backend.schemas.reports import EvaluationResponse, ReportResponse
from asis.backend.schemas.v4 import (
    CollaborationTraceResponse,
    DecisionResponse,
    FrameworkOutputsResponse,
    PdfStatusResponse,
    StrategicBriefV4,
)

router = APIRouter(prefix="/reports", tags=["reports"])


def _report_for_user(report_id: str, user_id: str, db: Session) -> models.Report | None:
    return db.query(models.Report).filter(models.Report.id == report_id, models.Report.user_id == user_id).one_or_none()


def _report_for_analysis(analysis_id: str, user_id: str, db: Session) -> models.Report | None:
    return (
        db.query(models.Report)
        .join(models.Analysis, models.Analysis.id == models.Report.analysis_id)
        .filter(models.Analysis.id == analysis_id, models.Report.user_id == user_id)
        .one_or_none()
    )


def _brief_or_422(report: models.Report) -> dict:
    brief = report.strategic_brief or {}
    if not isinstance(brief, dict) or "framework_outputs" not in brief or "decision_statement" not in brief:
        raise HTTPException(status_code=422, detail="REPORT_NOT_V4")
    try:
        return StrategicBriefV4.model_validate(brief).model_dump(mode="json")
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"REPORT_NOT_V4: {exc}") from exc


def _supporting_frameworks(brief: dict) -> list[str]:
    framework_outputs = brief.get("framework_outputs") or {}
    ordered = sorted(
        framework_outputs.items(),
        key=lambda item: float(item[1].get("confidence_score", 0)),
        reverse=True,
    )
    return [name for name, _ in ordered[:3]] or list(framework_outputs.keys())[:3]


def _langfuse_appendix(analysis: models.Analysis) -> dict:
    settings = get_settings()
    logs = sorted(analysis.agent_logs, key=lambda item: item.created_at)
    first_trace = next((log.langfuse_trace_id for log in logs if log.langfuse_trace_id), None)
    trace_url = None
    if first_trace:
        base = settings.langfuse_trace_base_url or settings.langfuse_host
        if base:
            trace_url = f"{base.rstrip('/')}/trace/{first_trace}"
    return {
        "trace_id": first_trace,
        "trace_url": trace_url,
        "agent_execution_log": [
            {
                "agent": log.agent_name,
                "model_used": log.model_used,
                "tokens_in": (log.token_usage or {}).get("prompt_tokens"),
                "tokens_out": (log.token_usage or {}).get("completion_tokens"),
                "latency_ms": log.duration_ms,
                "tools_called": log.tools_called or [],
            }
            for log in logs
        ],
    }


@router.get("", response_model=dict)
def list_reports(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    reports = db.query(models.Report).filter(models.Report.user_id == user.id).order_by(models.Report.created_at.desc()).all()
    return {"reports": [ReportResponse.model_validate(report) for report in reports]}


@router.get("/{analysis_id}/frameworks", response_model=FrameworkOutputsResponse)
def get_framework_outputs(
    analysis_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FrameworkOutputsResponse:
    report = _report_for_analysis(analysis_id, user.id, db)
    if not report:
        raise HTTPException(status_code=404, detail="REPORT_NOT_FOUND")
    brief = _brief_or_422(report)
    return FrameworkOutputsResponse(framework_outputs=brief.get("framework_outputs") or {})


@router.get("/{analysis_id}/collaboration", response_model=CollaborationTraceResponse)
def get_collaboration_trace(
    analysis_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CollaborationTraceResponse:
    report = _report_for_analysis(analysis_id, user.id, db)
    if not report:
        raise HTTPException(status_code=404, detail="REPORT_NOT_FOUND")
    brief = _brief_or_422(report)
    return CollaborationTraceResponse(agent_collaboration_trace=brief.get("agent_collaboration_trace") or [])


@router.get("/{analysis_id}/decision", response_model=DecisionResponse)
def get_decision(
    analysis_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DecisionResponse:
    report = _report_for_analysis(analysis_id, user.id, db)
    if not report:
        raise HTTPException(status_code=404, detail="REPORT_NOT_FOUND")
    brief = _brief_or_422(report)
    return DecisionResponse(
        decision_statement=brief.get("decision_statement") or "",
        decision_confidence=brief.get("decision_confidence") or 0,
        decision_rationale=brief.get("decision_rationale") or "",
        supporting_frameworks=_supporting_frameworks(brief),
    )


@router.post("/{analysis_id}/pdf")
def generate_pdf(
    analysis_id: str,
    request: Request,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = _report_for_analysis(analysis_id, user.id, db)
    if not report:
        raise HTTPException(status_code=404, detail="REPORT_NOT_FOUND")
    brief = _brief_or_422(report)
    report.pdf_status = "generating"
    report.pdf_progress = 15
    report.pdf_error = None
    db.commit()

    settings = get_settings()
    appendix = _langfuse_appendix(report.analysis)
    try:
        response = httpx.post(
            f"{settings.frontend_internal_url.rstrip('/')}/api/pdf/{analysis_id}",
            headers={
                "Authorization": request.headers.get("authorization", ""),
                "Content-Type": "application/json",
            },
            json={
                "analysis_id": analysis_id,
                "brief": brief,
                "appendix": appendix,
                "pdf_max_pages": settings.pdf_max_pages,
                "report_company_logo_url": settings.report_company_logo_url,
            },
            timeout=180.0,
        )
    except httpx.HTTPError as exc:
        report.pdf_status = "error"
        report.pdf_progress = 100
        report.pdf_error = str(exc)
        db.commit()
        raise HTTPException(status_code=503, detail="PDF_SERVICE_UNAVAILABLE") from exc

    if response.status_code != 200:
        report.pdf_status = "error"
        report.pdf_progress = 100
        report.pdf_error = response.text[:500]
        db.commit()
        raise HTTPException(status_code=503, detail="PDF_SERVICE_UNAVAILABLE")

    report.pdf_status = "ready"
    report.pdf_progress = 100
    report.pdf_generated_at = datetime.utcnow()
    report.pdf_error = None
    report.pdf_url = f"/api/v1/reports/{analysis_id}/pdf"
    db.commit()
    filename = response.headers.get(
        "Content-Disposition",
        f'attachment; filename="ASIS_{(brief.get("report_metadata") or {}).get("company_name", "report")}_{datetime.utcnow().date()}.pdf"',
    )
    return StreamingResponse(
        iter([response.content]),
        media_type="application/pdf",
        headers={"Content-Disposition": filename},
    )


@router.get("/{analysis_id}/pdf/status", response_model=PdfStatusResponse)
def get_pdf_status(
    analysis_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PdfStatusResponse:
    report = _report_for_analysis(analysis_id, user.id, db)
    if not report:
        raise HTTPException(status_code=404, detail="REPORT_NOT_FOUND")
    return PdfStatusResponse(
        status=report.pdf_status or "ready",
        progress=report.pdf_progress or 0,
        error=report.pdf_error,
    )


@router.get("/{report_id}", response_model=dict)
def get_report(
    report_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    report = _report_for_user(report_id, user.id, db)
    if not report:
        raise HTTPException(status_code=404, detail="REPORT_NOT_FOUND")
    return {"report": ReportResponse.model_validate(report)}


@router.get("/{report_id}/evaluation", response_model=EvaluationResponse)
def get_evaluation(
    report_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EvaluationResponse:
    report = _report_for_user(report_id, user.id, db)
    if not report or not report.evaluation:
        raise HTTPException(status_code=404, detail="EVALUATION_NOT_FOUND")
    return EvaluationResponse(**report.evaluation)


@router.delete("/{report_id}", response_model=dict)
def delete_report(
    report_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    report = _report_for_user(report_id, user.id, db)
    if not report:
        raise HTTPException(status_code=404, detail="REPORT_NOT_FOUND")
    db.delete(report)
    db.commit()
    return {"message": "Report deleted"}
