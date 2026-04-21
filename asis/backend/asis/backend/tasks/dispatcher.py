from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from asis.backend.config.logging import logger
from asis.backend.config.settings import get_settings
from asis.backend.graph.pipeline import v4_workflow

executor = ThreadPoolExecutor(max_workers=get_settings().local_worker_concurrency)

# Celery task ID registry — maps analysis_id → celery task id for revocation
_celery_task_registry: dict[str, str] = {}


def dispatch_analysis(analysis_id: str) -> None:
    """Dispatch analysis pipeline to Celery (preferred) or ThreadPoolExecutor fallback."""
    settings = get_settings()

    if not settings.run_analyses_inline and _celery_available(settings):
        try:
            from asis.backend.tasks.celery_app import celery_app  # avoid circular at module-load

            result = celery_app.send_task(
                "asis.backend.tasks.analysis_task.run_analysis",
                args=[analysis_id],
                queue="asis-analysis",
            )
            _celery_task_registry[analysis_id] = result.id
            logger.info("analysis_dispatched_celery", analysis_id=analysis_id, celery_task_id=result.id)
            return
        except Exception as exc:
            logger.warning(
                "celery_dispatch_failed_falling_back",
                analysis_id=analysis_id,
                error=str(exc),
            )

    if settings.run_analyses_inline:
        logger.info("analysis_dispatched_inline", analysis_id=analysis_id)
        v4_workflow.run(analysis_id)
    else:
        logger.info("analysis_dispatched_threadpool", analysis_id=analysis_id)
        executor.submit(v4_workflow.run, analysis_id)


def cancel_analysis(analysis_id: str) -> None:
    """Send Celery revoke signal if a task was dispatched via Celery."""
    settings = get_settings()
    task_id = _celery_task_registry.pop(analysis_id, None)
    if task_id and _celery_available(settings):
        try:
            from asis.backend.tasks.celery_app import celery_app

            celery_app.control.revoke(task_id, terminate=True, signal="SIGTERM")
            logger.info("analysis_celery_revoked", analysis_id=analysis_id, celery_task_id=task_id)
        except Exception as exc:
            logger.warning("celery_revoke_failed", analysis_id=analysis_id, error=str(exc))
    # In-process cancellations are handled by the status=cancelled DB check
    # in pipeline._run_visible_agent, so no further action needed here.


def _celery_available(settings) -> bool:
    """Return True if Celery broker is configured and connection seems plausible."""
    return bool(
        settings.celery_broker_url
        and not settings.celery_broker_url.startswith("redis://localhost")
        and not settings.celery_broker_url.startswith("memory://")
    )
