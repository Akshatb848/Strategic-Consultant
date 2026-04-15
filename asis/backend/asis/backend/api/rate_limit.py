"""Shared SlowAPI rate-limiter instance.

Importing from a single module guarantees that every route decorator and
the ASGI middleware all reference the same Limiter object (and therefore
the same Redis-backed counter store).
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from asis.backend.config.settings import get_settings

_settings = get_settings()

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=_settings.redis_url,
)
