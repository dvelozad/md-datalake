"""Add timeseries_data to observables

Revision ID: 008
Revises: 007
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add timeseries_data JSONB field to store full timeseries arrays
    op.add_column('observables', sa.Column('timeseries_data', JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column('observables', 'timeseries_data')
