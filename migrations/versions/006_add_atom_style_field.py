"""Add atom_style field for LAMMPS data format

Revision ID: 006
Revises: 005
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the enum type for LAMMPS atom styles
    lammps_atom_style_enum = postgresql.ENUM(
        'atomic',
        'bond',
        'angle',
        'molecular',
        'full',
        'charge',
        'dipole',
        'sphere',
        'ellipsoid',
        'full/gc/HAdResS',
        name='lammps_atom_style',
        create_type=True
    )
    lammps_atom_style_enum.create(op.get_bind(), checkfirst=True)

    # Add atom_style column to simulation_runs table
    op.add_column(
        'simulation_runs',
        sa.Column(
            'atom_style',
            sa.Enum(
                'atomic',
                'bond',
                'angle',
                'molecular',
                'full',
                'charge',
                'dipole',
                'sphere',
                'ellipsoid',
                'full/gc/HAdResS',
                name='lammps_atom_style'
            ),
            nullable=True
        )
    )

    # Create index on atom_style for faster queries
    op.create_index(
        'ix_simulation_runs_atom_style',
        'simulation_runs',
        ['atom_style'],
        unique=False
    )


def downgrade() -> None:
    # Drop the index
    op.drop_index('ix_simulation_runs_atom_style', table_name='simulation_runs')

    # Drop the column
    op.drop_column('simulation_runs', 'atom_style')

    # Drop the enum type
    op.execute('DROP TYPE IF EXISTS lammps_atom_style')
