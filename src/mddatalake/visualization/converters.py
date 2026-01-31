"""Trajectory format conversion utilities."""

import logging
from pathlib import Path
from typing import Tuple, Optional
import hashlib

logger = logging.getLogger(__name__)


class TrajectoryConverter:
    """
    Convert trajectory files to formats compatible with NGL Viewer.

    Supported conversions:
    - LAMMPS dump -> DCD
    - GROMACS native formats (XTC, TRR) -> no conversion needed
    """

    def __init__(self, cache_dir: Optional[Path] = None):
        """
        Initialize converter.

        Args:
            cache_dir: Directory to cache converted files. Defaults to /tmp/trajectory_cache
        """
        self.cache_dir = cache_dir or Path("/tmp/trajectory_cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    async def convert_if_needed(
        self,
        trajectory_path: Path,
        topology_path: Path,
        engine: str,
        first_frame_only: bool = False,
    ) -> Tuple[Path, Path]:
        """
        Convert trajectory to viewer-compatible format if needed.

        Args:
            trajectory_path: Path to trajectory file
            topology_path: Path to topology file
            engine: MD engine name (LAMMPS or GROMACS)
            first_frame_only: If True, convert only the first frame for faster loading

        Returns:
            Tuple of (converted_trajectory, converted_topology)

        Raises:
            ValueError: If engine not supported
            FileNotFoundError: If input files don't exist
        """
        if not trajectory_path.exists():
            raise FileNotFoundError(f"Trajectory file not found: {trajectory_path}")

        if not topology_path.exists():
            raise FileNotFoundError(f"Topology file not found: {topology_path}")

        engine = engine.upper()

        # Check if trajectory and topology are the same file (static structure case)
        if trajectory_path == topology_path:
            logger.info(f"Static structure (same file for trajectory and topology), no conversion needed: {trajectory_path}")
            return trajectory_path, topology_path

        if engine == "GROMACS":
            # GROMACS files are already compatible
            logger.info(f"GROMACS trajectory, no conversion needed: {trajectory_path}")
            return trajectory_path, topology_path

        elif engine == "LAMMPS":
            # LAMMPS dump needs conversion to DCD
            return await self._convert_lammps_to_dcd(
                trajectory_path, topology_path, first_frame_only=first_frame_only
            )

        else:
            raise ValueError(f"Unsupported engine: {engine}")

    async def _convert_lammps_to_dcd(
        self,
        dump_file: Path,
        data_file: Path,
        first_frame_only: bool = False,
    ) -> Tuple[Path, Path]:
        """
        Convert LAMMPS dump file to DCD format.

        Args:
            dump_file: LAMMPS dump file
            data_file: LAMMPS data file (topology) - can be DATA or PDB format
            first_frame_only: If True, convert only the first frame

        Returns:
            Tuple of (dcd_file, pdb_file)
        """
        try:
            import MDAnalysis as mda
        except ImportError:
            raise ImportError(
                "MDAnalysis is required for LAMMPS conversion. "
                "Install with: pip install MDAnalysis"
            )

        # Generate cache keys based on file checksums
        dump_checksum = self._compute_checksum(dump_file)
        data_checksum = self._compute_checksum(data_file)
        cache_key = f"{dump_checksum}_{data_checksum}"
        if first_frame_only:
            cache_key += "_first_frame"

        # Check cache
        cached_dcd = self.cache_dir / f"{cache_key}.dcd"
        cached_pdb = self.cache_dir / f"{cache_key}.pdb"

        if cached_dcd.exists() and cached_pdb.exists():
            logger.info(f"Using cached conversion: {cached_dcd}")
            return cached_dcd, cached_pdb

        logger.info(f"Converting LAMMPS dump to DCD: {dump_file}")

        try:
            # Detect topology format based on file extension
            topology_format = None
            if data_file.suffix.lower() == '.pdb':
                topology_format = "PDB"
                logger.info(f"Detected PDB topology format")
            elif data_file.suffix.lower() in ['.data', '.lmp']:
                topology_format = "DATA"
                logger.info(f"Detected LAMMPS DATA topology format")

            # Load LAMMPS trajectory
            if topology_format == "PDB":
                # If topology is already PDB, just convert trajectory to DCD
                universe = mda.Universe(
                    str(data_file),
                    str(dump_file),
                    format="LAMMPSDUMP",
                    atom_style="id type x y z"
                )
                # Use existing PDB as topology (just copy it)
                import shutil
                shutil.copy(str(data_file), str(cached_pdb))
                logger.info(f"Using existing PDB topology: {cached_pdb}")
            else:
                # DATA format for topology, LAMMPSDUMP for trajectory
                universe = mda.Universe(
                    str(data_file),
                    str(dump_file),
                    topology_format="DATA",
                    format="LAMMPSDUMP",
                    atom_style="id type x y z"
                )
                # Write topology as PDB
                logger.info(f"Writing topology to PDB: {cached_pdb}")
                with mda.Writer(str(cached_pdb), universe.atoms.n_atoms) as pdb_writer:
                    pdb_writer.write(universe.atoms)

            # Write trajectory as DCD
            if first_frame_only:
                logger.info(f"Writing first frame only to DCD: {cached_dcd}")
                with mda.Writer(str(cached_dcd), universe.atoms.n_atoms) as dcd_writer:
                    universe.trajectory[0]  # Go to first frame
                    dcd_writer.write(universe.atoms)
            else:
                logger.info(f"Writing trajectory to DCD: {cached_dcd}")
                with mda.Writer(str(cached_dcd), universe.atoms.n_atoms) as dcd_writer:
                    for ts in universe.trajectory:
                        dcd_writer.write(universe.atoms)

            logger.info("Conversion complete")
            return cached_dcd, cached_pdb

        except Exception as e:
            logger.error(f"Conversion failed: {e}")
            # Clean up partial files
            if cached_dcd.exists():
                cached_dcd.unlink()
            if cached_pdb.exists():
                cached_pdb.unlink()
            raise

    def _compute_checksum(self, file_path: Path) -> str:
        """Compute SHA-256 checksum of a file."""
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()[:16]  # First 16 chars

    async def get_trajectory_metadata(
        self,
        trajectory_path: Path,
        topology_path: Path,
        engine: str,
    ) -> dict:
        """
        Extract trajectory metadata (frame count, atom count, etc.).

        Args:
            trajectory_path: Path to trajectory file
            topology_path: Path to topology file
            engine: MD engine name

        Returns:
            Dictionary with metadata
        """
        try:
            import MDAnalysis as mda
        except ImportError:
            raise ImportError("MDAnalysis is required for metadata extraction")

        engine = engine.upper()

        try:
            if engine == "GROMACS":
                universe = mda.Universe(str(topology_path), str(trajectory_path))
            elif engine == "LAMMPS":
                # Detect topology format
                if topology_path.suffix.lower() == '.pdb':
                    universe = mda.Universe(
                        str(topology_path),
                        str(trajectory_path),
                        format="LAMMPSDUMP",
                        atom_style="id type x y z"
                    )
                else:
                    universe = mda.Universe(
                        str(topology_path),
                        str(trajectory_path),
                        topology_format="DATA",
                        format="LAMMPSDUMP",
                        atom_style="id type x y z"
                    )
            else:
                raise ValueError(f"Unsupported engine: {engine}")

            metadata = {
                "n_atoms": universe.atoms.n_atoms,
                "n_frames": len(universe.trajectory),
                "dt": universe.trajectory.dt,  # timestep in ps
                "total_time": universe.trajectory.totaltime,  # total time in ps
                "format": trajectory_path.suffix[1:],  # Remove leading dot
            }

            logger.info(f"Extracted metadata: {metadata}")
            return metadata

        except Exception as e:
            logger.error(f"Failed to extract metadata: {e}")
            # Return minimal metadata
            return {
                "n_atoms": 0,
                "n_frames": 0,
                "dt": 0.0,
                "total_time": 0.0,
                "format": trajectory_path.suffix[1:],
                "error": str(e)
            }
