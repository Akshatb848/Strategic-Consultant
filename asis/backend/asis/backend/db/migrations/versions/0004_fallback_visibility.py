"""Add fallback visibility columns for analyses and agent logs.

Revision ID: 0004_fallback_visibility
Revises: 0003_cost_tracking_and_cancellation
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004_fallback_visibility"
down_revision = "0003_cost_tracking_and_cancellation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("analyses", sa.Column("used_fallback", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("agent_logs", sa.Column("used_fallback", sa.Boolean(), nullable=False, server_default=sa.false()))

    op.execute("UPDATE agent_logs SET used_fallback = 1 WHERE model_used = 'demo-local'")
    op.execute(
        """
        UPDATE analyses
        SET used_fallback = 1
        WHERE EXISTS (
            SELECT 1
            FROM agent_logs
            WHERE agent_logs.analysis_id = analyses.id
              AND agent_logs.used_fallback = 1
        )
        """
    )

    op.alter_column("analyses", "used_fallback", server_default=None)
    op.alter_column("agent_logs", "used_fallback", server_default=None)


def downgrade() -> None:
    op.drop_column("agent_logs", "used_fallback")
    op.drop_column("analyses", "used_fallback")
