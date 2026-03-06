"""File validation system for MD simulation uploads."""

from dataclasses import dataclass, field
from pathlib import Path

from mddatalake.core.enums import ArtifactType, ValidationLevel


@dataclass
class ValidationResult:
    """Result of file validation."""

    valid: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)
    deduplicated_artifacts: list[dict] | None = None


class FilesetValidator:
    """Validates simulation file sets for completeness and uniqueness."""

    # Artifact types that must be unique (only one per run)
    STRICT_SINGLETON_TYPES = {
        ArtifactType.TRAJECTORY,
        ArtifactType.TOPOLOGY,
        ArtifactType.INPUT,
        ArtifactType.LOG,
        ArtifactType.ENERGY,
    }

    # Artifact types that can have multiples
    ALLOW_MULTIPLE_TYPES = {
        ArtifactType.CHECKPOINT,
        ArtifactType.ANALYSIS,
        ArtifactType.OTHER,
    }

    def validate_artifacts(
        self,
        artifacts: list[dict],
        engine: str,
        mode: ValidationLevel = ValidationLevel.WARNING,
    ) -> ValidationResult:
        """
        Validate artifact set for duplicates and minimal requirements.

        Args:
            artifacts: List of artifact dicts with 'artifact_type' and 'file_name' keys
            engine: MD engine name ('lammps' or 'gromacs')
            mode: Validation strictness level

        Returns:
            ValidationResult with validation status and messages
        """
        result = ValidationResult(valid=True)

        # Check 1: At least one artifact must be present
        if not artifacts:
            result.valid = False
            result.errors.append("At least one file is required")
            return result

        # Check 2: Duplicate artifact types
        duplicate_result = self._check_duplicates(artifacts, mode)
        result.errors.extend(duplicate_result.errors)
        result.warnings.extend(duplicate_result.warnings)

        # Check 3: Minimal requirements
        minimal_result = self._check_minimal_requirements(artifacts, engine)
        if mode == ValidationLevel.STRICT and minimal_result.errors:
            result.errors.extend(minimal_result.errors)
        else:
            result.warnings.extend(minimal_result.errors)

        # Check 4: Recommended files
        recommendations = self._check_recommended_files(artifacts, engine)
        result.recommendations.extend(recommendations)

        # Set final validity
        if mode == ValidationLevel.STRICT:
            result.valid = len(result.errors) == 0
        else:
            # WARNING and INFO modes always pass validation
            result.valid = True

        # Deduplicate if needed
        if duplicate_result.deduplicated_artifacts:
            result.deduplicated_artifacts = duplicate_result.deduplicated_artifacts

        return result

    def _check_duplicates(
        self, artifacts: list[dict], mode: ValidationLevel
    ) -> ValidationResult:
        """Check for duplicate artifact types."""
        result = ValidationResult(valid=True)

        # Group artifacts by type
        by_type: dict[str, list[dict]] = {}
        for artifact in artifacts:
            artifact_type = artifact.get("artifact_type", ArtifactType.OTHER)
            if artifact_type not in by_type:
                by_type[artifact_type] = []
            by_type[artifact_type].append(artifact)

        # Check for duplicates in singleton types
        deduplicated = []
        for artifact_type, artifact_list in by_type.items():
            if len(artifact_list) > 1 and artifact_type in self.STRICT_SINGLETON_TYPES:
                file_names = [a.get("file_name", "unknown") for a in artifact_list]

                if mode == ValidationLevel.STRICT:
                    result.errors.append(
                        f"Multiple {artifact_type.upper()} files found: {file_names}. "
                        f"Only one {artifact_type} file per run is allowed."
                    )
                else:
                    # WARNING mode: select primary file and warn
                    selected = self._select_primary_file(artifact_list)
                    deduplicated.append(selected)
                    ignored = [a for a in artifact_list if a != selected]
                    result.warnings.append(
                        f"Multiple {artifact_type.upper()} files found. "
                        f"Using '{selected.get('file_name')}'. "
                        f"Ignored: {[a.get('file_name') for a in ignored]}"
                    )
            else:
                # Single file or multiple allowed - keep all
                deduplicated.extend(artifact_list)

        if deduplicated and len(deduplicated) != len(artifacts):
            result.deduplicated_artifacts = deduplicated

        return result

    def _select_primary_file(self, artifacts: list[dict]) -> dict:
        """Select primary file from duplicates (largest or alphabetically first)."""
        # Prefer largest file (likely most complete)
        if all("file_size" in a for a in artifacts):
            return max(artifacts, key=lambda a: a.get("file_size", 0))

        # Fallback: alphabetically first
        return min(artifacts, key=lambda a: a.get("file_name", ""))

    def _check_minimal_requirements(
        self, artifacts: list[dict], engine: str
    ) -> ValidationResult:
        """Check minimal file requirements for engine type."""
        result = ValidationResult(valid=True)

        # Get artifact types present
        present_types = {a.get("artifact_type") for a in artifacts}

        # LAMMPS: TOPOLOGY (data file) is REQUIRED for trajectories
        # Trajectory rendering needs topology for correct molecular structure
        if engine.lower() == "lammps":
            # Must have at least one: trajectory or topology
            if (
                ArtifactType.TRAJECTORY not in present_types
                and ArtifactType.TOPOLOGY not in present_types
            ):
                result.errors.append(
                    "LAMMPS simulations require at least a TRAJECTORY or TOPOLOGY (data file)"
                )

            # If trajectory is present, topology is REQUIRED
            if (
                ArtifactType.TRAJECTORY in present_types
                and ArtifactType.TOPOLOGY not in present_types
            ):
                result.errors.append(
                    "LAMMPS data file (topology) is REQUIRED for trajectory visualization. "
                    "Upload a .data file that contains atom types, bonds, and molecular structure."
                )

        # GROMACS: Need at least TRAJECTORY or TOPOLOGY
        elif engine.lower() == "gromacs":
            if (
                ArtifactType.TRAJECTORY not in present_types
                and ArtifactType.TOPOLOGY not in present_types
            ):
                result.errors.append(
                    "GROMACS simulations require at least a TRAJECTORY or TOPOLOGY file"
                )

        return result

    def _check_recommended_files(
        self, artifacts: list[dict], engine: str
    ) -> list[str]:
        """Generate recommendations for missing recommended files."""
        recommendations = []
        present_types = {a.get("artifact_type") for a in artifacts}

        # Common recommendations for both engines
        if ArtifactType.TRAJECTORY not in present_types:
            recommendations.append(
                "Upload a trajectory file for time-series visualization"
            )

        if ArtifactType.TOPOLOGY not in present_types:
            recommendations.append(
                "Upload a topology file for molecular structure information"
            )

        if ArtifactType.LOG not in present_types:
            recommendations.append(
                "Upload a log file for thermodynamic data and metadata extraction"
            )

        if ArtifactType.INPUT not in present_types:
            recommendations.append(
                "Upload an input script for complete simulation parameter documentation"
            )

        # Engine-specific recommendations
        if engine.lower() == "gromacs":
            if ArtifactType.ENERGY not in present_types:
                recommendations.append(
                    "Upload an energy file (.edr) for detailed thermodynamic analysis"
                )

        return recommendations


