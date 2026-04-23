"""Add data completeness tracking

Revision ID: 004
Revises: 003
Create Date: 2026-01-31

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add data completeness tracking fields to simulation_runs table."""
    # Add completeness score column with index
    op.add_column('simulation_runs', sa.Column('completeness_score', sa.Integer(), nullable=True))
    op.create_index('ix_simulation_runs_completeness_score', 'simulation_runs', ['completeness_score'], unique=False)

    # Add missing_data JSONB column
    op.add_column('simulation_runs', sa.Column('missing_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # Add data_quality_flags JSONB column
    op.add_column('simulation_runs', sa.Column('data_quality_flags', postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # Add check constraint for valid completeness score (0-100)
    op.create_check_constraint(
        'valid_completeness_score',
        'simulation_runs',
        'completeness_score IS NULL OR (completeness_score >= 0 AND completeness_score <= 100)'
    )


def downgrade() -> None:
    """Remove data completeness tracking fields from simulation_runs table."""
    op.drop_constraint('valid_completeness_score', 'simulation_runs')
    op.drop_column('simulation_runs', 'data_quality_flags')
    op.drop_column('simulation_runs', 'missing_data')
    op.drop_index('ix_simulation_runs_completeness_score', table_name='simulation_runs')
    op.drop_column('simulation_runs', 'completeness_score')
