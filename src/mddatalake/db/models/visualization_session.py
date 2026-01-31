"""Visualization session database model."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, CheckConstraint
from sqlalchemy.orm import relationship
from mddatalake.db.base import Base


class VisualizationSession(Base):
    """Visualization session for trajectory viewing."""

    __tablename__ = "visualization_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), unique=True, nullable=False, index=True)
    simulation_run_id = Column(Integer, ForeignKey("simulation_runs.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    last_accessed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    mdserv_port = Column(Integer)
    status = Column(String(20), default="initializing", nullable=False)
    config = Column(JSON)
    access_token = Column(String(128))

    # Relationships
    simulation_run = relationship("SimulationRun", back_populates="visualization_sessions")

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('initializing', 'active', 'expired', 'error')",
            name="valid_status"
        ),
    )

    def __repr__(self):
        return f"<VisualizationSession(id={self.id}, session_id={self.session_id}, status={self.status})>"
