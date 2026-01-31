"""Comment model - user annotations."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mddatalake.db.base import Base


class Comment(Base):
    """Comment - user annotations."""

    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    simulation_run_id: Mapped[int] = mapped_column(
        ForeignKey("simulation_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )

    # Relationships
    simulation_run: Mapped["SimulationRun"] = relationship("SimulationRun", back_populates="comments")
