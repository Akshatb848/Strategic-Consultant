from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_v4_reporting_and_events"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agent_logs", sa.Column("model_used", sa.String(length=255), nullable=True))
    op.add_column("agent_logs", sa.Column("tools_called", sa.JSON(), nullable=True))
    op.add_column("agent_logs", sa.Column("langfuse_trace_id", sa.String(length=255), nullable=True))

    op.add_column("reports", sa.Column("pdf_status", sa.String(length=32), nullable=False, server_default="ready"))
    op.add_column("reports", sa.Column("pdf_progress", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("reports", sa.Column("pdf_error", sa.Text(), nullable=True))
    op.add_column("reports", sa.Column("pdf_generated_at", sa.DateTime(), nullable=True))

    op.create_table(
        "analysis_events",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("analysis_id", sa.String(length=64), sa.ForeignKey("analyses.id"), nullable=False),
        sa.Column("event_name", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("timestamp_ms", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_analysis_events_analysis_id", "analysis_events", ["analysis_id"], unique=False)
    op.create_index("ix_analysis_events_event_name", "analysis_events", ["event_name"], unique=False)
    op.create_index("ix_analysis_events_timestamp_ms", "analysis_events", ["timestamp_ms"], unique=False)
    op.create_index("ix_analysis_events_created_at", "analysis_events", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_table("analysis_events")
    op.drop_column("reports", "pdf_generated_at")
    op.drop_column("reports", "pdf_error")
    op.drop_column("reports", "pdf_progress")
    op.drop_column("reports", "pdf_status")
    op.drop_column("agent_logs", "langfuse_trace_id")
    op.drop_column("agent_logs", "tools_called")
    op.drop_column("agent_logs", "model_used")
