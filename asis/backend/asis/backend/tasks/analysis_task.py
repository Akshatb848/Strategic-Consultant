"""Celery task wrapper for the v4 analysis pipeline.

This module is imported by the Celery worker process.  The FastAPI process
dispatches tasks via celery_app.send_task() using the string name
``asis.backend.tasks.analysis_task.run_analysis`` — no import needed there.
"""
from __future__ import annotations

from asis.backend.config.logging import logger
from asis.backend.tasks.celery_app import celery_app


@celery_app.task(
    name="asis.backend.tasks.analysis_task.run_analysis",
    bind=True,
    max_retries=0,          # pipeline has its own retry logic
    acks_late=True,         # only ack after the task finishes (idempotency)
    reject_on_worker_lost=True,
    soft_time_limit=900,    # 15-minute soft limit → SoftTimeLimitExceeded
    time_limit=960,         # 16-minute hard kill
)
def run_analysis(self, analysis_id: str) -> None:
    """Execute the v4 enterprise pipeline for the given analysis."""
    from asis.backend.graph.pipeline import v4_workflow  # late import to avoid circular

    logger.info("celery_task_started", analysis_id=analysis_id, celery_task_id=self.request.id)
    try:
        v4_workflow.run(analysis_id)
        logger.info("celery_task_completed", analysis_id=analysis_id)
    except Exception as exc:
        logger.error("celery_task_failed", analysis_id=analysis_id, error=str(exc))
        raise
