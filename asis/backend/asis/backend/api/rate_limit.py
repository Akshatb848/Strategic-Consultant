"""Shared SlowAPI rate-limiter instance.

Importing from a single module guarantees that every route decorator and
the ASGI middleware all reference the same Limiter object (and therefore
the same Redis-backed counter store).

Redis is used when available; the limiter falls back to in-memory counting
if the broker is unreachable at startup (e.g. in unit-test environments).
This prevents a ConnectionError during module import when Redis is absent.
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from asis.backend.config.logging import logger
from asis.backend.config.settings import get_settings


def _build_limiter() -> Limiter:
    settings = get_settings()
    redis_uri = settings.redis_url
    if redis_uri:
        try:
            lim = Limiter(key_func=get_remote_address, storage_uri=redis_uri)
            # Force-validate the storage is reachable (limits>=3 pings on init).
            # If not, fall through to in-memory.
            return lim
        except Exception as exc:  # pragma: no cover
            logger.warning(
                "rate_limiter_redis_unavailable",
                redis_uri=redis_uri,
                error=str(exc),
                fallback="in-memory",
            )
    return Limiter(key_func=get_remote_address)


limiter = _build_limiter()

