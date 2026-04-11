from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "organisations",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=True),
        sa.Column("plan", sa.String(length=32), nullable=False, server_default="enterprise"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_organisations_name", "organisations", ["name"], unique=True)
    op.create_index("ix_organisations_domain", "organisations", ["domain"], unique=False)
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("first_name", sa.String(length=120), nullable=False),
        sa.Column("last_name", sa.String(length=120), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("role", sa.String(length=120), nullable=False, server_default="Analyst"),
        sa.Column("organisation_name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("organisation_id", sa.String(length=64), sa.ForeignKey("organisations.id"), nullable=True),
        sa.Column("plan", sa.String(length=32), nullable=False, server_default="enterprise"),
        sa.Column("avatar_initials", sa.String(length=8), nullable=False, server_default=""),
        sa.Column("avatar_url", sa.String(length=512), nullable=True),
        sa.Column("auth_provider", sa.String(length=32), nullable=False, server_default="email"),
        sa.Column("google_id", sa.String(length=255), nullable=True),
        sa.Column("github_id", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("analysis_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_google_id", "users", ["google_id"], unique=True)
    op.create_index("ix_users_github_id", "users", ["github_id"], unique=True)
    op.create_index("ix_users_organisation_id", "users", ["organisation_id"], unique=False)
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"], unique=False)
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)
    op.create_table(
        "analyses",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("organisation_id", sa.String(length=64), sa.ForeignKey("organisations.id"), nullable=True),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("company_context", sa.JSON(), nullable=False),
        sa.Column("extracted_context", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="queued"),
        sa.Column("current_agent", sa.String(length=64), nullable=True),
        sa.Column("pipeline_version", sa.String(length=16), nullable=False, server_default="4.0.0"),
        sa.Column("run_baseline", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("overall_confidence", sa.Float(), nullable=True),
        sa.Column("decision_recommendation", sa.String(length=32), nullable=True),
        sa.Column("executive_summary", sa.Text(), nullable=True),
        sa.Column("board_narrative", sa.Text(), nullable=True),
        sa.Column("strategic_brief", sa.JSON(), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("self_correction_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("logic_consistency_passed", sa.Boolean(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_analyses_user_id", "analyses", ["user_id"], unique=False)
    op.create_index("ix_analyses_organisation_id", "analyses", ["organisation_id"], unique=False)
    op.create_index("ix_analyses_status", "analyses", ["status"], unique=False)
    op.create_index("ix_analyses_created_at", "analyses", ["created_at"], unique=False)
    op.create_table(
        "agent_logs",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("analysis_id", sa.String(length=64), sa.ForeignKey("analyses.id"), nullable=False),
        sa.Column("agent_id", sa.String(length=64), nullable=False),
        sa.Column("agent_name", sa.String(length=120), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("attempt_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("self_corrected", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("correction_reason", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("token_usage", sa.JSON(), nullable=True),
        sa.Column("citations", sa.JSON(), nullable=True),
        sa.Column("parsed_output", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_agent_logs_analysis_id", "agent_logs", ["analysis_id"], unique=False)
    op.create_index("ix_agent_logs_agent_id", "agent_logs", ["agent_id"], unique=False)
    op.create_index("ix_agent_logs_created_at", "agent_logs", ["created_at"], unique=False)
    op.create_table(
        "reports",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("analysis_id", sa.String(length=64), sa.ForeignKey("analyses.id"), nullable=False),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("strategic_brief", sa.JSON(), nullable=False),
        sa.Column("evaluation", sa.JSON(), nullable=True),
        sa.Column("pdf_url", sa.String(length=512), nullable=True),
        sa.Column("report_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_reports_analysis_id", "reports", ["analysis_id"], unique=True)
    op.create_index("ix_reports_user_id", "reports", ["user_id"], unique=False)
    op.create_table(
        "memory_records",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("scope", sa.String(length=64), nullable=False, server_default="profile"),
        sa.Column("key", sa.String(length=120), nullable=False),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_memory_records_user_id", "memory_records", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_table("memory_records")
    op.drop_table("reports")
    op.drop_table("agent_logs")
    op.drop_table("analyses")
    op.drop_table("refresh_tokens")
    op.drop_table("users")
    op.drop_table("organisations")
