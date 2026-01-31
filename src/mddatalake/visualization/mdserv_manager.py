"""Visualization session manager for trajectory streaming."""

import asyncio
import logging
import shutil
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from mddatalake.db.models.visualization_session import VisualizationSession
from mddatalake.db.models.simulation_run import SimulationRun
from mddatalake.db.models.artifact import Artifact
from mddatalake.visualization.converters import TrajectoryConverter
from mddatalake.visualization.http_file_server import run_http_file_server

logger = logging.getLogger(__name__)


class VisualizationSessionCreate(BaseModel):
    """Schema for creating a visualization session."""

    run_id: int
    config: Dict[str, Any] = {}


class MDservManager:
    """
    Manages trajectory streaming session lifecycle.

    Responsibilities:
    - Spawn WebSocket server on dynamic port
    - Manage session lifecycle (create, terminate, cleanup)
    - Download and convert trajectory files
    - Clean up expired sessions
    """

    def __init__(
        self,
        port_range_start: int = 8090,
        port_range_end: int = 8190,
        session_timeout_seconds: int = 3600,
        temp_dir: Optional[Path] = None,
    ):
        self.port_range_start = port_range_start
        self.port_range_end = port_range_end
        self.session_timeout_seconds = session_timeout_seconds
        self.temp_dir = temp_dir or Path("/tmp/trajectory_sessions")
        self.temp_dir.mkdir(parents=True, exist_ok=True)

        # Track active streaming servers
        self.servers: Dict[str, Any] = {}
        self.converter = TrajectoryConverter()

        # Port allocation
        self._used_ports: set = set()

    def _find_available_port(self) -> int:
        """Find an available port in the configured range."""
        import socket

        for port in range(self.port_range_start, self.port_range_end):
            if port in self._used_ports:
                continue

            # Try to bind to check if port is available
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                sock.bind(("", port))
                sock.close()
                self._used_ports.add(port)
                return port
            except OSError:
                continue

        raise RuntimeError("No available ports in range")

    async def create_session(
        self,
        db: AsyncSession,
        run_id: int,
        config: Dict[str, Any],
        first_frame_only: bool = False,
    ) -> VisualizationSession:
        """
        Create a new visualization session.

        Steps:
        1. Generate session ID (UUID)
        2. Find trajectory and topology artifacts
        3. Allocate port
        4. Download and convert files if needed
        5. Spawn WebSocket server
        6. Insert session record in database
        """
        session_id = str(uuid.uuid4())
        port = self._find_available_port()
        session_dir = self.temp_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        try:
            # Get simulation run and engine info
            result = await db.execute(
                select(SimulationRun)
                .options(selectinload(SimulationRun.engine))
                .where(SimulationRun.id == run_id)
            )
            run = result.scalar_one_or_none()
            if not run:
                raise ValueError(f"Simulation run {run_id} not found")

            engine_name = run.engine.name if run.engine else "UNKNOWN"

            # Find trajectory and topology artifacts
            artifacts_result = await db.execute(
                select(Artifact).where(Artifact.simulation_run_id == run_id)
            )
            artifacts = artifacts_result.scalars().all()

            trajectory_artifact = None
            topology_artifact = None

            for artifact in artifacts:
                if artifact.artifact_type in ["trajectory", "xtc", "trr", "dcd", "dump"]:
                    trajectory_artifact = artifact
                elif artifact.artifact_type in ["topology", "gro", "pdb", "data", "top"]:
                    topology_artifact = artifact

            # Handle case where PDB serves as both topology and trajectory (static structure)
            if not trajectory_artifact and topology_artifact:
                if topology_artifact.file_name.endswith('.pdb'):
                    logger.info(f"Using PDB as both topology and trajectory for run {run_id}")
                    trajectory_artifact = topology_artifact

            if not trajectory_artifact or not topology_artifact:
                raise ValueError(
                    f"Missing trajectory or topology artifact for run {run_id}"
                )

            # Download files to session directory
            logger.info(f"Downloading artifacts for session {session_id}")
            trajectory_path = session_dir / trajectory_artifact.file_name
            topology_path = session_dir / topology_artifact.file_name

            # Download from storage backend
            from mddatalake.storage import get_storage_backend
            storage = get_storage_backend()

            logger.info(f"Downloading trajectory: {trajectory_artifact.storage_key}")
            await storage.download(trajectory_artifact.storage_key, trajectory_path)

            logger.info(f"Downloading topology: {topology_artifact.storage_key}")
            await storage.download(topology_artifact.storage_key, topology_path)

            # Convert if needed
            logger.info(f"Converting trajectory if needed (engine: {engine_name})")
            converted_traj, converted_top = await self.converter.convert_if_needed(
                trajectory_path, topology_path, engine_name, first_frame_only=first_frame_only
            )

            # Create database record
            session = VisualizationSession(
                session_id=session_id,
                simulation_run_id=run_id,
                mdserv_port=port,
                status="initializing",
                config=config,
                expires_at=datetime.utcnow() + timedelta(seconds=self.session_timeout_seconds),
            )

            db.add(session)
            await db.commit()
            await db.refresh(session)

            # Start HTTP file server for NGL Viewer
            logger.info(f"Starting HTTP file server on port {port}")
            server = await run_http_file_server(
                converted_traj, converted_top, port, session_id
            )

            self.servers[session_id] = server

            # Mark as active
            session.status = "active"
            await db.commit()

            logger.info(f"Session {session_id} created successfully")
            return session

        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            # Cleanup on error
            if session_dir.exists():
                shutil.rmtree(session_dir, ignore_errors=True)
            if port in self._used_ports:
                self._used_ports.remove(port)
            raise

    async def get_session(
        self,
        db: AsyncSession,
        session_id: str,
    ) -> Optional[VisualizationSession]:
        """Get visualization session by ID."""
        result = await db.execute(
            select(VisualizationSession).where(
                VisualizationSession.session_id == session_id
            )
        )
        session = result.scalar_one_or_none()

        if session:
            # Update last accessed time
            session.last_accessed_at = datetime.utcnow()
            await db.commit()

        return session

    async def terminate_session(
        self,
        db: AsyncSession,
        session_id: str,
    ):
        """
        Terminate a visualization session.

        Steps:
        1. Stop WebSocket server
        2. Cleanup temp files
        3. Update database status to 'expired'
        """
        result = await db.execute(
            select(VisualizationSession).where(
                VisualizationSession.session_id == session_id
            )
        )
        session = result.scalar_one_or_none()

        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Stop WebSocket server
        if session_id in self.servers:
            logger.info(f"Stopping server for session {session_id}")
            server = self.servers[session_id]
            await server.stop()
            del self.servers[session_id]

            # Release port
            if session.mdserv_port in self._used_ports:
                self._used_ports.remove(session.mdserv_port)

        # Cleanup temp files
        session_dir = self.temp_dir / session_id
        if session_dir.exists():
            logger.info(f"Cleaning up session directory: {session_dir}")
            shutil.rmtree(session_dir, ignore_errors=True)

        # Update database
        session.status = "expired"
        await db.commit()

        logger.info(f"Session {session_id} terminated")

    async def cleanup_expired_sessions(self, db: AsyncSession):
        """
        Background task to cleanup expired sessions.

        Should be run periodically (e.g., every 5 minutes).
        """
        now = datetime.utcnow()
        result = await db.execute(
            select(VisualizationSession).where(
                VisualizationSession.expires_at < now,
                VisualizationSession.status == "active"
            )
        )
        expired_sessions = result.scalars().all()

        logger.info(f"Found {len(expired_sessions)} expired sessions")

        for session in expired_sessions:
            try:
                await self.terminate_session(db, session.session_id)
            except Exception as e:
                logger.error(f"Failed to cleanup session {session.session_id}: {e}")
