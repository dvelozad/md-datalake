"""Unit tests for preview extraction service."""

import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from mddatalake.ingestion.preview_service import PreviewExtractionService
from mddatalake.db.models import Artifact, SimulationRun, Engine
from mddatalake.core.enums import ArtifactType


@pytest.fixture
def mock_db():
    """Mock database session."""
    db = AsyncMock()
    db.commit = AsyncMock()
    db.execute = AsyncMock()
    db.refresh = AsyncMock()
    return db


@pytest.fixture
def mock_storage():
    """Mock storage backend."""
    storage = AsyncMock()
    storage.download = AsyncMock()
    storage.upload = AsyncMock(return_value="preview/artifact_1.pdb")
    return storage


@pytest.fixture
def mock_trajectory_artifact():
    """Mock trajectory artifact."""
    engine = Engine(id=1, name="LAMMPS", version="23Jun2022")
    run = SimulationRun(id=1, engine=engine, engine_id=1)

    artifact = Artifact(
        id=1,
        simulation_run_id=1,
        file_name="trajectory.dump",
        file_path="/path/to/trajectory.dump",
        artifact_type=ArtifactType.TRAJECTORY,
        storage_key="runs/1/trajectory.dump",
        checksum_sha256="abc123",
        file_size_bytes=100 * 1024 * 1024,  # 100 MB
        compression=None,
        preview_status="pending",
    )
    artifact.simulation_run = run
    return artifact


@pytest.fixture
def mock_topology_artifact():
    """Mock topology artifact."""
    artifact = Artifact(
        id=2,
        simulation_run_id=1,
        file_name="topology.pdb",
        file_path="/path/to/topology.pdb",
        artifact_type=ArtifactType.TOPOLOGY,
        storage_key="runs/1/topology.pdb",
        checksum_sha256="def456",
        file_size_bytes=1024,
        compression=None,
    )
    return artifact


@pytest.mark.asyncio
async def test_extract_preview_success_lammps(
    mock_db, mock_storage, mock_trajectory_artifact, mock_topology_artifact
):
    """Test successful preview extraction for LAMMPS trajectory."""
    # Setup
    service = PreviewExtractionService(mock_db, mock_storage)

    # Mock database query for topology
    mock_db.execute.return_value.scalar_one_or_none.return_value = mock_topology_artifact

    # Mock MDAnalysis
    with patch("mddatalake.ingestion.preview_service.compute_checksum") as mock_checksum:
        mock_checksum.return_value = "preview_checksum"

        with patch("MDAnalysis.Universe") as mock_universe_cls:
            # Mock universe and trajectory
            mock_universe = MagicMock()
            mock_trajectory = MagicMock()
            mock_trajectory.__len__ = MagicMock(return_value=100)
            mock_trajectory.__getitem__ = MagicMock()
            mock_universe.trajectory = mock_trajectory
            mock_universe.atoms.n_atoms = 1000

            mock_universe_cls.return_value = mock_universe

            with patch("MDAnalysis.Writer") as mock_writer_cls:
                mock_writer = MagicMock()
                mock_writer_cls.return_value.__enter__ = MagicMock(return_value=mock_writer)
                mock_writer_cls.return_value.__exit__ = MagicMock(return_value=False)

                # Execute
                result = await service.extract_preview(
                    mock_trajectory_artifact,
                    mock_topology_artifact
                )

    # Verify
    assert result is True
    assert mock_trajectory_artifact.preview_status == "ready"
    assert mock_trajectory_artifact.preview_cache_key == "preview/artifact_1.pdb"
    assert mock_trajectory_artifact.preview_frame_count == 1
    assert mock_trajectory_artifact.preview_generated_at is not None
    assert mock_db.commit.called


@pytest.mark.asyncio
async def test_extract_preview_non_trajectory(
    mock_db, mock_storage, mock_topology_artifact
):
    """Test that non-trajectory artifacts are skipped."""
    # Setup
    service = PreviewExtractionService(mock_db, mock_storage)

    # Execute
    result = await service.extract_preview(mock_topology_artifact)

    # Verify
    assert result is False
    assert mock_topology_artifact.preview_status == "n/a"
    assert mock_db.commit.called


@pytest.mark.asyncio
async def test_extract_preview_large_file(
    mock_db, mock_storage, mock_trajectory_artifact
):
    """Test that files exceeding max size are skipped."""
    # Setup - file larger than 500 MB
    mock_trajectory_artifact.file_size_bytes = 600 * 1024 * 1024
    service = PreviewExtractionService(mock_db, mock_storage)

    # Execute
    result = await service.extract_preview(mock_trajectory_artifact)

    # Verify
    assert result is False
    assert mock_trajectory_artifact.preview_status == "n/a"
    assert mock_db.commit.called


