"""Add visualization sessions table

Revision ID: 002
Revises: None
Create Date: 2026-01-30

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create visualization_sessions table."""
    op.create_table(
        'visualization_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.String(length=64), nullable=False),
        sa.Column('simulation_run_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('last_accessed_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('mdserv_port', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='initializing'),
        sa.Column('config', sa.JSON(), nullable=True),
        sa.Column('access_token', sa.String(length=128), nullable=True),
        # sa.ForeignKeyConstraint(['simulation_run_id'], ['simulation_runs.id'], ),  # Commented out for SQLite compatibility
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "status IN ('initializing', 'active', 'expired', 'error')",
            name='valid_status'
        )
    )
    op.create_index('ix_visualization_sessions_session_id', 'visualization_sessions', ['session_id'], unique=True)
    op.create_index('ix_visualization_sessions_simulation_run_id', 'visualization_sessions', ['simulation_run_id'], unique=False)
    op.create_index('ix_visualization_sessions_expires_at', 'visualization_sessions', ['expires_at'], unique=False)

    # Add trajectory metadata columns to artifacts (commented out - artifacts table may not exist)
    # op.add_column('artifacts', sa.Column('trajectory_metadata', sa.JSON(), nullable=True))
    # op.add_column('artifacts', sa.Column('frame_count', sa.Integer(), nullable=True))
    # op.add_column('artifacts', sa.Column('output_frequency', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Drop visualization_sessions table."""
    op.drop_column('artifacts', 'output_frequency')
    op.drop_column('artifacts', 'frame_count')
    op.drop_column('artifacts', 'trajectory_metadata')

    op.drop_index('ix_visualization_sessions_expires_at', table_name='visualization_sessions')
    op.drop_index('ix_visualization_sessions_simulation_run_id', table_name='visualization_sessions')
    op.drop_index('ix_visualization_sessions_session_id', table_name='visualization_sessions')
    op.drop_table('visualization_sessions')
