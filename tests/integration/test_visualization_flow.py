"""Integration test for full visualization flow."""

import pytest
import asyncio
from pathlib import Path
from datetime import datetime, timedelta

from sqlalchemy import select

from mddatalake.db.models.project import Project
from mddatalake.db.models.system import System
from mddatalake.db.models.engine import Engine
from mddatalake.db.models.forcefield import ForceField
from mddatalake.db.models.simulation_run import SimulationRun
from mddatalake.db.models.artifact import Artifact
from mddatalake.db.models.visualization_session import VisualizationSession
from mddatalake.visualization.mdserv_manager import MDservManager
from mddatalake.core.enums import EnsembleType


@pytest.fixture
async def test_project(db_session):
    """Create test project."""
    project = Project(
        name="test_project",
        description="Test project for visualization"
    )
    db_session.add(project)
    await db_session.commit()
    await db_session.refresh(project)
    return project


@pytest.fixture
async def test_system(db_session):
    """Create test system."""
    system = System(
        n_atoms=32,
        composition_description="H2O",
        composition_hash="test_hash_123"
    )
    db_session.add(system)
    await db_session.commit()
    await db_session.refresh(system)
    return system


@pytest.fixture
async def simulation_engine(db_session):
    """Create test engine."""
    engine = Engine(
        name="LAMMPS",
        version="2023.08.02",
        git_commit="abc123"
    )
    db_session.add(engine)
    await db_session.commit()
    await db_session.refresh(engine)
    return engine


@pytest.fixture
async def test_run(db_session, test_project, test_system, simulation_engine):
    """Create test simulation run with artifacts."""
    # Create run
    run = SimulationRun(
        project_id=test_project.id,
        system_id=test_system.id,
        engine_id=simulation_engine.id,
        run_name="water_nvt_test",
        working_directory="/tmp/test",
        ensemble=EnsembleType.NVT,
        temperature_target=300.0,
        timestep=2.0,
        n_steps=1000
    )
    db_session.add(run)
    await db_session.commit()
    await db_session.refresh(run)

    # Add artifacts
    fixtures_dir = Path(__file__).parent.parent / "fixtures" / "lammps" / "water_nvt"

    traj_artifact = Artifact(
        simulation_run_id=run.id,
        artifact_type="trajectory",
        file_name="traj.dump",
        file_path=str(fixtures_dir / "traj.dump"),
        storage_key="test/traj.dump",
        checksum_sha256="test_checksum_traj",
        file_size_bytes=1000
    )

    top_artifact = Artifact(
        simulation_run_id=run.id,
        artifact_type="topology",
        file_name="data.water.lmp",
        file_path=str(fixtures_dir / "data.water.lmp"),
        storage_key="test/data.water.lmp",
        checksum_sha256="test_checksum_top",
        file_size_bytes=500
    )

    db_session.add(traj_artifact)
    db_session.add(top_artifact)
    await db_session.commit()

    return run


@pytest.mark.integration
@pytest.mark.asyncio
async def test_visualization_session_lifecycle(db_session, test_run):
    """Test complete visualization session lifecycle."""
    pytest.importorskip("MDAnalysis")

    manager = MDservManager(
        port_range_start=38090,
        port_range_end=38190,
        session_timeout_seconds=60  # 1 minute for testing
    )

    # Create session
    session = await manager.create_session(
        db=db_session,
        run_id=test_run.id,
        config={}
    )

    # Verify session created
    assert session.session_id is not None
    assert session.simulation_run_id == test_run.id
    assert session.status == "active"
    assert session.mdserv_port >= 38090
    assert session.mdserv_port < 38190

    # Verify server is running
    assert session.session_id in manager.servers

    # Retrieve session
    retrieved_session = await manager.get_session(db_session, session.session_id)
    assert retrieved_session is not None
    assert retrieved_session.session_id == session.session_id

    # Terminate session
    await manager.terminate_session(db_session, session.session_id)

    # Verify cleanup
    assert session.session_id not in manager.servers

    # Verify database updated
    result = await db_session.execute(
        select(VisualizationSession).where(
            VisualizationSession.session_id == session.session_id
        )
    )
    terminated_session = result.scalar_one()
    assert terminated_session.status == "expired"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_expired_session_cleanup(db_session, test_run):
    """Test cleanup of expired sessions."""
    pytest.importorskip("MDAnalysis")

    manager = MDservManager(
        port_range_start=38090,
        port_range_end=38190,
        session_timeout_seconds=1  # 1 second for testing
    )

    # Create session
    session = await manager.create_session(
        db=db_session,
        run_id=test_run.id,
        config={}
    )

    # Manually expire the session
    session.expires_at = datetime.utcnow() - timedelta(seconds=10)
    await db_session.commit()

    # Run cleanup
    await manager.cleanup_expired_sessions(db_session)

    # Verify session was cleaned up
    result = await db_session.execute(
        select(VisualizationSession).where(
            VisualizationSession.session_id == session.session_id
        )
    )
    cleaned_session = result.scalar_one()
    assert cleaned_session.status == "expired"

@pytest.mark.integration
@pytest.mark.asyncio
async def test_multiple_concurrent_sessions(db_session, test_run):
    """Test multiple concurrent visualization sessions."""
    pytest.importorskip("MDAnalysis")

    manager = MDservManager(
        port_range_start=38090,
        port_range_end=38190,
        session_timeout_seconds=60
    )

    # Create multiple sessions
    sessions = []
    for i in range(3):
        session = await manager.create_session(
            db=db_session,
            run_id=test_run.id,
            config={"session_num": i}
        )
        sessions.append(session)

    # Verify all sessions active
    assert len(manager.servers) == 3

    # Verify different ports
    ports = [s.mdserv_port for s in sessions]
    assert len(set(ports)) == 3  # All unique

    # Cleanup all sessions
    for session in sessions:
        await manager.terminate_session(db_session, session.session_id)

    # Verify all cleaned up
    assert len(manager.servers) == 0
