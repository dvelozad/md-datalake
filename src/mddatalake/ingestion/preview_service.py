"""Preview extraction service for trajectory files."""

import logging
import shutil
import tempfile
from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mddatalake.core.config import settings
from mddatalake.db.models import Artifact
from mddatalake.storage.backend import StorageBackend
from mddatalake.utils.checksum import compute_checksum

logger = logging.getLogger(__name__)


class PreviewExtractionService:
    """Service for extracting trajectory preview frames."""

    def __init__(self, db: AsyncSession, storage: StorageBackend):
        """
        Initialize preview extraction service.

        Args:
            db: Database session
            storage: Storage backend
        """
        self.db = db
        self.storage = storage
        self.config = settings

    async def extract_preview(
        self,
        artifact: Artifact,
        topology_artifact: Artifact | None = None
    ) -> bool:
        """
        Extract preview frames for a trajectory artifact.

        Steps:
        1. Check if artifact is trajectory type
        2. Verify file size < max threshold
        3. Update status to 'processing'
        4. Download trajectory + topology from storage
        5. Extract N frames using MDAnalysis
        6. Save preview to cache directory
        7. Upload preview to storage backend
        8. Update artifact with preview metadata
        9. Set status to 'ready' or 'failed'

        Args:
            artifact: Trajectory artifact to extract preview from
            topology_artifact: Optional topology artifact (auto-detected if None)

        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if trajectory
            from mddatalake.core.enums import ArtifactType
            if artifact.artifact_type != ArtifactType.TRAJECTORY:
                logger.info(f"Artifact {artifact.id} is not a trajectory ({artifact.artifact_type})")
                artifact.preview_status = "n/a"
                await self.db.commit()
                return False

            # Check file size
            max_size_bytes = self.config.preview_max_file_size_mb * 1024 * 1024
            if artifact.file_size_bytes > max_size_bytes:
                logger.info(
                    f"Artifact {artifact.id} too large for preview "
                    f"({artifact.file_size_bytes} bytes > {max_size_bytes} bytes)"
                )
                artifact.preview_status = "n/a"
                await self.db.commit()
                return False

            # Update status to processing
            artifact.preview_status = "processing"
            await self.db.commit()

            # Download files to temp location
            temp_dir = Path(tempfile.mkdtemp(prefix="preview_"))
            try:
                trajectory_path = temp_dir / artifact.file_name
                await self.storage.download(artifact.storage_key, trajectory_path)

                # Get topology artifact
                if not topology_artifact:
                    topology_artifact = await self._find_topology_artifact(artifact.simulation_run_id)

                if not topology_artifact:
                    raise ValueError("Topology artifact not found")

                topology_path = temp_dir / topology_artifact.file_name
                await self.storage.download(topology_artifact.storage_key, topology_path)

                # Extract frames
                output_format = self.config.preview_format
                output_path = temp_dir / f"preview_{artifact.id}.{output_format}"

                # Get engine name from simulation run
                await self.db.refresh(artifact, ["simulation_run"])
                await self.db.refresh(artifact.simulation_run, ["engine"])
                engine_name = artifact.simulation_run.engine.name

                await self._extract_frames(
                    trajectory_path,
                    topology_path,
                    output_path,
                    engine_name=engine_name,
                    frame_count=self.config.preview_frame_count
                )

                # Upload preview to storage
                preview_checksum = compute_checksum(output_path)
                preview_key = await self.storage.upload(
                    output_path,
                    f"previews/artifact_{artifact.id}",
                    preview_checksum
                )

                # Update artifact
                artifact.preview_cache_key = preview_key
                artifact.preview_frame_count = self.config.preview_frame_count
                artifact.preview_generated_at = datetime.utcnow()
                artifact.preview_status = "ready"
                await self.db.commit()

                logger.info(f"Preview extracted for artifact {artifact.id}")
                return True

            finally:
                # Cleanup temp directory
                shutil.rmtree(temp_dir, ignore_errors=True)

        except Exception as e:
            logger.error(f"Preview extraction failed for artifact {artifact.id}: {e}")
            artifact.preview_status = "failed"
            artifact.preview_error_message = str(e)
            await self.db.commit()
            return False

    async def _extract_frames(
        self,
        trajectory_path: Path,
        topology_path: Path,
        output_path: Path,
        engine_name: str,
        frame_count: int
    ) -> None:
        """
        Extract first N frames using MDAnalysis.

        Args:
            trajectory_path: Path to trajectory file
            topology_path: Path to topology file
            output_path: Path to output preview file
            engine_name: Engine name (LAMMPS, GROMACS, etc.)
            frame_count: Number of frames to extract
        """
        import MDAnalysis as mda

        # Load universe based on engine
        engine_upper = engine_name.upper()

        if engine_upper == "LAMMPS":
            # LAMMPS-specific loading
            if topology_path.suffix.lower() == '.pdb':
                universe = mda.Universe(
                    str(topology_path),
                    str(trajectory_path),
                    format="LAMMPSDUMP",
                    atom_style="id type x y z"
                )
            else:
                # LAMMPS data file as topology
                universe = mda.Universe(
                    str(topology_path),
                    str(trajectory_path),
                    topology_format="DATA",
                    format="LAMMPSDUMP",
                    atom_style="id type x y z"
                )
        elif engine_upper == "GROMACS":
            # GROMACS-specific loading
            universe = mda.Universe(str(topology_path), str(trajectory_path))
        else:
            # Generic loading (try to auto-detect)
            universe = mda.Universe(str(topology_path), str(trajectory_path))

        # Extract frames
        actual_frames = min(frame_count, len(universe.trajectory))

        # Determine output format
        if output_path.suffix.lower() == ".pdb":
            output_format = "PDB"
        elif output_path.suffix.lower() == ".dcd":
            output_format = "DCD"
        else:
            output_format = "PDB"  # Default to PDB

        with mda.Writer(str(output_path), universe.atoms.n_atoms, format=output_format) as writer:
            for i in range(actual_frames):
                universe.trajectory[i]
                writer.write(universe.atoms)

        logger.info(f"Extracted {actual_frames} frames to {output_path}")

    async def _find_topology_artifact(self, run_id: int) -> Artifact | None:
        """
        Find topology artifact for a simulation run.

        Args:
            run_id: Simulation run ID

        Returns:
            Topology artifact or None if not found
        """
        from mddatalake.core.enums import ArtifactType
        result = await self.db.execute(
            select(Artifact)
            .where(Artifact.simulation_run_id == run_id)
            .where(Artifact.artifact_type == ArtifactType.TOPOLOGY)
        )
        return result.scalar_one_or_none()
