"""Project model."""

from datetime import datetime

from sqlalchemy import ARRAY, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mddatalake.db.base import Base


class Project(Base):
    """Project - organizational unit for related simulations."""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    pi_name: Mapped[str | None] = mapped_column(String(255))
    institution: Mapped[str | None] = mapped_column(String(255))
    grant_number: Mapped[str | None] = mapped_column(String(100))
    funding_source: Mapped[str | None] = mapped_column(String(255))
    keywords: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    simulation_runs: Mapped[list["SimulationRun"]] = relationship(
        "SimulationRun", back_populates="project"
    )
    created_by: Mapped["User | None"] = relationship(
        "User", foreign_keys=[created_by_id]
    )
    collaborators: Mapped[list["ProjectCollaborator"]] = relationship(
        "ProjectCollaborator", back_populates="project", cascade="all, delete-orphan"
    )
