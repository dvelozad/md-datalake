"""Enhance projects table and add project_collaborators.

Revision ID: 011
Revises: 010
Create Date: 2026-04-23
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("pi_name", sa.String(255), nullable=True))
    op.add_column("projects", sa.Column("institution", sa.String(255), nullable=True))
    op.add_column("projects", sa.Column("grant_number", sa.String(100), nullable=True))
    op.add_column("projects", sa.Column("funding_source", sa.String(255), nullable=True))
    op.add_column("projects", sa.Column("keywords", postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column(
        "projects",
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "projects",
        sa.Column(
            "created_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("projects", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "project_collaborators",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("role", sa.String(50), nullable=False, server_default="viewer"),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("project_id", "user_id", name="uq_project_collaborator"),
    )


def downgrade() -> None:
    op.drop_table("project_collaborators")
    op.drop_column("projects", "updated_at")
    op.drop_column("projects", "created_by_id")
    op.drop_column("projects", "is_public")
    op.drop_column("projects", "keywords")
    op.drop_column("projects", "funding_source")
    op.drop_column("projects", "grant_number")
    op.drop_column("projects", "institution")
    op.drop_column("projects", "pi_name")
