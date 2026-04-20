from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from asis.backend.api.dependencies import get_admin_user
from asis.backend.config.settings import get_settings
from asis.backend.db import models
from asis.backend.db.database import get_db
from asis.backend.schemas.common import HealthResponse

router = APIRouter(tags=["system"])
settings = get_settings()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=settings.app_version,
        environment=settings.environment,
        demo_mode=settings.demo_mode,
    )


@router.get("/metrics")
def metrics(
    response: Response,
    admin=Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> str:
    response.media_type = "text/plain; version=0.0.4"
    return "\n".join(
        [
            f"asis_users_total {db.query(models.User).count()}",
            f"asis_analyses_total {db.query(models.Analysis).count()}",
            f"asis_reports_total {db.query(models.Report).count()}",
        ]
    )
