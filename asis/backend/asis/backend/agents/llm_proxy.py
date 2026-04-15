from __future__ import annotations

import json
import re
import time
from typing import Any
from uuid import uuid4

from litellm import completion

from asis.backend.config.logging import logger
from asis.backend.config.settings import get_settings

# ── Model pricing table (USD per 1M tokens, input/output) ────────────────────
# Updated April 2026 — adjust as providers change pricing.
_MODEL_COST_PER_1M: dict[str, tuple[float, float]] = {
    "claude-sonnet-4-5": (3.0, 15.0),
    "claude-haiku-4-5": (0.25, 1.25),
    "claude-opus-4-6": (15.0, 75.0),
    "gemini-2.5-pro": (1.25, 5.0),
    "gemini-2.0-flash": (0.075, 0.3),
    "gpt-4o": (5.0, 15.0),
    "gpt-4o-mini": (0.15, 0.6),
}

_DEFAULT_COST_PER_1M = (1.0, 4.0)  # conservative fallback


def _estimate_cost(model: str, tokens_in: int, tokens_out: int) -> float:
    """Return cost in USD for a single LLM call."""
    model_key = model.split("/")[-1].lower()  # strip provider prefix
    price_in, price_out = _MODEL_COST_PER_1M.get(model_key, _DEFAULT_COST_PER_1M)
    return round((tokens_in * price_in + tokens_out * price_out) / 1_000_000, 8)


class LiteLLMProxy:
    @staticmethod
    def _extract_json_payload(content: str) -> dict[str, Any]:
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start == -1 or end == -1 or end <= start:
                raise
            return json.loads(cleaned[start : end + 1])

    def generate_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        models: list[str] | None = None,
        model: str | None = None,
        agent_id: str | None = None,
        analysis_id: str | None = None,
    ) -> dict[str, Any] | None:
        settings = get_settings()
        if not (settings.litellm_proxy_url and settings.litellm_master_key):
            return None

        candidate_models = [value for value in (models or [model or settings.litellm_model_primary]) if value]

        # Build Langfuse callback if enabled
        langfuse_trace_id: str | None = None
        langfuse_callbacks: list = []
        if settings.langfuse_enabled and settings.langfuse_public_key and settings.langfuse_secret_key:
            try:
                from langfuse.callback import CallbackHandler  # type: ignore[import]

                langfuse_trace_id = uuid4().hex
                handler = CallbackHandler(
                    public_key=settings.langfuse_public_key,
                    secret_key=settings.langfuse_secret_key,
                    host=settings.langfuse_host or "https://cloud.langfuse.com",
                    trace_id=langfuse_trace_id,
                    session_id=analysis_id,
                    user_id=agent_id,
                    metadata={"agent_id": agent_id, "analysis_id": analysis_id},
                )
                langfuse_callbacks = [handler]
            except Exception as exc:
                logger.warning("langfuse_callback_init_failed", error=str(exc))

        for candidate in candidate_models:
            t0 = time.perf_counter()
            try:
                kwargs: dict[str, Any] = {
                    "model": candidate,
                    "api_base": settings.litellm_proxy_url,
                    "api_key": settings.litellm_master_key,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {
                            "role": "user",
                            "content": user_prompt + "\nReturn only valid JSON with double-quoted keys.",
                        },
                    ],
                    "temperature": 0.2,
                }
                if langfuse_callbacks:
                    kwargs["callbacks"] = langfuse_callbacks

                response = completion(**kwargs)
                latency_ms = int((time.perf_counter() - t0) * 1000)

                content = response["choices"][0]["message"]["content"]
                if isinstance(content, list):
                    text = "".join(part.get("text", "") for part in content if isinstance(part, dict))
                else:
                    text = content

                payload = self._extract_json_payload(text)

                # ── Capture token usage and cost ──────────────────────────────
                usage = getattr(response, "usage", None) or {}
                if hasattr(usage, "__dict__"):
                    usage = usage.__dict__
                tokens_in = int(usage.get("prompt_tokens") or 0)
                tokens_out = int(usage.get("completion_tokens") or 0)
                cost_usd = _estimate_cost(candidate, tokens_in, tokens_out)

                payload["_model_used"] = candidate
                payload["_langfuse_trace_id"] = langfuse_trace_id
                payload["_token_usage"] = {
                    "tokens_in": tokens_in,
                    "tokens_out": tokens_out,
                    "cost_usd": cost_usd,
                    "latency_ms": latency_ms,
                }

                logger.info(
                    "llm_call_success",
                    model=candidate,
                    agent_id=agent_id,
                    analysis_id=analysis_id,
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    cost_usd=cost_usd,
                    latency_ms=latency_ms,
                )

                return payload

            except Exception as exc:  # pragma: no cover - exercised in live environments
                logger.warning(
                    "litellm_proxy_failed",
                    model=candidate,
                    agent_id=agent_id,
                    error=str(exc),
                )
        return None


llm_proxy = LiteLLMProxy()
