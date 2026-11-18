"""Add Indian cinema metadata and AI-ready show fields.

Revision ID: 20261117_01
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "20261117_01"
down_revision = None
branch_labels = None
depends_on = None


def _has_table(inspector, table):
    return table in inspector.get_table_names()


def _add_column_if_missing(inspector, table, column, definition):
    if _has_table(inspector, table) and column not in {c["name"] for c in inspector.get_columns(table)}:
        op.add_column(table, definition)


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    # The migration is designed for the existing CineBook MVP schema.
    # Fresh databases should be initialized from current SQLAlchemy metadata and stamped.
    _add_column_if_missing(inspector, "theatres", "state", sa.Column("state", sa.String(80), nullable=True))
    _add_column_if_missing(inspector, "theatres", "circuit", sa.Column("circuit", sa.String(100), nullable=True))
    _add_column_if_missing(inspector, "theatres", "latitude", sa.Column("latitude", sa.Float(), nullable=True))
    _add_column_if_missing(inspector, "theatres", "longitude", sa.Column("longitude", sa.Float(), nullable=True))
    _add_column_if_missing(inspector, "screens", "projection_format", sa.Column("projection_format", sa.String(40), nullable=False, server_default="Digital 2K"))
    _add_column_if_missing(inspector, "screens", "sound_system", sa.Column("sound_system", sa.String(60), nullable=False, server_default="Dolby Digital"))
    _add_column_if_missing(inspector, "screens", "screen_width_ft", sa.Column("screen_width_ft", sa.Float(), nullable=True))
    _add_column_if_missing(inspector, "screens", "screen_height_ft", sa.Column("screen_height_ft", sa.Float(), nullable=True))
    _add_column_if_missing(inspector, "screens", "accessible_seat_labels", sa.Column("accessible_seat_labels", sa.Text(), nullable=False, server_default=""))
    _add_column_if_missing(inspector, "shows", "format", sa.Column("format", sa.String(30), nullable=False, server_default="2D"))
    # Infer state for common cities without overwriting unknown or manually curated values.
    if _has_table(inspector, "theatres") and "state" in {c["name"] for c in inspector.get_columns("theatres")}:
        op.execute("UPDATE theatres SET state = CASE lower(city) WHEN 'pune' THEN 'Maharashtra' WHEN 'mumbai' THEN 'Maharashtra' WHEN 'bengaluru' THEN 'Karnataka' WHEN 'bangalore' THEN 'Karnataka' WHEN 'hyderabad' THEN 'Telangana' WHEN 'chennai' THEN 'Tamil Nadu' WHEN 'delhi' THEN 'Delhi NCR' ELSE state END WHERE state IS NULL")


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table, columns in {
        "shows": ["format"],
        "screens": ["accessible_seat_labels", "screen_height_ft", "screen_width_ft", "sound_system", "projection_format"],
        "theatres": ["longitude", "latitude", "circuit", "state"],
    }.items():
        if table not in inspector.get_table_names():
            continue
        existing = {c["name"] for c in inspector.get_columns(table)}
        for column in columns:
            if column in existing:
                op.drop_column(table, column)
