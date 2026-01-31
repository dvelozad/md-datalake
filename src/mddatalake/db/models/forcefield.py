"""ForceField model."""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mddatalake.db.base import Base


class ForceField(Base):
    """ForceField - parameterization scheme."""

    __tablename__ = "forcefields"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    version: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)

    # Relationships
    simulation_runs: Mapped[list["SimulationRun"]] = relationship(
        "SimulationRun", back_populates="forcefield"
    )
