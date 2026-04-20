from __future__ import annotations

from abc import ABC, abstractmethod
from time import perf_counter

from asis.backend.agents.llm_proxy import llm_proxy
from asis.backend.agents.references import build_citations
from asis.backend.agents.types import AgentOutput, PipelineState
from asis.backend.config.settings import get_settings


class BaseAgent(ABC):
    agent_id: str
    agent_name: str
    framework: str
    llm_model: str | list[str] | None = None

    def run(self, state: PipelineState) -> AgentOutput:
        start = perf_counter()
        resolved_models = self.resolve_models()
        generated = self._generate(state)
        duration_ms = int((perf_counter() - start) * 1000)
        model_used = generated.pop("_model_used", None)
        tools_called = generated.pop("_tools_called", None) or []
        langfuse_trace_id = generated.pop("_langfuse_trace_id", None)
        token_usage = generated.pop("_token_usage", None)
        used_fallback = bool(generated.pop("_used_fallback", False))
        return AgentOutput(
            agent_id=self.agent_id,
            agent_name=self.agent_name,
            confidence_score=generated["confidence_score"],
            duration_ms=duration_ms,
            model_used=model_used or ("demo-local" if get_settings().demo_mode else (resolved_models[0] if resolved_models else None)),
            tools_called=tools_called,
            langfuse_trace_id=langfuse_trace_id,
            token_usage=token_usage,
            citations=generated.get("citations") or build_citations(state.get("extracted_context") or state.get("company_context") or {}),
            used_fallback=used_fallback,
            data=generated,
        )

    def _generate(self, state: PipelineState) -> dict:
        proxy_output = None
        settings = get_settings()
        if not settings.demo_mode:
            proxy_output = llm_proxy.generate_json(
                system_prompt=self.system_prompt(),
                user_prompt=self.user_prompt(state),
                models=self.resolve_models(),
                agent_id=self.agent_id,
                analysis_id=state.get("analysis_id"),
            )
        if proxy_output:
            proxy_output.setdefault("citations", build_citations(state.get("extracted_context") or {}))
            proxy_output.setdefault("confidence_score", self.local_result(state)["confidence_score"])
            proxy_output["_used_fallback"] = False
            return proxy_output
        local_output = self.local_result(state)
        local_output["_used_fallback"] = True
        return local_output

    def resolve_models(self) -> list[str]:
        settings = get_settings()
        if isinstance(self.llm_model, list):
            return self.llm_model
        if isinstance(self.llm_model, str):
            return [self.llm_model]
        profile = settings.agent_model_profiles.get(self.agent_id)
        if not profile:
            return [settings.litellm_model_primary, settings.litellm_model_fast]
        models = [profile.primary, *profile.fallbacks]
        if profile.open_source:
            models.append(profile.open_source)
        deduped: list[str] = []
        for model in models:
            if model and model not in deduped:
                deduped.append(model)
        return deduped

    @abstractmethod
    def local_result(self, state: PipelineState) -> dict:
        raise NotImplementedError

    def system_prompt(self) -> str:
        return f"You are the {self.agent_name} for ASIS. Apply {self.framework} and return JSON."

    def user_prompt(self, state: PipelineState) -> str:
        return f"Query: {state['query']}\nContext: {state.get('extracted_context') or state.get('company_context')}"


def calculate_confidence(
    *,
    query: str,
    context: dict,
    evidence_bonus: int = 0,
    uncertainty_penalty: int = 0,
) -> float:
    score = 56
    score += 6 if context.get("company_name") else -2
    score += 5 if context.get("sector") else -4
    score += 4 if context.get("geography") else -4
    score += 4 if context.get("decision_type") else -3
    score += min(8, len(query.split()) // 8)
    score += evidence_bonus
    score -= uncertainty_penalty
    score = max(52, min(94, round(score)))
    if score == 85:
        score = 84 if evidence_bonus % 2 == 0 else 86
    return float(score)


def organisation_scale(context: dict) -> dict:
    revenue = (context.get("annual_revenue") or "").lower()
    employees = (context.get("employees") or "").lower()
    if any(token in revenue for token in ("bn", "billion", "1000")) or any(token in employees for token in ("10000", "10,000", "50,000")):
        return {"label": "global", "investment_multiplier": 3.5}
    if any(token in revenue for token in ("m", "million", "crore")) or any(token in employees for token in ("1000", "1,000", "5000")):
        return {"label": "mid-market", "investment_multiplier": 1.8}
    return {"label": "growth", "investment_multiplier": 1.0}
