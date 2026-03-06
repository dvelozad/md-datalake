"""Enum types matching PostgreSQL schema."""

import enum


class EnsembleType(str, enum.Enum):
    """Statistical ensemble types."""

    NVE = "NVE"
    NVT = "NVT"
    NPT = "NPT"
    NPH = "NPH"
    MUVT = "muVT"
    NVT_NVE = "NVT_NVE"


class ThermostatType(str, enum.Enum):
    """Thermostat algorithms."""

    NONE = "none"
    NOSE_HOOVER = "nose_hoover"
    BERENDSEN = "berendsen"
    LANGEVIN = "langevin"
    V_RESCALE = "v_rescale"
    ANDERSEN = "andersen"
    BUSSI = "bussi"
    CSVR = "csvr"


class BarostatType(str, enum.Enum):
    """Barostat algorithms."""

    NONE = "none"
    NOSE_HOOVER = "nose_hoover"
    BERENDSEN = "berendsen"
    PARRINELLO_RAHMAN = "parrinello_rahman"
    MTTK = "mttk"
    LANGEVIN = "langevin"


class IntegratorType(str, enum.Enum):
    """Time integration algorithms."""

    VERLET = "verlet"
    VELOCITY_VERLET = "velocity_verlet"
    LEAP_FROG = "leap_frog"
    RESPA = "respa"
    RATTLE = "rattle"
    SHAKE = "shake"
    MD = "md"
    MD_VV = "md-vv"
    SD = "sd"


class CoulombType(str, enum.Enum):
    """Coulombic interaction methods."""

    CUTOFF = "cutoff"
    EWALD = "ewald"
    PPPM = "pppm"
    PME = "pme"
    P3M = "p3m"
    REACTION_FIELD = "reaction_field"
    NONE = "none"


class SimulationMethodType(str, enum.Enum):
    """Simulation method types."""

    ATOMISTIC = "ATOMISTIC"  # PostgreSQL enum uses uppercase names
    H_ADRESS = "H_ADRESS"  # PostgreSQL enum uses uppercase with underscore


class ArtifactType(str, enum.Enum):
    """Artifact file types."""

    TRAJECTORY = "trajectory"
    TOPOLOGY = "topology"
    INPUT = "input"
    LOG = "log"
    CHECKPOINT = "checkpoint"
    ENERGY = "energy"
    ANALYSIS = "analysis"
    OTHER = "other"


class ValidationLevel(str, enum.Enum):
    """Validation strictness levels."""

    STRICT = "strict"      # Block upload with HTTP 422 error
    WARNING = "warning"    # Allow but show warnings
    INFO = "info"          # Allow with informational messages


class LammpsAtomStyle(str, enum.Enum):
    """LAMMPS atom style formats."""

    ATOMIC = "atomic"
    BOND = "bond"
    ANGLE = "angle"
    MOLECULAR = "molecular"
    FULL = "full"
    CHARGE = "charge"
    DIPOLE = "dipole"
    SPHERE = "sphere"
    ELLIPSOID = "ellipsoid"
    FULL_GC_HADRESS = "full/gc/HAdResS"  # H-AdResS custom atom style