ALLOWED_EXTENSIONS = {
    ".dcd",
    ".xtc",
    ".trr",
    ".dump",
    ".lammpstrj",  # Trajectories
    ".pdb",
    ".gro",
    ".data",
    ".lmp",
    ".top",
    ".psf",  # Topology
    ".in",
    ".mdp",
    ".lammps",  # Input scripts
    ".log",
    ".txt",
    ".out",
    ".tpr",
    ".edr",  # Logs & other
}


def validate_file_extension(filename: str) -> bool:
    """Check if file extension is allowed.

    Also allows LAMMPS data files without extension (starting with 'data.')
    and log files without extension (containing 'log').
    """
    path = Path(filename)
    ext = path.suffix.lower()
    name = path.name.lower()

    # Check extension
    if ext in ALLOWED_EXTENSIONS:
        return True

    # Allow LAMMPS data files without extension (e.g., "data.water", "data.system")
    if name.startswith("data."):
        return True

    # Allow log files without extension (e.g., "log_file", "log.lammps")
    if "log" in name:
        return True

    # Allow atom type mapping files
    if name in ["atom_types.json", "atom_dict.json"]:
        return True

    return False


def validate_file_size(size: int, max_size_mb: int = 5000) -> bool:
    """Check if file size is within limits."""
    max_bytes = max_size_mb * 1024 * 1024
    return size <= max_bytes
