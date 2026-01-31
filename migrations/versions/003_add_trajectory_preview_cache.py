"""Add trajectory preview cache fields

Revision ID: 003
Revises: 002
Create Date: 2026-01-30

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add preview cache fields to artifacts table."""
    # Add preview status column
    op.add_column('artifacts', sa.Column('preview_status', sa.String(length=20), nullable=True, server_default='pending'))
    op.create_index('ix_artifacts_preview_status', 'artifacts', ['preview_status'], unique=False)

    # Add preview cache key column
    op.add_column('artifacts', sa.Column('preview_cache_key', sa.String(length=512), nullable=True))
    op.create_index('ix_artifacts_preview_cache_key', 'artifacts', ['preview_cache_key'], unique=False)

    # Add preview frame count column
    op.add_column('artifacts', sa.Column('preview_frame_count', sa.Integer(), nullable=True))

    # Add preview generated timestamp column
    op.add_column('artifacts', sa.Column('preview_generated_at', sa.DateTime(timezone=True), nullable=True))

    # Add preview error message column
    op.add_column('artifacts', sa.Column('preview_error_message', sa.Text(), nullable=True))

    # Add check constraint for valid preview status values
    op.create_check_constraint(
        'valid_preview_status',
        'artifacts',
        "preview_status IN ('pending', 'processing', 'ready', 'failed', 'n/a')"
    )


def downgrade() -> None:
    """Remove preview cache fields from artifacts table."""
    op.drop_constraint('valid_preview_status', 'artifacts')
    op.drop_column('artifacts', 'preview_error_message')
    op.drop_column('artifacts', 'preview_generated_at')
    op.drop_column('artifacts', 'preview_frame_count')
    op.drop_index('ix_artifacts_preview_cache_key', table_name='artifacts')
    op.drop_column('artifacts', 'preview_cache_key')
    op.drop_index('ix_artifacts_preview_status', table_name='artifacts')
    op.drop_column('artifacts', 'preview_status')
