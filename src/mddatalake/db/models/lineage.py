"""Lineage model - parent-child relationships between runs."""

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mddatalake.db.base import Base


class Lineage(Base):
    """Lineage - parent-child relationships (restarts, continuations)."""

    __tablename__ = "lineage"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_run_id: Mapped[int] = mapped_column(
        ForeignKey("simulation_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    child_run_id: Mapped[int] = mapped_column(
        ForeignKey("simulation_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    relationship_type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # restart, continuation, replica
    description: Mapped[str | None] = mapped_column(Text)

    # Relationships
    parent_run: Mapped["SimulationRun"] = relationship(
        "SimulationRun", foreign_keys=[parent_run_id], back_populates="child_lineages"
    )
    child_run: Mapped["SimulationRun"] = relationship(
        "SimulationRun", foreign_keys=[child_run_id], back_populates="parent_lineages"
    )
