"""Project model."""

from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mddatalake.db.base import Base


class Project(Base):
    """Project - organizational unit for related simulations."""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )

    # Relationships
    simulation_runs: Mapped[list["SimulationRun"]] = relationship(
        "SimulationRun", back_populates="project"
    )
