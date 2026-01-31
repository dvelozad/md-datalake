"""Main GROMACS parser."""

import re
import subprocess
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


class GromacsParser:
    """Parser for GROMACS simulation files."""

    def __init__(self, directory: Path | str):
        """
        Initialize GROMACS parser.

        Args:
            directory: Directory containing GROMACS files
        """
        self.directory = Path(directory)

        if not self.directory.exists():
            raise ParserError(f"Directory not found: {directory}")

    def parse(self) -> dict[str, Any]:
        """
        Parse GROMACS simulation directory.

        Returns:
            Dictionary with metadata and file paths
        """
        metadata: dict[str, Any] = {
            "engine": "GROMACS",
            "files": {},
        }

        # Find MDP file
        mdp_file = self._find_mdp_file()
        if mdp_file:
            metadata["files"]["mdp"] = str(mdp_file)
            mdp_metadata = self._parse_mdp_file(mdp_file)
            metadata.update(mdp_metadata)

        # Find TPR file and parse with gmx dump
        tpr_file = self._find_tpr_file()
        if tpr_file:
            metadata["files"]["tpr"] = str(tpr_file)
            tpr_metadata = self._parse_tpr_file(tpr_file)
            metadata.update(tpr_metadata)

        # Find and parse log file
        log_file = self._find_log_file()
        if log_file:
            metadata["files"]["log"] = str(log_file)
            log_metadata = self._parse_log_file(log_file)
            metadata.update(log_metadata)

        # Find topology file
        top_file = self._find_topology_file()
        if top_file:
            metadata["files"]["topology"] = str(top_file)

        # Find trajectory files
        traj_files = self._find_trajectory_files()
        if traj_files:
            metadata["files"]["trajectories"] = [str(f) for f in traj_files]

        # Classify all artifacts
        metadata["artifacts"] = self._classify_artifacts()

        return metadata

    def _find_mdp_file(self) -> Path | None:
        """Find GROMACS MDP file."""
        mdp_files = list(self.directory.glob("*.mdp"))
        if mdp_files:
            # Prefer mdout.mdp (output from grompp)
            for f in mdp_files:
                if f.name == "mdout.mdp":
                    return f
            return mdp_files[0]

        return None

    def _find_tpr_file(self) -> Path | None:
        """Find GROMACS TPR file."""
        tpr_files = list(self.directory.glob("*.tpr"))
        if tpr_files:
            return tpr_files[0]

        return None

    def _find_log_file(self) -> Path | None:
        """Find GROMACS log file."""
        log_patterns = ["md.log", "*.log"]

        for pattern in log_patterns:
            log_files = list(self.directory.glob(pattern))
            if log_files:
                return log_files[0]

        return None

    def _find_topology_file(self) -> Path | None:
        """Find GROMACS topology file."""
        top_files = list(self.directory.glob("*.top"))
        if top_files:
            return top_files[0]

        return None

    def _find_trajectory_files(self) -> list[Path]:
        """Find GROMACS trajectory files."""
        patterns = ["*.xtc", "*.trr"]
        trajectories = []

        for pattern in patterns:
            trajectories.extend(self.directory.glob(pattern))

        return trajectories

    def _parse_mdp_file(self, mdp_file: Path) -> dict[str, Any]:
        """Parse GROMACS MDP file."""
        metadata: dict[str, Any] = {}

        try:
            with open(mdp_file, "r") as f:
                content = f.read()

            # Parse integrator
            if match := re.search(r"integrator\s*=\s*(\S+)", content, re.IGNORECASE):
                integrator = match.group(1)
                metadata["integrator"] = self._map_integrator(integrator)
                metadata["ensemble"] = self._infer_ensemble_from_integrator(integrator)

            # Parse timestep
            if match := re.search(r"dt\s*=\s*([\d.]+)", content, re.IGNORECASE):
                metadata["timestep"] = float(match.group(1)) * 1000  # Convert ps to fs

            # Parse nsteps
            if match := re.search(r"nsteps\s*=\s*(\d+)", content, re.IGNORECASE):
                metadata["n_steps"] = int(match.group(1))

            # Parse thermostat (tcoupl)
            if match := re.search(r"tcoupl\s*=\s*(\S+)", content, re.IGNORECASE):
                tcoupl = match.group(1)
                metadata["thermostat"] = self._map_thermostat(tcoupl)

            # Parse barostat (pcoupl)
            if match := re.search(r"pcoupl\s*=\s*(\S+)", content, re.IGNORECASE):
                pcoupl = match.group(1)
                metadata["barostat"] = self._map_barostat(pcoupl)

            # Parse reference temperature
            if match := re.search(r"ref[_-]?t\s*=\s*([\d.]+)", content, re.IGNORECASE):
                metadata["temperature_target"] = float(match.group(1))

            # Parse reference pressure
            if match := re.search(r"ref[_-]?p\s*=\s*([\d.]+)", content, re.IGNORECASE):
                metadata["pressure_target"] = float(match.group(1))

            # Parse Coulomb method
            if match := re.search(r"coulombtype\s*=\s*(\S+)", content, re.IGNORECASE):
                coulombtype = match.group(1)
                metadata["coulomb_method"] = self._map_coulomb_type(coulombtype)

            # Parse cutoffs
            if match := re.search(r"rcoulomb\s*=\s*([\d.]+)", content, re.IGNORECASE):
                metadata["cutoff_coulomb"] = float(match.group(1)) * 10  # Convert nm to Angstrom

            if match := re.search(r"rvdw\s*=\s*([\d.]+)", content, re.IGNORECASE):
                metadata["cutoff_vdw"] = float(match.group(1)) * 10  # Convert nm to Angstrom

            # Parse constraints
            if match := re.search(r"constraints\s*=\s*(\S+)", content, re.IGNORECASE):
                metadata["constraint_algorithm"] = match.group(1)

        except Exception as e:
            raise ParserError(f"Failed to parse GROMACS MDP file: {e}")

        return metadata

    def _parse_tpr_file(self, tpr_file: Path) -> dict[str, Any]:
        """
        Parse GROMACS TPR file using gmx dump.

        Note: This requires GROMACS to be installed.
        """
        metadata: dict[str, Any] = {}

        try:
            # Run gmx dump to extract metadata
            result = subprocess.run(
                ["gmx", "dump", "-s", str(tpr_file)],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                output = result.stdout

                # Parse number of atoms
                if match := re.search(r"natoms\s*=\s*(\d+)", output):
                    metadata["n_atoms"] = int(match.group(1))

                # Additional metadata could be extracted here

        except FileNotFoundError:
            # gmx not found, skip TPR parsing
            pass
        except subprocess.TimeoutExpired:
            raise ParserError("gmx dump timed out")
        except Exception as e:
            # Non-fatal error, just skip TPR parsing
            pass

        return metadata

    def _parse_log_file(self, log_file: Path) -> dict[str, Any]:
        """Parse GROMACS log file."""
        metadata: dict[str, Any] = {}

        try:
            with open(log_file, "r") as f:
                content = f.read()

            # Parse GROMACS version
            if match := re.search(r"GROMACS version:\s+([^\s]+)", content):
                metadata["engine_version"] = match.group(1)

            # Parse git commit (if available)
            if match := re.search(r"GIT SHA1 hash:\s+([a-f0-9]+)", content):
                metadata["git_commit"] = match.group(1)

            # Check if simulation completed
            if "Finished mdrun" in content:
                metadata["exit_code"] = 0
            else:
                metadata["exit_code"] = 1

                # Try to find error message
                if match := re.search(r"Fatal error:(.+)", content):
                    metadata["error_message"] = match.group(1).strip()

        except Exception as e:
            raise ParserError(f"Failed to parse GROMACS log file: {e}")

        return metadata

    def _map_integrator(self, integrator: str) -> IntegratorType:
        """Map GROMACS integrator to IntegratorType."""
        mapping = {
            "md": IntegratorType.MD,
            "md-vv": IntegratorType.MD_VV,
            "sd": IntegratorType.SD,
        }

        return mapping.get(integrator.lower(), IntegratorType.MD)

    def _infer_ensemble_from_integrator(self, integrator: str) -> EnsembleType:
        """Infer ensemble from integrator (will be refined with tcoupl/pcoupl)."""
        integrator_lower = integrator.lower()

        if integrator_lower == "md" or integrator_lower == "md-vv":
            return EnsembleType.NVE  # Default, will be updated based on tcoupl/pcoupl

        return EnsembleType.NVE

    def _map_thermostat(self, tcoupl: str) -> ThermostatType:
        """Map GROMACS tcoupl to ThermostatType."""
        mapping = {
            "no": ThermostatType.NONE,
            "berendsen": ThermostatType.BERENDSEN,
            "nose-hoover": ThermostatType.NOSE_HOOVER,
            "v-rescale": ThermostatType.V_RESCALE,
            "andersen": ThermostatType.ANDERSEN,
        }

        return mapping.get(tcoupl.lower(), ThermostatType.NONE)

    def _map_barostat(self, pcoupl: str) -> BarostatType:
        """Map GROMACS pcoupl to BarostatType."""
        mapping = {
            "no": BarostatType.NONE,
            "berendsen": BarostatType.BERENDSEN,
            "parrinello-rahman": BarostatType.PARRINELLO_RAHMAN,
            "mttk": BarostatType.MTTK,
        }

        return mapping.get(pcoupl.lower(), BarostatType.NONE)

    def _map_coulomb_type(self, coulombtype: str) -> CoulombType:
        """Map GROMACS coulombtype to CoulombType."""
        mapping = {
            "cut-off": CoulombType.CUTOFF,
            "cutoff": CoulombType.CUTOFF,
            "pme": CoulombType.PME,
            "ewald": CoulombType.EWALD,
            "reaction-field": CoulombType.REACTION_FIELD,
        }

        return mapping.get(coulombtype.lower(), CoulombType.NONE)

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
        suffix = file_path.suffix.lower()
        name = file_path.name.lower()

        # Trajectories
        if suffix in [".xtc", ".trr", ".dcd"]:
            return ArtifactType.TRAJECTORY

        # Topology files
        if suffix in [".top", ".gro", ".pdb"]:
            return ArtifactType.TOPOLOGY

        # Input files
        if suffix in [".mdp", ".tpr"]:
            return ArtifactType.INPUT

        # Log files
        if "log" in name or suffix == ".log":
            return ArtifactType.LOG

        # Energy files
        if suffix == ".edr":
            return ArtifactType.ENERGY

        # Checkpoint files
        if suffix == ".cpt":
            return ArtifactType.CHECKPOINT

        return ArtifactType.OTHER
