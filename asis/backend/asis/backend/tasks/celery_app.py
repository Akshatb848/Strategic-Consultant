from __future__ import annotations

from celery import Celery

from asis.backend.config.settings import get_settings

settings = get_settings()

celery_app = Celery(
    "asis",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_default_queue="asis-analysis",
)
