from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from asis.backend.db.base import Base


class Organisation(Base):
    __tablename__ = "organisations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    plan: Mapped[str] = mapped_column(String(32), default="enterprise")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    users: Mapped[list["User"]] = relationship(back_populates="organisation")
    analyses: Mapped[list["Analysis"]] = relationship(back_populates="organisation")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    first_name: Mapped[str] = mapped_column(String(120))
    last_name: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(120), default="")
    role: Mapped[str] = mapped_column(String(120), default="Analyst")
    organisation_name: Mapped[str] = mapped_column(String(255), default="")
    organisation_id: Mapped[str | None] = mapped_column(ForeignKey("organisations.id"), nullable=True)
    plan: Mapped[str] = mapped_column(String(32), default="enterprise")
    avatar_initials: Mapped[str] = mapped_column(String(8), default="")
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(32), default="email")
    google_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    github_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    analysis_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    organisation: Mapped[Organisation | None] = relationship(back_populates="users")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    analyses: Mapped[list["Analysis"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    reports: Mapped[list["Report"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    memory_records: Mapped[list["MemoryRecord"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="refresh_tokens")


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    organisation_id: Mapped[str | None] = mapped_column(ForeignKey("organisations.id"), nullable=True, index=True)
    query: Mapped[str] = mapped_column(Text)
    company_context: Mapped[dict] = mapped_column(JSON, default=dict)
    extracted_context: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="queued", index=True)
    current_agent: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pipeline_version: Mapped[str] = mapped_column(String(16), default="4.0.0")
    run_baseline: Mapped[bool] = mapped_column(Boolean, default=False)
    overall_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    decision_recommendation: Mapped[str | None] = mapped_column(String(32), nullable=True)
    executive_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    board_narrative: Mapped[str | None] = mapped_column(Text, nullable=True)
    strategic_brief: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    self_correction_count: Mapped[int] = mapped_column(Integer, default=0)
    logic_consistency_passed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped[User] = relationship(back_populates="analyses")
    organisation: Mapped[Organisation | None] = relationship(back_populates="analyses")
    agent_logs: Mapped[list["AgentLog"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")
    analysis_events: Mapped[list["AnalysisEvent"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")
    report: Mapped["Report | None"] = relationship(back_populates="analysis", uselist=False, cascade="all, delete-orphan")


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    analysis_id: Mapped[str] = mapped_column(ForeignKey("analyses.id"), index=True)
    agent_id: Mapped[str] = mapped_column(String(64), index=True)
    agent_name: Mapped[str] = mapped_column(String(120))
    event_type: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32))
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tools_called: Mapped[list | None] = mapped_column(JSON, nullable=True)
    langfuse_trace_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    attempt_number: Mapped[int] = mapped_column(Integer, default=1)
    self_corrected: Mapped[bool] = mapped_column(Boolean, default=False)
    correction_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    token_usage: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    citations: Mapped[list | None] = mapped_column(JSON, nullable=True)
    parsed_output: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    analysis: Mapped[Analysis] = relationship(back_populates="agent_logs")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    analysis_id: Mapped[str] = mapped_column(ForeignKey("analyses.id"), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    strategic_brief: Mapped[dict] = mapped_column(JSON)
    evaluation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    pdf_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    pdf_status: Mapped[str] = mapped_column(String(32), default="ready")
    pdf_progress: Mapped[int] = mapped_column(Integer, default=0)
    pdf_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    pdf_generated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    report_version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    analysis: Mapped[Analysis] = relationship(back_populates="report")
    user: Mapped[User] = relationship(back_populates="reports")


class MemoryRecord(Base):
    __tablename__ = "memory_records"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    scope: Mapped[str] = mapped_column(String(64), default="profile")
    key: Mapped[str] = mapped_column(String(120))
    value: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="memory_records")


class AnalysisEvent(Base):
    __tablename__ = "analysis_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    analysis_id: Mapped[str] = mapped_column(ForeignKey("analyses.id"), index=True)
    event_name: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    timestamp_ms: Mapped[int] = mapped_column(Integer, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    analysis: Mapped[Analysis] = relationship(back_populates="analysis_events")
