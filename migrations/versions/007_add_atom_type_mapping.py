"""Add atom_type_mapping field for LAMMPS visualization

Revision ID: 007
Revises: 006
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add atom_type_mapping column to simulation_runs table
    op.add_column(
        'simulation_runs',
        sa.Column(
            'atom_type_mapping',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment='Mapping of LAMMPS atom types to element names and visualization properties'
        )
    )


def downgrade() -> None:
    # Drop the column
    op.drop_column('simulation_runs', 'atom_type_mapping')
