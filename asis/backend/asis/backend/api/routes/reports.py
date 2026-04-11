from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from asis.backend.api.dependencies import get_current_user
from asis.backend.db import models
from asis.backend.db.database import get_db
from asis.backend.schemas.reports import EvaluationResponse, ReportResponse

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("", response_model=dict)
def list_reports(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    reports = db.query(models.Report).filter(models.Report.user_id == user.id).order_by(models.Report.created_at.desc()).all()
    return {"reports": [ReportResponse.model_validate(report) for report in reports]}


@router.get("/{report_id}", response_model=dict)
def get_report(
    report_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    report = db.query(models.Report).filter(models.Report.id == report_id, models.Report.user_id == user.id).one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="REPORT_NOT_FOUND")
    return {"report": ReportResponse.model_validate(report)}


@router.get("/{report_id}/evaluation", response_model=EvaluationResponse)
def get_evaluation(
    report_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EvaluationResponse:
    report = db.query(models.Report).filter(models.Report.id == report_id, models.Report.user_id == user.id).one_or_none()
    if not report or not report.evaluation:
        raise HTTPException(status_code=404, detail="EVALUATION_NOT_FOUND")
    return EvaluationResponse(**report.evaluation)


@router.delete("/{report_id}", response_model=dict)
def delete_report(
    report_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    report = db.query(models.Report).filter(models.Report.id == report_id, models.Report.user_id == user.id).one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="REPORT_NOT_FOUND")
    db.delete(report)
    db.commit()
    return {"message": "Report deleted"}
