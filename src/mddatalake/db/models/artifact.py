"""Artifact model - files associated with runs."""

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mddatalake.core.enums import ArtifactType
from mddatalake.db.base import Base


class Artifact(Base):
    """Artifact - files (trajectories, logs, inputs, checkpoints)."""

    __tablename__ = "artifacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    simulation_run_id: Mapped[int] = mapped_column(
        ForeignKey("simulation_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # File Identification
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)  # Original path
    artifact_type: Mapped[ArtifactType] = mapped_column(
        Enum(ArtifactType, name="artifact_type"), nullable=False, index=True
    )

    # Storage
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False, unique=True, index=True)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    compression: Mapped[str | None] = mapped_column(String(50))  # gzip, zstd, xz, none

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )

    # Preview Frame Cache Fields
    preview_status: Mapped[str | None] = mapped_column(
        String(20), default="pending", index=True
    )
    preview_cache_key: Mapped[str | None] = mapped_column(
        String(512), index=True
    )
    preview_frame_count: Mapped[int | None] = mapped_column(Integer)
    preview_generated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    preview_error_message: Mapped[str | None] = mapped_column(Text)

    # Relationships
    simulation_run: Mapped["SimulationRun"] = relationship("SimulationRun", back_populates="artifacts")
