from __future__ import annotations

import os
from functools import lru_cache
from typing import Literal

from pydantic import BaseModel, Field


def _env(name: str, default: str | None = None) -> str | None:
    return os.getenv(name, default)


def _env_bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).lower() == "true"


def _env_int(name: str, default: int) -> int:
    return int(os.getenv(name, str(default)))


class AgentModelProfile(BaseModel):
    primary: str
    fallbacks: list[str] = Field(default_factory=list)
    open_source: str | None = None
    rationale: str


class Settings(BaseModel):
    app_name: str = Field(default_factory=lambda: _env("APP_NAME", "ASIS") or "ASIS")
    app_version: str = Field(default_factory=lambda: _env("APP_VERSION", "4.0.0") or "4.0.0")
    environment: Literal["development", "test", "production"] = Field(
        default_factory=lambda: _env("ENVIRONMENT", _env("NODE_ENV", "development")) or "development"
    )
    debug: bool = Field(default_factory=lambda: _env_bool("DEBUG", False))
    api_v1_prefix: str = "/api/v1"
    health_prefix: str = "/v1"
    frontend_url: str = Field(default_factory=lambda: _env("FRONTEND_URL", "http://localhost:3001") or "http://localhost:3001")
    frontend_internal_url: str = Field(default_factory=lambda: _env("FRONTEND_INTERNAL_URL", _env("FRONTEND_URL", "http://localhost:3001")) or "http://localhost:3001")
    allowed_origins: list[str] = Field(
        default_factory=lambda: [
            origin.strip()
            for origin in (_env("ALLOWED_ORIGINS", _env("FRONTEND_URL", "http://localhost:3001")) or "").split(",")
            if origin.strip()
        ]
    )
    database_url: str = Field(default_factory=lambda: _env("DATABASE_URL", "sqlite:///./asis_v4.db") or "sqlite:///./asis_v4.db")
    jwt_secret: str = Field(default_factory=lambda: _env("JWT_SECRET", "change-me-in-production") or "change-me-in-production")
    jwt_algorithm: str = "HS256"
    access_token_expiry_minutes: int = Field(default_factory=lambda: _env_int("ACCESS_TOKEN_EXPIRY_MINUTES", 15))
    refresh_token_expiry_days: int = Field(default_factory=lambda: _env_int("REFRESH_TOKEN_EXPIRY_DAYS", 7))
    secure_cookies: bool = Field(default_factory=lambda: _env_bool("SECURE_COOKIES", False))
    litellm_proxy_url: str | None = Field(default_factory=lambda: _env("LITELLM_PROXY_URL"))
    litellm_master_key: str | None = Field(default_factory=lambda: _env("LITELLM_MASTER_KEY"))
    groq_api_key: str | None = Field(default_factory=lambda: _env("GROQ_API_KEY"))
    groq_api_base: str = Field(default_factory=lambda: _env("GROQ_API_BASE", "https://api.groq.com/openai/v1") or "https://api.groq.com/openai/v1")
    groq_model_primary: str = Field(default_factory=lambda: _env("GROQ_MODEL_PRIMARY", "llama-3.3-70b-versatile") or "llama-3.3-70b-versatile")
    groq_model_fast: str = Field(default_factory=lambda: _env("GROQ_MODEL_FAST", "llama-3.1-8b-instant") or "llama-3.1-8b-instant")
    groq_model_reasoning: str = Field(default_factory=lambda: _env("GROQ_MODEL_REASONING", "llama-3.3-70b-versatile") or "llama-3.3-70b-versatile")
    litellm_model_primary: str = Field(default_factory=lambda: _env("LITELLM_MODEL_PRIMARY", "claude-sonnet-4-5") or "claude-sonnet-4-5")
    litellm_model_fast: str = Field(default_factory=lambda: _env("LITELLM_MODEL_FAST", "claude-haiku-4-5") or "claude-haiku-4-5")
    litellm_model_gemini_pro: str = Field(default_factory=lambda: _env("LITELLM_MODEL_GEMINI_PRO", "gemini-2.5-pro") or "gemini-2.5-pro")
    litellm_model_gemini_flash: str = Field(default_factory=lambda: _env("LITELLM_MODEL_GEMINI_FLASH", "gemini-2.0-flash") or "gemini-2.0-flash")
    litellm_model_phi_reasoning: str = Field(default_factory=lambda: _env("LITELLM_MODEL_PHI_REASONING", "phi-4-reasoning") or "phi-4-reasoning")
    litellm_model_qwen_strategy: str = Field(default_factory=lambda: _env("LITELLM_MODEL_QWEN_STRATEGY", "qwen-strategy") or "qwen-strategy")
    litellm_model_arctic_research: str = Field(default_factory=lambda: _env("LITELLM_MODEL_ARCTIC_RESEARCH", "arctic-research") or "arctic-research")
    litellm_model_llama_governance: str = Field(default_factory=lambda: _env("LITELLM_MODEL_LLAMA_GOVERNANCE", "llama-governance") or "llama-governance")
    embedding_model: str = Field(default_factory=lambda: _env("EMBEDDING_MODEL", "text-embedding-3-small") or "text-embedding-3-small")
    demo_mode: bool = Field(default_factory=lambda: _env_bool("ASIS_DEMO_MODE", True))
    allow_llm_fallback: bool = Field(
        default_factory=lambda: (
            _env(
                "ALLOW_LLM_FALLBACK",
                "true"
                if (_env("ENVIRONMENT", _env("NODE_ENV", "development")) or "development") != "production"
                else "false",
            )
            or "false"
        ).lower()
        == "true"
    )
    redis_url: str = Field(default_factory=lambda: _env("REDIS_URL", "redis://localhost:6379/0") or "redis://localhost:6379/0")
    celery_broker_url: str = Field(default_factory=lambda: _env("CELERY_BROKER_URL", _env("REDIS_URL", "redis://localhost:6379/1")) or "redis://localhost:6379/1")
    celery_result_backend: str = Field(default_factory=lambda: _env("CELERY_RESULT_BACKEND", _env("REDIS_URL", "redis://localhost:6379/2")) or "redis://localhost:6379/2")
    run_analyses_inline: bool = Field(default_factory=lambda: _env_bool("RUN_ANALYSES_INLINE", False))
    qdrant_url: str | None = Field(default_factory=lambda: _env("QDRANT_URL"))
    qdrant_api_key: str | None = Field(default_factory=lambda: _env("QDRANT_API_KEY"))
    mem0_api_key: str | None = Field(default_factory=lambda: _env("MEM0_API_KEY"))
    mem0_base_url: str | None = Field(default_factory=lambda: _env("MEM0_BASE_URL"))
    tavily_api_key: str | None = Field(default_factory=lambda: _env("TAVILY_API_KEY"))
    newsapi_key: str | None = Field(default_factory=lambda: _env("NEWSAPI_KEY"))
    fmp_api_key: str | None = Field(default_factory=lambda: _env("FMP_API_KEY"))
    langfuse_public_key: str | None = Field(default_factory=lambda: _env("LANGFUSE_PUBLIC_KEY"))
    langfuse_secret_key: str | None = Field(default_factory=lambda: _env("LANGFUSE_SECRET_KEY"))
    langfuse_host: str | None = Field(default_factory=lambda: _env("LANGFUSE_HOST"))
    langfuse_trace_base_url: str | None = Field(default_factory=lambda: _env("LANGFUSE_TRACE_BASE_URL"))
    puppeteer_executable_path: str | None = Field(default_factory=lambda: _env("PUPPETEER_EXECUTABLE_PATH"))
    pdf_max_pages: int = Field(default_factory=lambda: _env_int("PDF_MAX_PAGES", 60))
    report_company_logo_url: str | None = Field(default_factory=lambda: _env("REPORT_COMPANY_LOGO_URL"))
    google_client_id: str | None = Field(default_factory=lambda: _env("GOOGLE_CLIENT_ID"))
    google_client_secret: str | None = Field(default_factory=lambda: _env("GOOGLE_CLIENT_SECRET"))
    google_callback_url: str = Field(default_factory=lambda: _env("GOOGLE_CALLBACK_URL", "http://localhost:8000/api/v1/auth/google/callback") or "http://localhost:8000/api/v1/auth/google/callback")
    github_client_id: str | None = Field(default_factory=lambda: _env("GITHUB_CLIENT_ID"))
    github_client_secret: str | None = Field(default_factory=lambda: _env("GITHUB_CLIENT_SECRET"))
    github_callback_url: str = Field(default_factory=lambda: _env("GITHUB_CALLBACK_URL", "http://localhost:8000/api/v1/auth/github/callback") or "http://localhost:8000/api/v1/auth/github/callback")
    enable_auto_schema: bool = Field(default_factory=lambda: _env_bool("ENABLE_AUTO_SCHEMA", True))
    sse_ping_seconds: int = Field(default_factory=lambda: _env_int("SSE_PING_SECONDS", 10))
    local_worker_concurrency: int = Field(default_factory=lambda: _env_int("LOCAL_WORKER_CONCURRENCY", 4))
    # Rate limiting
    rate_limit_analyses_per_day: int = Field(default_factory=lambda: _env_int("RATE_LIMIT_ANALYSES_PER_DAY", 20))
    rate_limit_analyses_per_minute: int = Field(default_factory=lambda: _env_int("RATE_LIMIT_ANALYSES_PER_MINUTE", 2))
    # Security
    jwt_min_secret_length: int = Field(default_factory=lambda: _env_int("JWT_MIN_SECRET_LENGTH", 32))
    # Observability / cost
    cost_tracking_enabled: bool = Field(default_factory=lambda: _env_bool("COST_TRACKING_ENABLED", True))
    langfuse_enabled: bool = Field(default_factory=lambda: _env_bool("LANGFUSE_ENABLED", False))

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def agent_model_profiles(self) -> dict[str, AgentModelProfile]:
        profiles = {
            "orchestrator": AgentModelProfile(
                primary=_env("AGENT_MODEL_ORCHESTRATOR", self.litellm_model_primary) or self.litellm_model_primary,
                fallbacks=[
                    _env("AGENT_MODEL_ORCHESTRATOR_FALLBACK", self.litellm_model_gemini_flash) or self.litellm_model_gemini_flash,
                    self.litellm_model_primary,
                ],
                open_source=_env("AGENT_MODEL_ORCHESTRATOR_OPEN", self.litellm_model_qwen_strategy),
                rationale="Fast planner that still preserves tool-ready instruction following.",
            ),
            "strategist": AgentModelProfile(
                primary=_env("AGENT_MODEL_STRATEGIST", self.litellm_model_gemini_pro) or self.litellm_model_gemini_pro,
                fallbacks=[
                    _env("AGENT_MODEL_STRATEGIST_FALLBACK", self.litellm_model_primary) or self.litellm_model_primary,
                    self.litellm_model_gemini_flash,
                ],
                open_source=_env("AGENT_MODEL_STRATEGIST_OPEN", self.litellm_model_qwen_strategy),
                rationale="Long-context strategic decomposition with strong structured output.",
            ),
            "quant": AgentModelProfile(
                primary=_env("AGENT_MODEL_QUANT", self.litellm_model_gemini_pro) or self.litellm_model_gemini_pro,
                fallbacks=[
                    _env("AGENT_MODEL_QUANT_FALLBACK", self.litellm_model_phi_reasoning) or self.litellm_model_phi_reasoning,
                    self.litellm_model_primary,
                ],
                open_source=_env("AGENT_MODEL_QUANT_OPEN", self.litellm_model_phi_reasoning),
                rationale="Reasoning-heavy capital modeling and verification math.",
            ),
            "market_intel": AgentModelProfile(
                primary=_env("AGENT_MODEL_MARKET_INTEL", self.litellm_model_primary) or self.litellm_model_primary,
                fallbacks=[
                    _env("AGENT_MODEL_MARKET_INTEL_FALLBACK", self.litellm_model_gemini_pro) or self.litellm_model_gemini_pro,
                    self.litellm_model_fast,
                ],
                open_source=_env("AGENT_MODEL_MARKET_INTEL_OPEN", self.litellm_model_arctic_research),
                rationale="High-throughput research synthesis with large context support.",
            ),
            "risk": AgentModelProfile(
                primary=_env("AGENT_MODEL_RISK", self.litellm_model_primary) or self.litellm_model_primary,
                fallbacks=[
                    _env("AGENT_MODEL_RISK_FALLBACK", self.litellm_model_gemini_pro) or self.litellm_model_gemini_pro,
                    self.litellm_model_fast,
                ],
                open_source=_env("AGENT_MODEL_RISK_OPEN", self.litellm_model_qwen_strategy),
                rationale="Nuanced downside reasoning and enterprise governance framing.",
            ),
            "red_team": AgentModelProfile(
                primary=_env("AGENT_MODEL_RED_TEAM", self.litellm_model_primary) or self.litellm_model_primary,
                fallbacks=[
                    _env("AGENT_MODEL_RED_TEAM_FALLBACK", self.litellm_model_gemini_pro) or self.litellm_model_gemini_pro,
                    self.litellm_model_fast,
                ],
                open_source=_env("AGENT_MODEL_RED_TEAM_OPEN", self.litellm_model_llama_governance),
                rationale="Adversarial challenge benefits from strong critique and instruction following.",
            ),
            "ethicist": AgentModelProfile(
                primary=_env("AGENT_MODEL_ETHICIST", self.litellm_model_primary) or self.litellm_model_primary,
                fallbacks=[
                    _env("AGENT_MODEL_ETHICIST_FALLBACK", self.litellm_model_fast) or self.litellm_model_fast,
                    self.litellm_model_gemini_flash,
                ],
                open_source=_env("AGENT_MODEL_ETHICIST_OPEN", self.litellm_model_llama_governance),
                rationale="Governance and stakeholder language need reliable, cautious drafting.",
            ),
            "cove": AgentModelProfile(
                primary=_env("AGENT_MODEL_COVE", self.litellm_model_gemini_pro) or self.litellm_model_gemini_pro,
                fallbacks=[
                    _env("AGENT_MODEL_COVE_FALLBACK", self.litellm_model_primary) or self.litellm_model_primary,
                    self.litellm_model_phi_reasoning,
                ],
                open_source=_env("AGENT_MODEL_COVE_OPEN", self.litellm_model_phi_reasoning),
                rationale="Verification and self-correction need strongest reasoning path.",
            ),
            "synthesis": AgentModelProfile(
                primary=_env("AGENT_MODEL_SYNTHESIS", self.litellm_model_primary) or self.litellm_model_primary,
                fallbacks=[
                    _env("AGENT_MODEL_SYNTHESIS_FALLBACK", self.litellm_model_gemini_pro) or self.litellm_model_gemini_pro,
                    self.litellm_model_fast,
                ],
                open_source=_env("AGENT_MODEL_SYNTHESIS_OPEN", self.litellm_model_qwen_strategy),
                rationale="Board-ready narrative quality matters most at synthesis time.",
            ),
        }
        profiles["risk_assessment"] = AgentModelProfile(
            primary=_env("AGENT_MODEL_RISK_ASSESSMENT", profiles["risk"].primary) or profiles["risk"].primary,
            fallbacks=[
                _env("AGENT_MODEL_RISK_ASSESSMENT_FALLBACK", profiles["risk"].fallbacks[0]) or profiles["risk"].fallbacks[0],
                profiles["risk"].fallbacks[1],
            ],
            open_source=_env("AGENT_MODEL_RISK_ASSESSMENT_OPEN", profiles["risk"].open_source),
            rationale="Enterprise downside and governance reasoning for ISO-style risk framing.",
        )
        profiles["competitor_analysis"] = AgentModelProfile(
            primary=_env("AGENT_MODEL_COMPETITOR_ANALYSIS", profiles["market_intel"].primary) or profiles["market_intel"].primary,
            fallbacks=[
                _env("AGENT_MODEL_COMPETITOR_ANALYSIS_FALLBACK", profiles["market_intel"].fallbacks[0]) or profiles["market_intel"].fallbacks[0],
                profiles["market_intel"].fallbacks[1],
            ],
            open_source=_env("AGENT_MODEL_COMPETITOR_ANALYSIS_OPEN", profiles["market_intel"].open_source),
            rationale="Competitive scanning favors the same high-throughput research profile as market intelligence.",
        )
        profiles["geo_intel"] = AgentModelProfile(
            primary=_env("AGENT_MODEL_GEO_INTEL", profiles["risk_assessment"].primary) or profiles["risk_assessment"].primary,
            fallbacks=[
                _env("AGENT_MODEL_GEO_INTEL_FALLBACK", profiles["market_intel"].fallbacks[0]) or profiles["market_intel"].fallbacks[0],
                profiles["risk_assessment"].fallbacks[1],
            ],
            open_source=_env("AGENT_MODEL_GEO_INTEL_OPEN", profiles["risk_assessment"].open_source),
            rationale="Geopolitical scanning needs risk-sensitive reasoning with strong research fallback.",
        )
        profiles["financial_reasoning"] = AgentModelProfile(
            primary=_env("AGENT_MODEL_FINANCIAL_REASONING", profiles["quant"].primary) or profiles["quant"].primary,
            fallbacks=[
                _env("AGENT_MODEL_FINANCIAL_REASONING_FALLBACK", profiles["quant"].fallbacks[0]) or profiles["quant"].fallbacks[0],
                profiles["quant"].fallbacks[1],
            ],
            open_source=_env("AGENT_MODEL_FINANCIAL_REASONING_OPEN", profiles["quant"].open_source),
            rationale="Financial reasoning preserves the quant profile for scenario and capital modeling.",
        )
        profiles["strategic_options"] = AgentModelProfile(
            primary=_env("AGENT_MODEL_STRATEGIC_OPTIONS", profiles["strategist"].primary) or profiles["strategist"].primary,
            fallbacks=[
                _env("AGENT_MODEL_STRATEGIC_OPTIONS_FALLBACK", profiles["strategist"].fallbacks[0]) or profiles["strategist"].fallbacks[0],
                profiles["strategist"].fallbacks[1],
            ],
            open_source=_env("AGENT_MODEL_STRATEGIC_OPTIONS_OPEN", profiles["strategist"].open_source),
            rationale="Strategic options reuse the long-context strategist profile for option design and scoring.",
        )
        return profiles


@lru_cache(maxsize=1)
def get_settings() -> Settings:
   