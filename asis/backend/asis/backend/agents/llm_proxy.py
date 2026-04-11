from __future__ import annotations

import json
import re
from typing import Any

from litellm import completion

from asis.backend.config.logging import logger
from asis.backend.config.settings import get_settings


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
    ) -> dict[str, Any] | None:
        settings = get_settings()
        if not (settings.litellm_proxy_url and settings.litellm_master_key):
            return None
        candidate_models = [value for value in (models or [model or settings.litellm_model_primary]) if value]
        for candidate in candidate_models:
            try:
                response = completion(
                    model=candidate,
                    api_base=settings.litellm_proxy_url,
                    api_key=settings.litellm_master_key,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt + "\nReturn only valid JSON with double-quoted keys."},
                    ],
                    temperature=0.2,
                )
                content = response["choices"][0]["message"]["content"]
                if isinstance(content, list):
                    text = "".join(part.get("text", "") for part in content if isinstance(part, dict))
                else:
                    text = content
                return self._extract_json_payload(text)
            except Exception as exc:  # pragma: no cover - exercised in live environments
                logger.warning("litellm_proxy_failed", model=candidate, error=str(exc))
        return None


llm_proxy = LiteLLMProxy()