@pytest.mark.asyncio
async def test_extract_preview_no_topology(
    mock_db, mock_storage, mock_trajectory_artifact
):
    """Test error when topology artifact not found."""
    # Setup
    service = PreviewExtractionService(mock_db, mock_storage)

    # Mock database query returning None - fix async mock
    mock_result = AsyncMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    # Execute
    result = await service.extract_preview(mock_trajectory_artifact)

    # Verify
    assert result is False
    assert mock_trajectory_artifact.preview_status == "failed"
    assert "Topology artifact not found" in mock_trajectory_artifact.preview_error_message
    assert mock_db.commit.called


@pytest.mark.asyncio
async def test_extract_preview_mdanalysis_error(
    mock_db, mock_storage, mock_trajectory_artifact, mock_topology_artifact
):
    """Test error handling when MDAnalysis fails."""
    # Setup
    service = PreviewExtractionService(mock_db, mock_storage)

    # Mock database query for topology
    mock_db.execute.return_value.scalar_one_or_none.return_value = mock_topology_artifact

    # Mock MDAnalysis to raise error
    with patch("MDAnalysis.Universe") as mock_universe_cls:
        mock_universe_cls.side_effect = Exception("Invalid trajectory format")

        # Execute
        result = await service.extract_preview(
            mock_trajectory_artifact,
            mock_topology_artifact
        )

    # Verify
    assert result is False
    assert mock_trajectory_artifact.preview_status == "failed"
    assert "Invalid trajectory format" in mock_trajectory_artifact.preview_error_message
    assert mock_db.commit.called


@pytest.mark.asyncio
async def test_extract_preview_gromacs(
    mock_db, mock_storage, mock_topology_artifact
):
    """Test preview extraction for GROMACS trajectory."""
    # Setup - GROMACS trajectory
    engine = Engine(id=2, name="GROMACS", version="2021.3")
    run = SimulationRun(id=2, engine=engine, engine_id=2)

    gromacs_artifact = Artifact(
        id=3,
        simulation_run_id=2,
        file_name="trajectory.xtc",
        file_path="/path/to/trajectory.xtc",
        artifact_type=ArtifactType.TRAJECTORY,
        storage_key="runs/2/trajectory.xtc",
        checksum_sha256="gromacs123",
        file_size_bytes=50 * 1024 * 1024,
        compression=None,
        preview_status="pending",
    )
    gromacs_artifact.simulation_run = run

    service = PreviewExtractionService(mock_db, mock_storage)

    # Mock database query for topology
    mock_db.execute.return_value.scalar_one_or_none.return_value = mock_topology_artifact

    # Mock MDAnalysis
    with patch("mddatalake.ingestion.preview_service.compute_checksum") as mock_checksum:
        mock_checksum.return_value = "preview_checksum"

        with patch("MDAnalysis.Universe") as mock_universe_cls:
            mock_universe = MagicMock()
            mock_trajectory = MagicMock()
            mock_trajectory.__len__ = MagicMock(return_value=100)
            mock_trajectory.__getitem__ = MagicMock()
            mock_universe.trajectory = mock_trajectory
            mock_universe.atoms.n_atoms = 1000
            mock_universe_cls.return_value = mock_universe

            with patch("MDAnalysis.Writer") as mock_writer_cls:
                mock_writer = MagicMock()
                mock_writer_cls.return_value.__enter__ = MagicMock(return_value=mock_writer)
                mock_writer_cls.return_value.__exit__ = MagicMock(return_value=False)

                # Execute
                result = await service.extract_preview(
                    gromacs_artifact,
                    mock_topology_artifact
                )

    # Verify
    assert result is True
    assert gromacs_artifact.preview_status == "ready"
    assert mock_db.commit.called


@pytest.mark.asyncio
async def test_find_topology_artifact(mock_db):
    """Test finding topology artifact for a run."""
    # Setup
    service = PreviewExtractionService(mock_db, AsyncMock())

    topology = Artifact(
        id=10,
        simulation_run_id=5,
        artifact_type=ArtifactType.TOPOLOGY,
        file_name="system.pdb",
        file_path="/path/to/system.pdb",
        storage_key="runs/5/system.pdb",
        checksum_sha256="topo123",
        file_size_bytes=2048,
    )

    # Fix async mock
    mock_result = AsyncMock()
    mock_result.scalar_one_or_none.return_value = topology
    mock_db.execute.return_value = mock_result

    # Execute
    result = await service._find_topology_artifact(5)

    # Verify
    assert result == topology
    assert result.artifact_type == ArtifactType.TOPOLOGY
