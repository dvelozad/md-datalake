"""Tag model - flexible labeling."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mddatalake.db.base import Base


class Tag(Base):
    """Tag - flexible labeling (production, validated, needs-review)."""

    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    simulation_run_id: Mapped[int] = mapped_column(
        ForeignKey("simulation_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tag_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )

    # Relationships
    simulation_run: Mapped["SimulationRun"] = relationship("SimulationRun", back_populates="tags")
