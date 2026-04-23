"""Add simulation method and particle insertion fields

Revision ID: 005
Revises: 004
Create Date: 2026-01-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create simulation_method_type enum with exact Python enum values
    # Note: Using create_type=False because we'll create it explicitly
    from sqlalchemy.dialects import postgresql
    simulation_method_type = postgresql.ENUM('Atomistic', 'H-AdResS', name='simulation_method_type', create_type=False)
    simulation_method_type.create(op.get_bind(), checkfirst=True)

    # Add simulation_method column
    op.add_column('simulation_runs',
        sa.Column('simulation_method', simulation_method_type, nullable=True)
    )
    op.create_index('ix_simulation_runs_simulation_method', 'simulation_runs', ['simulation_method'])

    # Add particle_insertion column
    op.add_column('simulation_runs',
        sa.Column('particle_insertion', sa.Boolean(), nullable=True)
    )
    op.create_index('ix_simulation_runs_particle_insertion', 'simulation_runs', ['particle_insertion'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_simulation_runs_particle_insertion', table_name='simulation_runs')
    op.drop_index('ix_simulation_runs_simulation_method', table_name='simulation_runs')

    # Drop columns
    op.drop_column('simulation_runs', 'particle_insertion')
    op.drop_column('simulation_runs', 'simulation_method')

    # Drop enum type
    sa.Enum(name='simulation_method_type').drop(op.get_bind(), checkfirst=True)
