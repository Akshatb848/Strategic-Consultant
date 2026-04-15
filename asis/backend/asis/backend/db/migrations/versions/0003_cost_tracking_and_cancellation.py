"""Add cost tracking columns to agent_logs and analyses.

Revision ID: 0003_cost_tracking_and_cancellation
Revises: 0002_v4_reporting_and_events
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003_cost_tracking_and_cancellation"
down_revision = "0002_v4_reporting_and_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Per-agent token counts and cost
    op.add_column("agent_logs", sa.Column("tokens_in", sa.Integer(), nullable=True))
    op.add_column("agent_logs", sa.Column("tokens_out", sa.Integer(), nullable=True))
    op.add_column("agent_logs", sa.Column("cost_usd", sa.Float(), nullable=True))

    # Per-analysis aggregated cost and cancellation timestamp
    op.add_column("analyses", sa.Column("total_cost_usd", sa.Float(), nullable=True))
    op.add_column("analyses", sa.Column("cancelled_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("analyses", "cancelled_at")
    op.drop_column("analyses", "total_cost_usd")
    op.drop_column("agent_logs", "cost_usd")
    op.drop_column("agent_logs", "tokens_out")
    op.drop_column("agent_logs", "tokens_in")
