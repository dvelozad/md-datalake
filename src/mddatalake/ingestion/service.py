"""Main ingestion service - orchestrates 5-stage pipeline."""

import asyncio
import hashlib
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from mddatalake.core.config import settings
from mddatalake.core.enums import ArtifactType, EnsembleType
from mddatalake.core.exceptions import IngestionError
from mddatalake.db.models import Artifact, Engine, ForceField, Project, SimulationRun, System
from mddatalake.ingestion.scenario_detector import ScenarioDetector
from mddatalake.parsers import GromacsParser, LammpsParser, detect_engine
from mddatalake.storage import FilesystemBackend, S3Backend, StorageBackend
from mddatalake.utils.checksum import compute_checksum


class IngestionService:
    """Service for ingesting MD simulations into the database."""

    def __init__(self, db_session: AsyncSession, storage_backend: StorageBackend | None = None):
        """
        Initialize ingestion service.

        Args:
            db_session: Database session
            storage_backend: Storage backend (defaults to configured backend)
        """
        self.db = db_session

        # Initialize storage backend
        if storage_backend:
            self.storage = storage_backend
        elif settings.storage_backend == "s3":
            self.storage = S3Backend()
        else:
            self.storage = FilesystemBackend(settings.storage_root)

    async def ingest(
        self,
        directory: Path | str,
        project_name: str,
        run_name: str | None = None,
        description: str | None = None,
        atom_style: str | None = None,  # Optional LAMMPS atom style override
        simulation_method: str | None = None,  # Optional simulation method override
        ensemble: str | None = None,  # Optional ensemble type override
        temperature_target: float | None = None,  # Optional temperature target override
        pressure_target: float | None = None,  # Optional pressure target override
        user_artifact_types: dict[str, str] | None = None,  # User-provided artifact type overrides
    ) -> int:
        """
        Ingest a simulation directory (5-stage pipeline).

        Args:
            directory: Directory containing simulation files
            project_name: Project name
            run_name: Optional run name (defaults to directory name)
            description: Optional run description
            atom_style: Optional LAMMPS atom style (overrides auto-detection)
            simulation_method: Optional simulation method (overrides auto-detection)
            ensemble: Optional ensemble type (overrides auto-detection)
            temperature_target: Optional temperature target (overrides auto-detection)
            pressure_target: Optional pressure target (overrides auto-detection)

        Returns:
            Simulation run ID

        Raises:
            IngestionError: If ingestion fails
        """
        directory = Path(directory)

        if not directory.exists() or not directory.is_dir():
            raise IngestionError(f"Directory not found: {directory}")

        # Check for ingestion marker
        marker_file = directory / ".mddatalake_ingested"
        if marker_file.exists():
            raise IngestionError(f"Directory already ingested: {directory}")

        # Stage 1: Discovery & Validation
        engine_name = detect_engine(directory)

        # Stage 2: Metadata Extraction
        metadata = self._extract_metadata(directory, engine_name)

        # Override atom_style if provided by user (for LAMMPS)
        if atom_style:
            metadata["atom_style"] = atom_style

        # Override simulation parameters if provided by user
        if simulation_method:
            metadata["simulation_method"] = simulation_method
        if ensemble:
            metadata["ensemble"] = ensemble
        if temperature_target is not None:
            metadata["temperature_target"] = temperature_target
        if pressure_target is not None:
            metadata["pressure_target"] = pressure_target

        # Override artifact types if provided by user
        if user_artifact_types:
            for artifact in metadata.get("artifacts", []):
                file_name = artifact.get("file_name")
                if file_name and file_name in user_artifact_types:
                    artifact["artifact_type"] = user_artifact_types[file_name]
                    logger.info(f"Override artifact type for {file_name}: {user_artifact_types[file_name]}")

        # Check for atom type mapping file (support both naming conventions)
        atom_type_mapping_file = None
        for filename in ["atom_types.json", "atom_dict.json"]:
            candidate = directory / filename
            if candidate.exists():
                atom_type_mapping_file = candidate
                break

        if atom_type_mapping_file:
            try:
                from mddatalake.utils.atom_mapping import parse_atom_type_mapping
                atom_type_mapping = parse_atom_type_mapping(atom_type_mapping_file)
                metadata["atom_type_mapping"] = atom_type_mapping
                logger.info(f"Loaded atom type mapping from {atom_type_mapping_file.name} with {len(atom_type_mapping.get('mappings', {}))} types")

                # Extract top-level metadata from atom mapping file
                if "system" in atom_type_mapping:
                    metadata["system_description"] = atom_type_mapping["system"]
                    logger.info(f"Extracted system description: {atom_type_mapping['system']}")

                if "force_field" in atom_type_mapping:
                    metadata["force_field_name"] = atom_type_mapping["force_field"]
                    logger.info(f"Extracted force field: {atom_type_mapping['force_field']}")

                if "description" in atom_type_mapping and not description:
                    # Use atom mapping description if no run description provided
                    metadata["atom_mapping_description"] = atom_type_mapping["description"]
                    logger.info(f"Extracted description: {atom_type_mapping['description']}")
            except Exception as e:
                logger.warning(f"Failed to parse atom type mapping file: {e}")

        # Use directory name as run name if not provided
        if run_name is None:
            run_name = directory.name

        # Stage 3: Artifact Processing
        artifacts_data = await self._process_artifacts(directory, metadata.get("artifacts", []))

        # Stage 4: Database Transaction
        try:
            run_id = await self._create_database_records(
                project_name=project_name,
                run_name=run_name,
                description=description,
                working_directory=str(directory),
                metadata=metadata,
                artifacts_data=artifacts_data,
            )

            # Create ingestion marker
            marker_file.write_text(f"run_id={run_id}\n")

            await self.db.commit()

            # Stage 5: Post-Ingestion (Async Preview Extraction)
            if settings.preview_cache_enabled:
                await self._post_ingestion_tasks(run_id)

            return run_id

        except Exception as e:
            await self.db.rollback()
            raise IngestionError(f"Failed to create database records: {e}")

    def _extract_metadata(self, directory: Path, engine_name: str) -> dict[str, Any]:
        """Stage 2: Extract metadata using parsers."""
        try:
            if engine_name == "lammps":
                parser = LammpsParser(directory)
            elif engine_name == "gromacs":
                parser = GromacsParser(directory)
            else:
                raise IngestionError(f"Unsupported engine: {engine_name}")

            metadata = parser.parse()
            return metadata

        except Exception as e:
            raise IngestionError(f"Failed to extract metadata: {e}")

    async def _process_artifacts(
        self, directory: Path, artifacts_info: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Stage 3: Process artifacts (checksum, compress, upload)."""
        processed_artifacts = []

        for artifact_info in artifacts_info:
            file_path = Path(artifact_info["file_path"])

            if not file_path.exists():
                continue

            # Compute checksum
            checksum = compute_checksum(file_path)

            # Get file size
            file_size = file_path.stat().st_size

            # Upload to storage
            storage_key = await self.storage.upload(file_path, "", checksum)

            processed_artifacts.append(
                {
                    "file_name": artifact_info["file_name"],
                    "file_path": str(file_path),
                    "artifact_type": artifact_info["artifact_type"],
                    "storage_key": storage_key,
                    "checksum_sha256": checksum,
                    "file_size_bytes": file_size,
                    "compression": None,  # TODO: Add compression
                }
            )

        return processed_artifacts

    async def _create_database_records(
        self,
        project_name: str,
        run_name: str,
        working_directory: str,
        metadata: dict[str, Any],
        artifacts_data: list[dict[str, Any]],
        description: str | None = None,
    ) -> int:
        """Stage 4: Create database records in a transaction."""
        # Find or create project
        project = await self._get_or_create_project(project_name)

        # Find or create engine
        engine = await self._get_or_create_engine(
            name=metadata.get("engine", "Unknown"),
            version=metadata.get("engine_version", "unknown"),
            git_commit=metadata.get("git_commit"),
        )

        # Find or create system
        # Use system description from atom mapping if available
        composition_desc = metadata.get("system_description") or metadata.get("composition", "Unknown")
        system = await self._get_or_create_system(
            n_atoms=metadata.get("n_atoms", 0), composition_description=composition_desc
        )

        # Find or create forcefield (if specified)
        # Check both metadata and atom mapping force field
        forcefield = None
        forcefield_name = metadata.get("force_field_name") or metadata.get("forcefield_name")
        if forcefield_name:
            forcefield = await self._get_or_create_forcefield(
                name=forcefield_name, version=metadata.get("forcefield_version")
            )

        # Calculate data completeness
        detector = ScenarioDetector()
        completeness_info = detector.detect(metadata, artifacts_data)

        # Create simulation run
        # Parse atom_style if present (LAMMPS specific)
        atom_style_value = None
        if atom_style_str := metadata.get("atom_style"):
            try:
                from mddatalake.core.enums import LammpsAtomStyle
                atom_style_value = LammpsAtomStyle(atom_style_str)
            except (ValueError, AttributeError):
                pass  # Invalid atom style, leave as None

        # Use atom mapping description as fallback if no description provided
        final_description = description or metadata.get("atom_mapping_description")

        run = SimulationRun(
            project_id=project.id,
            system_id=system.id,
            forcefield_id=forcefield.id if forcefield else None,
            engine_id=engine.id,
            run_name=run_name,
            description=final_description,
            working_directory=working_directory,
            ensemble=metadata.get("ensemble", EnsembleType.NVE),
            simulation_method=metadata.get("simulation_method"),
            integrator=metadata.get("integrator"),
            thermostat=metadata.get("thermostat"),
            barostat=metadata.get("barostat"),
            coulomb_method=metadata.get("coulomb_method"),
            atom_style=atom_style_value,
            atom_type_mapping=metadata.get("atom_type_mapping"),
            temperature_target=metadata.get("temperature_target"),
            pressure_target=metadata.get("pressure_target"),
            timestep=metadata.get("timestep"),
            n_steps=metadata.get("n_steps"),
            total_time=metadata.get("total_time"),
            cutoff_coulomb=metadata.get("cutoff_coulomb"),
            cutoff_vdw=metadata.get("cutoff_vdw"),
            exit_code=metadata.get("exit_code"),
            error_message=metadata.get("error_message"),
            # Data completeness fields
            completeness_score=completeness_info.score,
            missing_data=completeness_info.missing_data,
            data_quality_flags=completeness_info.quality_flags,
        )

        self.db.add(run)
        await self.db.flush()  # Get run.id

        # Create artifacts
        for artifact_data in artifacts_data:
            artifact = Artifact(
                simulation_run_id=run.id,
                file_name=artifact_data["file_name"],
                file_path=artifact_data["file_path"],
                artifact_type=artifact_data["artifact_type"],
                storage_key=artifact_data["storage_key"],
                checksum_sha256=artifact_data["checksum_sha256"],
                file_size_bytes=artifact_data["file_size_bytes"],
                compression=artifact_data["compression"],
            )
            self.db.add(artifact)

        # Create observables from thermodynamic data
        if "thermodynamic_data" in metadata:
            self._create_observables(run.id, metadata["thermodynamic_data"])

        return run.id

    def _create_observables(self, run_id: int, thermodynamic_data: dict[str, Any]) -> None:
        """
        Create Observable records from thermodynamic data.

        Args:
            run_id: Simulation run ID
            thermodynamic_data: Dictionary with thermodynamic timeseries data
        """
        from mddatalake.db.models import Observable
        import numpy as np

        # Skip if no data
        if not thermodynamic_data:
            return

        # Get timesteps for x-axis (if available)
        timesteps = None
        if 'Step' in thermodynamic_data:
            timesteps = thermodynamic_data['Step']['data']

        # Create observables for each property (except Step which is the time axis)
        for col_name, obs_data in thermodynamic_data.items():
            if col_name == 'Step':
                continue  # Skip the timestep column

            data_array = np.array(obs_data['data'])

            # Skip if no data points
            if len(data_array) == 0:
                continue

            # Prepare timeseries data for storage
            timeseries_json = {
                'timesteps': timesteps if timesteps else list(range(len(data_array))),
                'values': [float(v) for v in data_array],  # Convert to native Python floats
                'n_points': len(data_array),
            }

            # Calculate statistics
            observable = Observable(
                simulation_run_id=run_id,
                observable_name=obs_data['name'],
                observable_type='timeseries',
                value_mean=float(np.mean(data_array)),
                value_std=float(np.std(data_array)),
                value_min=float(np.min(data_array)),
                value_max=float(np.max(data_array)),
                units=obs_data['units'],
                timeseries_data=timeseries_json,
            )

            self.db.add(observable)
            logger.info(f"Created observable: {obs_data['name']} ({len(data_array)} points)")

    async def _get_or_create_project(self, name: str) -> Project:
        """Find or create project by name."""
        from sqlalchemy import select

        result = await self.db.execute(select(Project).where(Project.name == name))
        project = result.scalar_one_or_none()

        if not project:
            project = Project(name=name)
            self.db.add(project)
            await self.db.flush()

        return project

    async def _get_or_create_engine(
        self, name: str, version: str, git_commit: str | None = None
    ) -> Engine:
        """Find or create engine."""
        from sqlalchemy import select

        result = await self.db.execute(
            select(Engine).where(Engine.name == name, Engine.version == version)
        )
        engine = result.scalar_one_or_none()

        if not engine:
            engine = Engine(name=name, version=version, git_commit=git_commit)
            self.db.add(engine)
            await self.db.flush()

        return engine

    async def _get_or_create_system(
        self, n_atoms: int, composition_description: str
    ) -> System:
        """Find or create system."""
        from sqlalchemy import select

        # Create a simple composition hash
        composition_hash = hashlib.sha256(
            f"{n_atoms}:{composition_description}".encode()
        ).hexdigest()

        result = await self.db.execute(
            select(System).where(System.composition_hash == composition_hash)
        )
        system = result.scalar_one_or_none()

        if not system:
            system = System(
                composition_hash=composition_hash,
                composition_description=composition_description,
                n_atoms=n_atoms,
            )
            self.db.add(system)
            await self.db.flush()

        return system

    async def _get_or_create_forcefield(
        self, name: str, version: str | None = None
    ) -> ForceField:
        """Find or create forcefield."""
        from sqlalchemy import select

        result = await self.db.execute(select(ForceField).where(ForceField.name == name))
        forcefield = result.scalar_one_or_none()

        if not forcefield:
            forcefield = ForceField(name=name, version=version)
            self.db.add(forcefield)
            await self.db.flush()

        return forcefield

    async def _post_ingestion_tasks(self, run_id: int) -> None:
        """
        Stage 5: Post-ingestion tasks.

        Extracts preview frames asynchronously after ingestion completes.
        Failures are logged but don't affect ingestion success.

        Args:
            run_id: Simulation run ID
        """
        try:
            from mddatalake.ingestion.preview_service import PreviewExtractionService

            # Get trajectory artifacts for this run
            artifacts = await self._get_trajectory_artifacts(run_id)

            if not artifacts:
                return

            preview_service = PreviewExtractionService(self.db, self.storage)

            # Extract previews (async or inline based on config)
            for artifact in artifacts:
                if settings.preview_async_extraction:
                    # Launch in background (non-blocking)
                    asyncio.create_task(
                        preview_service.extract_preview(artifact)
                    )
                else:
                    # Inline extraction (blocks ingestion)
                    await preview_service.extract_preview(artifact)

        except Exception as e:
            # Log but don't fail ingestion
            from mddatalake.core.exceptions import IngestionError
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Post-ingestion tasks failed for run {run_id}: {e}")

    async def _get_trajectory_artifacts(self, run_id: int) -> list[Artifact]:
        """
        Get all trajectory artifacts for a simulation run.

        Args:
            run_id: Simulation run ID

        Returns:
            List of trajectory artifacts
        """
        from mddatalake.core.enums import ArtifactType
        result = await self.db.execute(
            select(Artifact)
            .where(Artifact.simulation_run_id == run_id)
            .where(Artifact.artifact_type == ArtifactType.TRAJECTORY)
        )
        return list(result.scalars().all())
