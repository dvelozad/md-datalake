"""SimulationRun model - the core entity."""

from datetime import datetime

from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mddatalake.core.enums import (
    BarostatType,
    CoulombType,
    EnsembleType,
    IntegratorType,
    LammpsAtomStyle,
    SimulationMethodType,
    ThermostatType,
)
from mddatalake.db.base import Base


class SimulationRun(Base):
    """SimulationRun - individual MD simulation with rich metadata."""

    __tablename__ = "simulation_runs"

    # Primary Key
    id: Mapped[int] = mapped_column(primary_key=True)

    # Foreign Keys
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    system_id: Mapped[int] = mapped_column(ForeignKey("systems.id"), nullable=False, index=True)
    forcefield_id: Mapped[int | None] = mapped_column(ForeignKey("forcefields.id"), index=True)
    engine_id: Mapped[int] = mapped_column(ForeignKey("engines.id"), nullable=False, index=True)

    # Run Identification
    run_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    working_directory: Mapped[str] = mapped_column(Text, nullable=False)

    # Simulation Parameters
    ensemble: Mapped[EnsembleType] = mapped_column(
        Enum(EnsembleType, name="ensemble_type"), nullable=False, index=True
    )
    simulation_method: Mapped[SimulationMethodType | None] = mapped_column(
        Enum(SimulationMethodType, name="simulation_method_type"), index=True
    )
    particle_insertion: Mapped[bool | None] = mapped_column(index=True)
    integrator: Mapped[IntegratorType | None] = mapped_column(
        Enum(IntegratorType, name="integrator_type"), index=True
    )
    thermostat: Mapped[ThermostatType | None] = mapped_column(
        Enum(ThermostatType, name="thermostat_type"), index=True
    )
    barostat: Mapped[BarostatType | None] = mapped_column(
        Enum(BarostatType, name="barostat_type"), index=True
    )
    coulomb_method: Mapped[CoulombType | None] = mapped_column(
        Enum(CoulombType, name="coulomb_type"), index=True
    )
    atom_style: Mapped[LammpsAtomStyle | None] = mapped_column(
        Enum(LammpsAtomStyle, name="lammps_atom_style", values_callable=lambda x: [e.value for e in x]), index=True
    )

    # Thermodynamic State Points
    temperature_target: Mapped[float | None] = mapped_column(Float)
    pressure_target: Mapped[float | None] = mapped_column(Float)

    # Time Integration
    timestep: Mapped[float | None] = mapped_column(Float)  # femtoseconds
    n_steps: Mapped[int | None] = mapped_column(Integer)
    total_time: Mapped[float | None] = mapped_column(Float)  # nanoseconds (computed)

    # Cutoffs
    cutoff_coulomb: Mapped[float | None] = mapped_column(Float)  # Angstroms
    cutoff_vdw: Mapped[float | None] = mapped_column(Float)  # Angstroms

    # Box Information
    box_vectors: Mapped[list[float] | None] = mapped_column(ARRAY(Float))  # 9 components

    # Constraints
    constraint_algorithm: Mapped[str | None] = mapped_column(String(100))
    constrained_bonds: Mapped[str | None] = mapped_column(String(100))

    # Random Seed
    random_seed: Mapped[int | None] = mapped_column(Integer)

    # Execution Metadata
    exit_code: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)
    slurm_job_id: Mapped[str | None] = mapped_column(String(100))
    compute_node: Mapped[str | None] = mapped_column(String(255))

    # Data Completeness Tracking
    completeness_score: Mapped[int | None] = mapped_column(Integer, index=True)
    missing_data: Mapped[dict | None] = mapped_column(JSONB)
    data_quality_flags: Mapped[dict | None] = mapped_column(JSONB)

    # LAMMPS Atom Type Mapping (for visualization)
    atom_type_mapping: Mapped[dict | None] = mapped_column(JSONB)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True
    )
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="simulation_runs")
    system: Mapped["System"] = relationship("System", back_populates="simulation_runs")
    forcefield: Mapped["ForceField | None"] = relationship(
        "ForceField", back_populates="simulation_runs"
    )
    engine: Mapped["Engine"] = relationship("Engine", back_populates="simulation_runs")
    artifacts: Mapped[list["Artifact"]] = relationship(
        "Artifact", back_populates="simulation_run", cascade="all, delete-orphan"
    )
    observables: Mapped[list["Observable"]] = relationship(
        "Observable", back_populates="simulation_run", cascade="all, delete-orphan"
    )
    tags: Mapped[list["Tag"]] = relationship(
        "Tag", back_populates="simulation_run", cascade="all, delete-orphan"
    )
    comments: Mapped[list["Comment"]] = relationship(
        "Comment", back_populates="simulation_run", cascade="all, delete-orphan"
    )
    parent_lineages: Mapped[list["Lineage"]] = relationship(
        "Lineage", foreign_keys="Lineage.child_run_id", back_populates="child_run"
    )
    child_lineages: Mapped[list["Lineage"]] = relationship(
        "Lineage", foreign_keys="Lineage.parent_run_id", back_populates="parent_run"
    )
    visualization_sessions: Mapped[list["VisualizationSession"]] = relationship(
        "VisualizationSession", back_populates="simulation_run", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("temperature_target IS NULL OR temperature_target > 0"),
        CheckConstraint("pressure_target IS NULL OR pressure_target >= 0"),
        CheckConstraint("timestep IS NULL OR timestep > 0"),
        CheckConstraint("n_steps IS NULL OR n_steps > 0"),
        CheckConstraint(
            "completeness_score IS NULL OR (completeness_score >= 0 AND completeness_score <= 100)",
            name="valid_completeness_score",
        ),
    )
