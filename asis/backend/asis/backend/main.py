from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from asis.backend.api.routes.analysis import router as analysis_router
from asis.backend.api.routes.auth import router as auth_router
from asis.backend.api.routes.memory import router as memory_router
from asis.backend.api.routes.reports import router as reports_router
from asis.backend.api.routes.system import router as system_router
from asis.backend.config.logging import configure_logging
from asis.backend.config.settings import get_settings
from asis.backend.db.database import init_db

settings = get_settings()
configure_logging()

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.on_event("startup")
def startup() -> None:
    if settings.enable_auto_schema:
        init_db()


app.include_router(auth_router, prefix=settings.api_v1_prefix)
app.include_router(analysis_router, prefix=settings.api_v1_prefix)
app.include_router(reports_router, prefix=settings.api_v1_prefix)
app.include_router(memory_router, prefix=settings.api_v1_prefix)
app.include_router(system_router, prefix=settings.health_prefix)


def run() -> None:  # pragma: no cover
    import uvicorn

    uvicorn.run("asis.backend.main:app", host="0.0.0.0", port=8000, reload=settings.environment == "development")
