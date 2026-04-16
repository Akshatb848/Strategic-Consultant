"""Shared SlowAPI rate-limiter instance.

Importing from a single module guarantees that every route decorator and
the ASGI middleware all reference the same Limiter object (and therefore
the same Redis-backed counter store).
"""
from __future__ import annotations

import os

from slowapi import Limiter
from slowapi.util import get_remote_address

from asis.backend.config.settings import get_settings

_settings = get_settings()

# In test mode or demo mode, use in-memory storage to avoid requiring Redis.
# Also fall back to memory if REDIS_URL is not explicitly overridden and we're in test env.
_env = os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "development"))
_demo = os.getenv("ASIS_DEMO_MODE", "false").lower() == "true"
_use_memory = _env == "test" or _demo or _settings.redis_url.startswith("memory://")

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="memory://" if _use_memory else _settings.redis_url,
)
