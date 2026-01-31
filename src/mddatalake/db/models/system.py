"""System model - chemical composition."""

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mddatalake.db.base import Base


class System(Base):
    """System - chemical composition and topology."""

    __tablename__ = "systems"

    id: Mapped[int] = mapped_column(primary_key=True)
    composition_hash: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    composition_description: Mapped[str] = mapped_column(Text, nullable=False)
    n_atoms: Mapped[int] = mapped_column(Integer, nullable=False)
    n_molecules: Mapped[int | None] = mapped_column(Integer)
    molecule_counts: Mapped[str | None] = mapped_column(Text)  # JSON string

    # Relationships
    simulation_runs: Mapped[list["SimulationRun"]] = relationship(
        "SimulationRun", back_populates="system"
    )
