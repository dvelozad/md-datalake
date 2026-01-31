"""Main LAMMPS parser."""

import re
from pathlib import Path
from typing import Any

from mddatalake.core.enums import (
    ArtifactType,
    BarostatType,
    CoulombType,
    EnsembleType,
    IntegratorType,
    ThermostatType,
)
from mddatalake.core.exceptions import ParserError


class LammpsParser:
    """Parser for LAMMPS simulation files."""

    def __init__(self, directory: Path | str):
        """
        Initialize LAMMPS parser.

        Args:
            directory: Directory containing LAMMPS files
        """
        self.directory = Path(directory)

        if not self.directory.exists():
            raise ParserError(f"Directory not found: {directory}")

    def parse(self) -> dict[str, Any]:
        """
        Parse LAMMPS simulation directory.

        Returns:
            Dictionary with metadata and file paths
        """
        metadata: dict[str, Any] = {
            "engine": "LAMMPS",
            "files": {},
        }

        # Find input script
        input_file = self._find_input_file()
        if input_file:
            metadata["files"]["input"] = str(input_file)
            input_metadata = self._parse_input_script(input_file)
            metadata.update(input_metadata)

        # Find and parse log file
        log_file = self._find_log_file()
        if log_file:
            metadata["files"]["log"] = str(log_file)
            log_metadata = self._parse_log_file(log_file)
            metadata.update(log_metadata)

        # Find data file (topology)
        data_file = self._find_data_file()
        if data_file:
            metadata["files"]["data"] = str(data_file)
            data_metadata = self._parse_data_file(data_file)
            metadata.update(data_metadata)

        # Find trajectory files
        traj_files = self._find_trajectory_files()
        if traj_files:
            metadata["files"]["trajectories"] = [str(f) for f in traj_files]

        # Classify all artifacts
        metadata["artifacts"] = self._classify_artifacts()

        return metadata

    def _find_input_file(self) -> Path | None:
        """Find LAMMPS input script."""
        patterns = ["in.*.lammps", "in.*"]

        for pattern in patterns:
            files = list(self.directory.glob(pattern))
            if files:
                return files[0]

        return None

    def _find_log_file(self) -> Path | None:
        """Find LAMMPS log file."""
        log_file = self.directory / "log.lammps"
        if log_file.exists():
            return log_file

        # Try to find any log file
        log_files = list(self.directory.glob("log.*"))
        if log_files:
            return log_files[0]

        return None

    def _find_data_file(self) -> Path | None:
        """Find LAMMPS data file."""
        patterns = ["data.*.lmp", "data.*"]

        for pattern in patterns:
            files = list(self.directory.glob(pattern))
            if files:
                return files[0]

        return None

    def _find_trajectory_files(self) -> list[Path]:
        """Find LAMMPS trajectory files."""
        patterns = ["*.dump", "*.lammpstrj", "traj.*"]
        trajectories = []

        for pattern in patterns:
            trajectories.extend(self.directory.glob(pattern))

        return trajectories

    def _parse_input_script(self, input_file: Path) -> dict[str, Any]:
        """Parse LAMMPS input script."""
        metadata: dict[str, Any] = {}

        try:
            with open(input_file, "r") as f:
                content = f.read()

            # Detect ensemble
            metadata["ensemble"] = self._detect_ensemble(content)

            # Parse timestep
            if match := re.search(r"timestep\s+([\d.]+)", content, re.IGNORECASE):
                metadata["timestep"] = float(match.group(1))

            # Parse run steps
            if match := re.search(r"run\s+(\d+)", content, re.IGNORECASE):
                metadata["n_steps"] = int(match.group(1))

            # Parse thermostat
            metadata["thermostat"] = self._detect_thermostat(content)

            # Parse barostat
            metadata["barostat"] = self._detect_barostat(content)

            # Parse temperature
            if match := re.search(r"temp(?:/initial)?\s+([\d.]+)", content, re.IGNORECASE):
                metadata["temperature_target"] = float(match.group(1))

            # Parse pressure (for NPT)
            if match := re.search(r"press(?:ure)?\s+([\d.]+)", content, re.IGNORECASE):
                metadata["pressure_target"] = float(match.group(1))

            # Parse pair style (for Coulomb method detection)
            if match := re.search(r"pair_style\s+(\S+)", content):
                pair_style = match.group(1)
                metadata["pair_style"] = pair_style

            # Parse kspace style (for Coulomb method)
            metadata["coulomb_method"] = self._detect_coulomb_method(content)

            # Parse cutoffs
            if match := re.search(r"pair_modify.*cut\s+([\d.]+)", content):
                metadata["cutoff_vdw"] = float(match.group(1))

        except Exception as e:
            raise ParserError(f"Failed to parse LAMMPS input script: {e}")

        return metadata

    def _parse_log_file(self, log_file: Path) -> dict[str, Any]:
        """Parse LAMMPS log file."""
        metadata: dict[str, Any] = {}

        try:
            with open(log_file, "r") as f:
                content = f.read()

            # Parse version
            if match := re.search(r"LAMMPS\s+\(([^)]+)\)", content):
                metadata["engine_version"] = match.group(1)

            # Check exit status
            if "Total wall time:" in content:
                metadata["exit_code"] = 0
            else:
                metadata["exit_code"] = 1
                # Try to find error message
                if match := re.search(r"ERROR:(.+)", content):
                    metadata["error_message"] = match.group(1).strip()

        except Exception as e:
            raise ParserError(f"Failed to parse LAMMPS log file: {e}")

        return metadata

    def _parse_data_file(self, data_file: Path) -> dict[str, Any]:
        """Parse LAMMPS data file."""
        metadata: dict[str, Any] = {}

        try:
            with open(data_file, "r") as f:
                lines = f.readlines()

            # Parse number of atoms
            for line in lines[:20]:  # Check first 20 lines
                if match := re.match(r"\s*(\d+)\s+atoms", line):
                    metadata["n_atoms"] = int(match.group(1))
                    break

            # Parse box bounds (simplified)
            # This would need more sophisticated parsing for full implementation

        except Exception as e:
            raise ParserError(f"Failed to parse LAMMPS data file: {e}")

        return metadata

    def _detect_ensemble(self, content: str) -> EnsembleType:
        """Detect ensemble from input script."""
        content_lower = content.lower()

        # Check for fix npt
        if re.search(r"fix\s+\S+\s+\S+\s+npt", content_lower):
            return EnsembleType.NPT

        # Check for fix nvt
        if re.search(r"fix\s+\S+\s+\S+\s+nvt", content_lower):
            return EnsembleType.NVT

        # Check for fix nph
        if re.search(r"fix\s+\S+\s+\S+\s+nph", content_lower):
            return EnsembleType.NPH

        # Default to NVE if no thermostat/barostat
        return EnsembleType.NVE

    def _detect_thermostat(self, content: str) -> ThermostatType:
        """Detect thermostat from input script."""
        content_lower = content.lower()

        if "fix" in content_lower and ("nvt" in content_lower or "npt" in content_lower):
            # LAMMPS fix nvt/npt uses Nose-Hoover by default
            return ThermostatType.NOSE_HOOVER

        if "fix" in content_lower and "langevin" in content_lower:
            return ThermostatType.LANGEVIN

        if "fix" in content_lower and "temp/berendsen" in content_lower:
            return ThermostatType.BERENDSEN

        return ThermostatType.NONE

    def _detect_barostat(self, content: str) -> BarostatType:
        """Detect barostat from input script."""
        content_lower = content.lower()

        if "fix" in content_lower and ("npt" in content_lower or "nph" in content_lower):
            # LAMMPS fix npt/nph uses Nose-Hoover by default
            return BarostatType.NOSE_HOOVER

        if "fix" in content_lower and "press/berendsen" in content_lower:
            return BarostatType.BERENDSEN

        return BarostatType.NONE

    def _detect_coulomb_method(self, content: str) -> CoulombType:
        """Detect Coulomb method from input script."""
        content_lower = content.lower()

        if "kspace_style" in content_lower:
            if "pppm" in content_lower:
                return CoulombType.PPPM
            elif "ewald" in content_lower:
                return CoulombType.EWALD

        if "pair_style" in content_lower and "coul/cut" in content_lower:
            return CoulombType.CUTOFF

        return CoulombType.NONE

    def _classify_artifacts(self) -> list[dict[str, Any]]:
        """Classify all files in directory as artifacts."""
        artifacts = []

        for file_path in self.directory.iterdir():
            if not file_path.is_file():
                continue

            artifact_type = self._classify_file(file_path)
            artifacts.append(
                {
                    "file_name": file_path.name,
                    "file_path": str(file_path),
                    "artifact_type": artifact_type,
                }
            )

        return artifacts

    def _classify_file(self, file_path: Path) -> ArtifactType:
        """Classify file as artifact type."""
        name = file_path.name.lower()
        suffix = file_path.suffix.lower()

        # Trajectories
        if suffix in [".dump", ".lammpstrj", ".dcd", ".xtc"] or "traj" in name:
            return ArtifactType.TRAJECTORY

        # Topology/data files
        if suffix == ".lmp" or name.startswith("data."):
            return ArtifactType.TOPOLOGY

        # Input scripts
        if name.startswith("in.") or suffix == ".lammps":
            return ArtifactType.INPUT

        # Log files
        if "log" in name:
            return ArtifactType.LOG

        # Checkpoint/restart files
        if "restart" in name or suffix == ".restart":
            return ArtifactType.CHECKPOINT

        return ArtifactType.OTHER
