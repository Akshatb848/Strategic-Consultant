from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from asis.backend.api.dependencies import get_admin_user
from asis.backend.config.logging import logger
from asis.backend.config.settings import get_settings
from asis.backend.db import models
from asis.backend.db.database import get_db
from asis.backend.schemas.common import HealthResponse

router = APIRouter(tags=["system"])
settings = get_settings()


def _check_database(db: Session) -> str:
    try:
        db.execute(text("SELECT 1"))
        return "ok"
    except Exception as exc:
        logger.warning("health_db_check_failed", error=str(exc))
        return "degraded"


def _check_redis() -> str:
    try:
        import redis as redis_lib  # type: ignore[import]

        client = redis_lib.from_url(settings.redis_url, socket_connect_timeout=2)
        client.ping()
        return "ok"
    except Exception:
        return "unavailable"


@router.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)) -> HealthResponse:
    db_status = _check_database(db)
    redis_status = _check_redis()
    overall = "ok" if db_status == "ok" else "degraded"
    return HealthResponse(
        status=overall,
        version=settings.app_version,
        environment=settings.environment,
        checks={"database": db_status, "redis": redis_status},
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
