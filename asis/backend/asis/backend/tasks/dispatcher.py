from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from asis.backend.config.settings import get_settings
from asis.backend.graph.workflow import workflow

executor = ThreadPoolExecutor(max_workers=get_settings().local_worker_concurrency)


def dispatch_analysis(analysis_id: str) -> None:
    settings = get_settings()
    if settings.run_analyses_inline:
        workflow.run(analysis_id)
        return
    executor.submit(workflow.run, analysis_id)
