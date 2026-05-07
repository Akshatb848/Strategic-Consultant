from __future__ import annotations

import os
import sys

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from asis.backend.api.rate_limit import limiter
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

_WEAK_SECRET_MARKERS = (
    "change-me",
    "replace-with",
    "dev-access-secret",
    "dev-refresh-secret",
    "in-production",
    "jwt-secret",
)

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

if any(marker in settings.jwt_secret.lower() for marker in _WEAK_SECRET_MARKERS):
    logger.error(
        "jwt_secret_placeholder_detected",
        hint="Replace JWT_SECRET with a cryptographically random production secret instead of a placeholder value.",
    )
    if settings.environment == "production":
        sys.exit(1)

_swagger_enabled = settings.environment != "production" or (os.getenv("SWAGGER_ENABLED", "false").lower() == "true")
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs" if _swagger_enabled else None,
    redoc_url="/redoc" if _swagger_enabled else None,
    openapi_url="/openapi.json" if _swagger_enabled else None,
)

# Order matters: SlowAPI before CORS
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Build the allowed-origins list: env-driven list + guaranteed frontend_url fallback.
# This ensures CORS works even when ALLOWED_ORIGINS env-var parsing fails while
# FRONTEND_URL (required by docker-compose) is always correct.
_computed_origins: list[str] = list(
    dict.fromkeys(  # preserve order, deduplicate
        o for o in [*settings.allowed_origins, settings.frontend_url] if o
    )
)
logger.info(
    "cors_origins_configured",
    allowed_origins=_computed_origins,
    raw_allowed_origins_env=settings.allowed_origins,
    frontend_url=settings.frontend_url,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_computed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # FastAPI's ExceptionMiddleware re-raises unregistered exception types, causing them
    # to propagate through BaseHTTPMiddleware past CORSMiddleware's send wrapper so that
    # ServerErrorMiddleware returns 500 without CORS headers. This handler prevents that.
    logger.error(
        "unhandled_exception",
        path=str(request.url.path),
        method=request.method,
        error=str(exc),
        exc_type=type(exc).__name__,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."},
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
