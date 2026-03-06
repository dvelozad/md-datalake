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
    LammpsAtomStyle,
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
            # Check if trajectory has molecule IDs
            metadata["has_molecule_ids"] = self._check_trajectory_molecule_ids(traj_files[0])
        else:
            metadata["has_molecule_ids"] = False

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
        # Try common log file names
        log_file = self.directory / "log.lammps"
        if log_file.exists():
            return log_file

        # Try to find files matching log.* pattern
        log_files = list(self.directory.glob("log.*"))
        if log_files:
            return log_files[0]

        # Try to find files containing "log" in the name
        for file_path in self.directory.glob("*log*"):
            if file_path.is_file():
                return file_path

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

            # Parse number of atoms
            if match := re.search(r"reading atoms\s*\.\.\.\s*\n\s*(\d+)\s+atoms", content):
                metadata["n_atoms"] = int(match.group(1))

            # Parse total number of steps from "Loop time" line
            if match := re.search(r"Loop time.*for\s+(\d+)\s+steps", content):
                metadata["n_steps"] = int(match.group(1))

            # Parse box dimensions
            if match := re.search(r"orthogonal box = \(([^)]+)\) to \(([^)]+)\)", content):
                try:
                    lo = [float(x) for x in match.group(1).split()]
                    hi = [float(x) for x in match.group(2).split()]
                    metadata["box_dimensions"] = {
                        "xlo": lo[0], "xhi": hi[0],
                        "ylo": lo[1], "yhi": hi[1],
                        "zlo": lo[2], "zhi": hi[2],
                        "lx": hi[0] - lo[0],
                        "ly": hi[1] - lo[1],
                        "lz": hi[2] - lo[2],
                    }
                except (IndexError, ValueError):
                    pass

            # Parse integrator from "Setting up X run" line
            if match := re.search(r"Setting up (\w+) run", content):
                integrator_name = match.group(1).lower()
                if integrator_name == "verlet":
                    metadata["integrator"] = IntegratorType.VERLET
                elif integrator_name == "respa":
                    metadata["integrator"] = IntegratorType.RESPA

            # Parse timestep from echoed commands (if present)
            if match := re.search(r"timestep\s+([\d.]+)", content, re.IGNORECASE):
                metadata["timestep"] = float(match.group(1))

            # Parse units from echoed commands (if present)
            if match := re.search(r"units\s+(\w+)", content, re.IGNORECASE):
                metadata["units"] = match.group(1)
            # Otherwise infer from performance metrics
            elif "ns/day" in content:
                metadata["units"] = "real"  # ns/day indicates real units
            elif "ps/day" in content:
                metadata["units"] = "metal"  # ps/day indicates metal units

            # Calculate timestep from performance metrics if available
            # Example: "Performance: 1.299 ns/day, 18.473 hours/ns, 15.037 timesteps/s"
            if not metadata.get("timestep"):
                perf_match = re.search(
                    r"Performance:.*?([\d.]+)\s+ns/day.*?([\d.]+)\s+timesteps/s",
                    content
                )
                if perf_match:
                    ns_per_day = float(perf_match.group(1))
                    timesteps_per_sec = float(perf_match.group(2))
                    # ns/day to fs/s: 1 ns = 1e6 fs, 1 day = 86400 s
                    fs_per_sec = (ns_per_day * 1e6) / 86400
                    # fs/s divided by timesteps/s gives fs/timestep
                    timestep_fs = fs_per_sec / timesteps_per_sec
                    metadata["timestep"] = round(timestep_fs, 2)

            # Extract thermodynamic data once for multiple uses
            thermodynamic_data = self._extract_thermodynamic_data(content)

            # Parse temperature from echoed commands (if present)
            if match := re.search(r"temp(?:/initial)?\s+([\d.]+)", content, re.IGNORECASE):
                metadata["temperature_target"] = float(match.group(1))
            # Otherwise extract from thermodynamic output as estimate
            elif not metadata.get("temperature_target"):
                if "Temp" in thermodynamic_data and thermodynamic_data["Temp"].get("data"):
                    temps = thermodynamic_data["Temp"]["data"]
                    # Use mean of temperature values as target estimate
                    if temps and len(temps) > 0 and all(isinstance(t, (int, float)) for t in temps):
                        try:
                            import statistics
                            metadata["temperature_target"] = round(statistics.mean(temps), 2)
                        except (TypeError, ValueError):
                            pass  # Skip if data isn't numeric

            # Parse pressure from echoed commands (if present)
            if match := re.search(r"press(?:ure)?\s+([\d.]+)", content, re.IGNORECASE):
                metadata["pressure_target"] = float(match.group(1))
            # Otherwise extract from thermodynamic output as estimate
            elif not metadata.get("pressure_target"):
                if "Press" in thermodynamic_data and thermodynamic_data["Press"].get("data"):
                    pressures = thermodynamic_data["Press"]["data"]
                    # Use mean of pressure values as target estimate
                    if pressures and len(pressures) > 0 and all(isinstance(p, (int, float)) for p in pressures):
                        try:
                            import statistics
                            metadata["pressure_target"] = round(statistics.mean(pressures), 2)
                        except (TypeError, ValueError):
                            pass  # Skip if data isn't numeric

            # Detect thermostat from echoed fix commands (if present)
            if not metadata.get("thermostat"):
                metadata["thermostat"] = self._detect_thermostat(content)

            # Detect barostat from echoed fix commands (if present)
            if not metadata.get("barostat"):
                metadata["barostat"] = self._detect_barostat(content)

            # Detect ensemble from thermodynamic output
            if not metadata.get("ensemble"):
                if "Volume" in thermodynamic_data and thermodynamic_data["Volume"].get("data"):
                    volumes = thermodynamic_data["Volume"]["data"]
                    # If volume varies by more than 0.1%, it's NPT
                    if len(volumes) > 1 and all(isinstance(v, (int, float)) for v in volumes):
                        try:
                            import statistics
                            vol_std = statistics.stdev(volumes)
                            vol_mean = statistics.mean(volumes)
                            if vol_std / vol_mean > 0.001:  # More than 0.1% variation
                                metadata["ensemble"] = EnsembleType.NPT
                            else:
                                metadata["ensemble"] = EnsembleType.NVT
                        except (TypeError, ValueError, ZeroDivisionError):
                            pass  # Skip if data isn't numeric or mean is zero
                    elif len(volumes) >= 1:
                        # Single point or few points, check if pressure is present
                        if "Press" in thermodynamic_data and thermodynamic_data["Press"].get("data"):
                            metadata["ensemble"] = EnsembleType.NVT  # Has pressure but constant volume
                        else:
                            metadata["ensemble"] = EnsembleType.NVE  # No pressure, constant volume

            # Calculate total simulation time if we have both timestep and n_steps
            if metadata.get("timestep") and metadata.get("n_steps"):
                # timestep is in fs, convert to ns for total_time
                total_time_fs = metadata["timestep"] * metadata["n_steps"]
                metadata["total_time"] = total_time_fs / 1e6  # Convert fs to ns

            # Check exit status
            if "Total wall time:" in content:
                metadata["exit_code"] = 0
            else:
                metadata["exit_code"] = 1
                # Try to find error message
                if match := re.search(r"ERROR:(.+)", content):
                    metadata["error_message"] = match.group(1).strip()

            # Store thermodynamic data
            metadata["thermodynamic_data"] = thermodynamic_data

        except Exception as e:
            raise ParserError(f"Failed to parse LAMMPS log file: {e}")

        return metadata

    def _extract_thermodynamic_data(self, content: str) -> dict[str, Any]:
        """
        Extract thermodynamic timeseries from LAMMPS log file.

        Returns:
            Dictionary with timeseries data for each thermodynamic property
        """
        thermo_data: dict[str, Any] = {}
        lines = content.split('\n')

        # Find thermodynamic output section (starts with "Step")
        header_idx = None
        for i, line in enumerate(lines):
            if re.match(r'\s*Step\s+', line):
                header_idx = i
                break

        if header_idx is None:
            return {}

        # Parse column headers
        header_line = lines[header_idx].strip()
        columns = header_line.split()

        # Initialize data arrays for each column
        for col in columns:
            thermo_data[col] = []

        # Parse data rows (until we hit a non-numeric line)
        for line in lines[header_idx + 1:]:
            line = line.strip()

            # Stop at empty lines or non-numeric lines
            if not line or line.startswith('Loop') or line.startswith('---'):
                break

            # Try to parse as numeric data
            try:
                values = line.split()
                if len(values) == len(columns):
                    for col, val in zip(columns, values):
                        thermo_data[col].append(float(val))
            except ValueError:
                # Hit a non-numeric line, stop parsing
                break

        # Map LAMMPS column names to standard observable names and units
        observable_mapping = {
            'Step': {'name': 'Step', 'units': 'timesteps'},
            'Temp': {'name': 'Temperature', 'units': 'K'},
            'Press': {'name': 'Pressure', 'units': 'bar'},
            'Volume': {'name': 'Volume', 'units': 'Å³'},
            'Density': {'name': 'Density', 'units': 'g/cm³'},
            'E_pair': {'name': 'Pair Energy', 'units': 'kcal/mol'},
            'E_mol': {'name': 'Molecular Energy', 'units': 'kcal/mol'},
            'TotEng': {'name': 'Total Energy', 'units': 'kcal/mol'},
            'KinEng': {'name': 'Kinetic Energy', 'units': 'kcal/mol'},
            'PotEng': {'name': 'Potential Energy', 'units': 'kcal/mol'},
            'E_bond': {'name': 'Bond Energy', 'units': 'kcal/mol'},
            'E_angle': {'name': 'Angle Energy', 'units': 'kcal/mol'},
            'E_dihed': {'name': 'Dihedral Energy', 'units': 'kcal/mol'},
            'E_vdwl': {'name': 'Van der Waals Energy', 'units': 'kcal/mol'},
            'E_coul': {'name': 'Coulomb Energy', 'units': 'kcal/mol'},
            'E_long': {'name': 'Long-range Energy', 'units': 'kcal/mol'},
        }

        # Create standardized observable data
        observables = {}
        for lammps_col, data in thermo_data.items():
            if lammps_col in observable_mapping:
                obs_info = observable_mapping[lammps_col]
                observables[lammps_col] = {
                    'name': obs_info['name'],
                    'units': obs_info['units'],
                    'data': data,
                }

        return observables

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

            # Check for bonds and angles (for completeness tracking)
            metadata["has_bonds_angles"] = self._check_bonds_angles(lines)

            # Detect atom style from Atoms section header
            metadata["atom_style"] = self._detect_atom_style(lines)

            # Parse box bounds (simplified)
            # This would need more sophisticated parsing for full implementation

        except Exception as e:
            raise ParserError(f"Failed to parse LAMMPS data file: {e}")

        return metadata

    def _detect_atom_style(self, lines: list[str]) -> str | None:
        """Detect LAMMPS atom style from data file.

        Looks for the Atoms section header which may contain atom style info.
        Example: "Atoms  # full" or "Atoms  # full/gc/HAdResS"

        Args:
            lines: Lines from data file

        Returns:
            Atom style string if detected, None otherwise
        """
        for line in lines:
            # Look for Atoms section header with style comment
            if match := re.match(r"^Atoms\s*#\s*(.+)", line.strip()):
                atom_style = match.group(1).strip()
                # Validate against known atom styles
                try:
                    # Try to match to enum value
                    for style in LammpsAtomStyle:
                        if style.value == atom_style:
                            return atom_style
                    # If not found but has format, return it anyway (might be custom)
                    return atom_style
                except Exception:
                    pass
        return None

    def _check_bonds_angles(self, lines: list[str]) -> bool:
        """Check if data file contains bond or angle definitions."""
        for line in lines[:30]:  # Check first 30 lines for header info
            # Look for lines like "1234 bonds" or "5678 angles"
            if re.match(r"\s*\d+\s+(bonds|angles)", line.lower()):
                return True
        return False

    def _check_trajectory_molecule_ids(self, traj_file: Path) -> bool:
        """Check if trajectory file contains molecule ID column.

        Args:
            traj_file: Path to LAMMPS dump file

        Returns:
            True if 'mol' column is present in ITEM: ATOMS line
        """
        try:
            with open(traj_file, "r") as f:
                # Read first 20 lines to find ITEM: ATOMS header
                for _ in range(20):
                    line = f.readline()
                    if not line:
                        break
                    if line.startswith("ITEM: ATOMS"):
                        # Check if 'mol' is in the column list
                        return "mol" in line.lower()
        except Exception:
            pass
        return False

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

        # Enforce single topology file rule
        # Prefer data.* files over .lmp files as topology
        topology_artifacts = [a for a in artifacts if a["artifact_type"] == ArtifactType.TOPOLOGY]
        if len(topology_artifacts) > 1:
            # Find data.* file (preferred topology)
            data_file = next((a for a in topology_artifacts if a["file_name"].lower().startswith("data.")), None)
            # Reclassify other topology files as OTHER
            for artifact in artifacts:
                if artifact["artifact_type"] == ArtifactType.TOPOLOGY:
                    if data_file and artifact["file_name"] != data_file["file_name"]:
                        artifact["artifact_type"] = ArtifactType.OTHER

        return artifacts

    def _classify_file(self, file_path: Path) -> ArtifactType:
        """Classify file as artifact type."""
        name = file_path.name.lower()
        suffix = file_path.suffix.lower()
        stem = file_path.stem.lower()  # filename without extension

        # Trajectories
        if suffix in [".dump", ".lammpstrj", ".dcd", ".xtc"] or "traj" in name:
            return ArtifactType.TRAJECTORY

        # Input scripts (check BEFORE topology, as .lmp can be either)
        if suffix in [".in", ".mdp", ".lammps"]:
            return ArtifactType.INPUT
        if name.startswith("in.") or stem.startswith("in"):
            return ArtifactType.INPUT
        # .lmp files that are input scripts
        if suffix == ".lmp":
            # Explicitly check stem for input script patterns
            if stem in ["run", "input"] or stem.startswith("in") or "run" in stem or "input" in stem:
                return ArtifactType.INPUT

        # Topology/data files
        if name.startswith("data.") or suffix == ".data":
            return ArtifactType.TOPOLOGY
        # .lmp files with "data" in stem are topology files
        if suffix == ".lmp" and "data" in stem:
            return ArtifactType.TOPOLOGY

        # Log files
        if "log" in name:
            return ArtifactType.LOG

        # Checkpoint/restart files
        if "restart" in name or suffix == ".restart":
            return ArtifactType.CHECKPOINT

        return ArtifactType.OTHER
