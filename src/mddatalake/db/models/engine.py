"""Engine model - MD software."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mddatalake.db.base import Base


class Engine(Base):
    """Engine - MD software with version tracking."""

    __tablename__ = "engines"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(100), nullable=False)
    git_commit: Mapped[str | None] = mapped_column(String(40))

    # Relationships
    simulation_runs: Mapped[list["SimulationRun"]] = relationship(
        "SimulationRun", back_populates="engine"
    )
