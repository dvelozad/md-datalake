"""Allow artifact reuse across runs

Revision ID: 009
Revises: 008
Create Date: 2026-02-02

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Remove unique constraint on storage_key to allow artifact reuse."""
    op.drop_index('ix_artifacts_storage_key', table_name='artifacts')
    # Recreate as non-unique index for performance
    op.create_index('ix_artifacts_storage_key', 'artifacts', ['storage_key'], unique=False)


def downgrade() -> None:
    """Restore unique constraint on storage_key."""
    op.drop_index('ix_artifacts_storage_key', table_name='artifacts')
    op.create_index('ix_artifacts_storage_key', 'artifacts', ['storage_key'], unique=True)
