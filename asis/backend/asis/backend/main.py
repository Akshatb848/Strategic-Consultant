from __future__ import annotations

import sys

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from asis.backend.api.routes.analysis import router as analysis_router
from asis.backend.api.routes.auth import router as auth_router
from asis.backend.api.routes.memory import router as memory_router
from asis.backend.api.routes.reports import router as reports_router
from asis.backend.api.routes.system import router as system_router
from asis.backend.config.logging import configure_logging, logger
from asis.backend.config.settings import get_settings
from asis.backend.db.database import init_db

settings = get_settings()
configure_logging()

# ── JWT entropy guard ─────────────────────────────────────────────────────────
if len(settings.jwt_secret) < settings.jwt_min_secret_length:
    logger.error(
        "jwt_secret_too_short",
        length=len(settings.jwt_secret),
        minimum=settings.jwt_min_secret_length,
        hint="Set JWT_SECRET to a cryptographically random string of at least 32 characters.",
    )
    if settings.environment == "production":
        sys.exit(1)

# ── Rate limiter (backed by Redis when available) ─────────────────────────────
limiter = Limiter(key_func=get_remote_address, storage_uri=settings.redis_url)

app = FastAPI(title=settings.app_name, version=settings.app_version)

# Order matters: SlowAPI before CORS
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.on_event("startup")
def startup() -> None:
    logger.info(
        "asis_startup",
        version=settings.app_version,
        environment=settings.environment,
        demo_mode=settings.demo_mode,
    )
    if settings.enable_auto_schema:
        init_db()


# Export limiter so routes can import it
__all__ = ["app", "limiter"]


app.include_router(auth_router, prefix=settings.api_v1_prefix)
app.include_router(analysis_router, prefix=settings.api_v1_prefix)
app.include_router(reports_router, prefix=settings.api_v1_prefix)
app.include_router(memory_router, prefix=settings.api_v1_prefix)
app.include_router(system_router, prefix=settings.health_prefix)


def run() -> None:  # pragma: no cover
    import uvicorn

    uvicorn.run("asis.backend.main:app", host="0.0.0.0", port=8000, reload=settings.environment == "development")
