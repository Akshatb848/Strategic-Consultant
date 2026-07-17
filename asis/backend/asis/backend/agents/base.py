from __future__ import annotations

from copy import deepcopy
from abc import ABC, abstractmethod
import json
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
    required_live_keys: tuple[str, ...] = ()

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
        correction_reason = generated.pop("_correction_reason", None)
        self_corrected = bool(generated.pop("_self_corrected", False))
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
            correction_reason=correction_reason,
            self_corrected=self_corrected,
            data=generated,
        )

    def _generate(self, state: PipelineState) -> dict:
        scaffold = self.local_result(state)
        proxy_output = None
        settings = get_settings()
        live_state = dict(state)
        live_context = dict(state.get("extracted_context") or state.get("company_context") or {})
        evidence_base = state.get("evidence_base") or live_context.get("_live_citations") or []
        if evidence_base:
            live_context["_live_citations"] = evidence_base
        live_state["extracted_context"] = live_context
        if not settings.demo_mode:
            provider_prompt = self.user_prompt(live_state)
            if evidence_base:
                provider_prompt += "\n\nVerified evidence base. Copy source URLs exactly when citing:\n" + json.dumps(evidence_base, ensure_ascii=False, default=str)
            proxy_output = llm_proxy.generate_json(
                system_prompt=self.system_prompt(),
                user_prompt=provider_prompt,
                models=self.resolve_models(),
                agent_id=self.agent_id,
                analysis_id=state.get("analysis_id"),
            )
        if proxy_output:
            self._assert_live_output_contract(proxy_output, settings)
            if settings.require_live_evidence:
                return self._prepare_strict_live_output(proxy_output, live_state, settings)
            merged = self.merge_generated_output(scaffold, proxy_output)
            merged["citations"] = merged.get("citations") or scaffold.get("citations") or build_citations(
                state.get("extracted_context") or state.get("company_context") or {}
            )
            merged["confidence_score"] = self._normalize_confidence(
                merged.get("confidence_score") or scaffold.get("confidence_score")
            )
            for metadata_key in ("_model_used", "_tools_called", "_langfuse_trace_id", "_token_usage"):
                if metadata_key in proxy_output:
                    merged[metadata_key] = proxy_output[metadata_key]
            merged["_used_fallback"] = False
            return merged
        if settings.allow_llm_fallback or settings.demo_mode:
            scaffold["_used_fallback"] = True
            return scaffold
        if settings.allow_deterministic_repair and self._has_live_provider_config(settings):
            scaffold["_used_fallback"] = False
            scaffold["_self_corrected"] = True
            scaffold["_model_used"] = f"asis-deterministic-{self.agent_id}-repair"
            scaffold["_token_usage"] = {
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_usd": 0.0,
                "latency_ms": 0,
                "provider_mode": "deterministic_repair",
                "attempt": 0,
            }
            scaffold["_correction_reason"] = (
                "Live provider was configured but returned no parseable JSON; generated "
                "validated agent output from ASIS deterministic evidence logic instead of "
                "failing the analysis."
            )
            return scaffold
        raise RuntimeError(
            f"LIVE_LLM_OUTPUT_UNAVAILABLE: {self.agent_id} received no parseable live model output; "
            "ASIS will not publish deterministic repair data as a client report."
        )

    def _assert_live_output_contract(self, output: dict, settings) -> None:
        if not settings.require_live_evidence or not self.required_live_keys:
            return
        missing = [
            key
            for key in self.required_live_keys
            if key != "citations"
            if key not in output or output.get(key) in (None, "", [], {})
        ]
        if missing:
            raise RuntimeError(
                f"LIVE_LLM_OUTPUT_INCOMPLETE: {self.agent_id} omitted required live fields: "
                f"{', '.join(missing)}. ASIS will not fill them from a deterministic scaffold."
            )

    def _prepare_strict_live_output(self, output: dict, state: PipelineState, settings) -> dict:
        """Return provider data without allowing the deterministic scaffold to fill gaps."""
        required = {key for key in self.required_live_keys if key != "citations"} | {"confidence_score"}
        missing = [key for key in sorted(required) if output.get(key) in (None, "", [], {})]
        if missing:
            raise RuntimeError(
                f"LIVE_LLM_OUTPUT_INCOMPLETE: {self.agent_id} omitted provider-owned fields: "
                f"{', '.join(missing)}. Deterministic scaffold completion is disabled."
            )

        evidence_base = state.get("evidence_base") or []
        if not evidence_base or any(item.get("verification_status") != "verified" for item in evidence_base if isinstance(item, dict)):
            raise RuntimeError(
                f"LIVE_EVIDENCE_BLOCKED: {self.agent_id} cannot publish without an exclusively verified evidence base."
            )

        # The evidence provider, not the language model, is authoritative for
        # source identity. The model may use these sources, but cannot invent a
        # citation record that passes the production gate.
        prepared = deepcopy(output)
        prepared["confidence_score"] = self._normalize_confidence(prepared.get("confidence_score"))
        prepared["citations"] = deepcopy(evidence_base)
        if isinstance(prepared.get("framework_outputs"), dict):
            for framework in prepared["framework_outputs"].values():
                if isinstance(framework, dict):
                    framework["citations"] = deepcopy(evidence_base)
        prepared["_used_fallback"] = False
        return prepared

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

    @staticmethod
    def _has_live_provider_config(settings) -> bool:
        return bool(
            (settings.litellm_proxy_url and settings.litellm_master_key)
            or settings.openrouter_api_key
            or settings.groq_api_key
        )

    @abstractmethod
    def local_result(self, state: PipelineState) -> dict:
        raise NotImplementedError

    def system_prompt(self) -> str:
        return f"You are the {self.agent_name} for ASIS. Apply {self.framework} and return JSON."

    def user_prompt(self, state: PipelineState) -> str:
        return f"Query: {state['query']}\nContext: {state.get('extracted_context') or state.get('company_context')}"

    def merge_generated_output(self, scaffold: dict, generated: dict) -> dict:
        return self._merge_value(scaffold, generated)

    def _merge_value(self, scaffold, generated):
        if generated in (None, "", [], {}):
            return deepcopy(scaffold)

        if isinstance(scaffold, dict):
            if not isinstance(generated, dict):
                return deepcopy(scaffold)
            merged = deepcopy(scaffold)
            for key, value in generated.items():
                if isinstance(key, str) and key.startswith("_"):
                    continue
                if key in merged:
                    merged[key] = self._merge_value(merged[key], value)
                elif value not in (None, "", [], {}):
                    merged[key] = deepcopy(value)
            return merged

        if isinstance(scaffold, list):
            if not isinstance(generated, list) or not generated:
                return deepcopy(scaffold)
            if not scaffold:
                return deepcopy(generated)
            template = scaffold[0]
            if isinstance(template, dict):
                return [
                    self._merge_value(template, item) if isinstance(item, dict) else deepcopy(template)
                    for item in generated
                ]
            return deepcopy(generated)

        return deepcopy(generated)

    @staticmethod
    def _normalize_confidence(value: float | int | None) -> float:
        if value is None:
            return 0.68
        numeric = float(value)
        if numeric > 1:
            numeric /= 100
        return round(max(0.0, min(1.0, numeric)), 3)


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
