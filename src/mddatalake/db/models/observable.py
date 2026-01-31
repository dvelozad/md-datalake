"""Observable model - computed properties."""

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mddatalake.db.base import Base


class Observable(Base):
    """Observable - computed properties (T, P, density, RMSD, etc.)."""

    __tablename__ = "observables"

    id: Mapped[int] = mapped_column(primary_key=True)
    simulation_run_id: Mapped[int] = mapped_column(
        ForeignKey("simulation_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Observable Identification
    observable_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    observable_type: Mapped[str] = mapped_column(String(100), nullable=False)  # scalar, timeseries

    # Values
    value_scalar: Mapped[float | None] = mapped_column(Float)
    value_mean: Mapped[float | None] = mapped_column(Float)
    value_std: Mapped[float | None] = mapped_column(Float)
    value_min: Mapped[float | None] = mapped_column(Float)
    value_max: Mapped[float | None] = mapped_column(Float)

    # Units
    units: Mapped[str | None] = mapped_column(String(50))

    # Timeseries Reference
    artifact_id: Mapped[int | None] = mapped_column(ForeignKey("artifacts.id"))

    # Relationships
    simulation_run: Mapped["SimulationRun"] = relationship(
        "SimulationRun", back_populates="observables"
    )
