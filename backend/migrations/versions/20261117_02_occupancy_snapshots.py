"""Add time-series show occupancy observations for crowd model training.

Revision ID: 20261117_02
Revises: 20261117_01
"""
from alembic import op
import sqlalchemy as sa
revision = "20261117_02"
down_revision = "20261117_01"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "show_occupancy_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("show_id", sa.Integer(), sa.ForeignKey("shows.id", ondelete="CASCADE"), nullable=False),
        sa.Column("captured_at", sa.DateTime(), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("occupied_seats", sa.Integer(), nullable=False),
        sa.Column("fill_rate", sa.Float(), nullable=False),
        sa.Column("hours_to_start", sa.Float(), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("start_hour", sa.Integer(), nullable=False),
        sa.Column("is_weekend", sa.Boolean(), nullable=False),
        sa.Column("show_format", sa.String(30), nullable=False, server_default="2D"),
        sa.Column("language", sa.String(40), nullable=False, server_default="English"),
        sa.Column("city", sa.String(80), nullable=False, server_default=""),
    )
    op.create_index("ix_show_occupancy_snapshots_show_id", "show_occupancy_snapshots", ["show_id"])
    op.create_index("ix_show_occupancy_snapshots_captured_at", "show_occupancy_snapshots", ["captured_at"])
    op.create_index("ix_occupancy_show_captured", "show_occupancy_snapshots", ["show_id", "captured_at"])

def downgrade():
    op.drop_index("ix_occupancy_show_captured", table_name="show_occupancy_snapshots")
    op.drop_index("ix_show_occupancy_snapshots_captured_at", table_name="show_occupancy_snapshots")
    op.drop_index("ix_show_occupancy_snapshots_show_id", table_name="show_occupancy_snapshots")
    op.drop_table("show_occupancy_snapshots")
