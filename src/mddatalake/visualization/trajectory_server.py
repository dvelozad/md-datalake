"""WebSocket server for trajectory frame streaming."""

import asyncio
import json
import logging
from pathlib import Path
from typing import Dict, Optional
import websockets
from websockets.server import WebSocketServerProtocol

logger = logging.getLogger(__name__)


class TrajectoryStreamingServer:
    """
    WebSocket server for streaming trajectory frames to clients.

    This server loads a trajectory file and streams individual frames
    to connected clients on demand, avoiding the need to transfer
    entire large trajectory files.
    """

    def __init__(
        self,
        trajectory_path: Path,
        topology_path: Path,
        port: int,
        session_id: str,
    ):
        """
        Initialize trajectory streaming server.

        Args:
            trajectory_path: Path to trajectory file (DCD, XTC, TRR, etc.)
            topology_path: Path to topology file (PDB, GRO, etc.)
            port: WebSocket server port
            session_id: Unique session identifier
        """
        self.trajectory_path = trajectory_path
        self.topology_path = topology_path
        self.port = port
        self.session_id = session_id

        self.universe = None
        self.clients: Dict[WebSocketServerProtocol, str] = {}
        self.server = None

    async def start(self):
        """Start the WebSocket server."""
        try:
            import MDAnalysis as mda
        except ImportError:
            raise ImportError("MDAnalysis is required for trajectory streaming")

        # Load trajectory
        logger.info(f"Loading trajectory: {self.trajectory_path}")
        self.universe = mda.Universe(
            str(self.topology_path),
            str(self.trajectory_path)
        )
        logger.info(
            f"Loaded {len(self.universe.trajectory)} frames, "
            f"{self.universe.atoms.n_atoms} atoms"
        )

        # Start WebSocket server
        logger.info(f"Starting WebSocket server on port {self.port}")
        self.server = await websockets.serve(
            self._handle_client,
            "0.0.0.0",
            self.port
        )
        logger.info(f"Server started for session {self.session_id}")

    async def stop(self):
        """Stop the WebSocket server."""
        if self.server:
            logger.info(f"Stopping server for session {self.session_id}")
            self.server.close()
            await self.server.wait_closed()

    async def _handle_client(self, websocket: WebSocketServerProtocol, path: str):
        """
        Handle WebSocket client connection.

        Args:
            websocket: WebSocket connection
            path: Request path
        """
        client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        logger.info(f"Client connected: {client_id}")
        self.clients[websocket] = client_id

        try:
            # Send initial metadata
            await self._send_metadata(websocket)

            # Handle client requests
            async for message in websocket:
                await self._handle_message(websocket, message)

        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client disconnected: {client_id}")
        except Exception as e:
            logger.error(f"Error handling client {client_id}: {e}")
        finally:
            if websocket in self.clients:
                del self.clients[websocket]

    async def _send_metadata(self, websocket: WebSocketServerProtocol):
        """Send trajectory metadata to client."""
        metadata = {
            "type": "metadata",
            "session_id": self.session_id,
            "n_atoms": self.universe.atoms.n_atoms,
            "n_frames": len(self.universe.trajectory),
            "dt": float(self.universe.trajectory.dt),
            "total_time": float(self.universe.trajectory.totaltime),
        }

        await websocket.send(json.dumps(metadata))
        logger.debug(f"Sent metadata: {metadata}")

    async def _handle_message(self, websocket: WebSocketServerProtocol, message: str):
        """
        Handle incoming message from client.

        Expected message format:
        {
            "type": "request_frame",
            "frameIndex": 42
        }
        """
        try:
            data = json.loads(message)
            msg_type = data.get("type")

            if msg_type == "request_frame":
                frame_index = data.get("frameIndex", 0)
                await self._send_frame(websocket, frame_index)

            elif msg_type == "request_topology":
                await self._send_topology(websocket)

            else:
                logger.warning(f"Unknown message type: {msg_type}")

        except json.JSONDecodeError:
            logger.error(f"Invalid JSON message: {message}")
        except Exception as e:
            logger.error(f"Error handling message: {e}")

    async def _send_frame(self, websocket: WebSocketServerProtocol, frame_index: int):
        """
        Send trajectory frame to client.

        Args:
            websocket: WebSocket connection
            frame_index: Frame index to send
        """
        if frame_index < 0 or frame_index >= len(self.universe.trajectory):
            logger.warning(f"Invalid frame index: {frame_index}")
            return

        # Set trajectory to requested frame
        self.universe.trajectory[frame_index]

        # Get coordinates (Nx3 array)
        coordinates = self.universe.atoms.positions

        # Prepare response
        response = {
            "type": "frame",
            "frameIndex": frame_index,
            "time": float(self.universe.trajectory.time),
            "coordinates": coordinates.flatten().tolist(),  # Flatten to 1D array
        }

        await websocket.send(json.dumps(response))
        logger.debug(f"Sent frame {frame_index}")

    async def _send_topology(self, websocket: WebSocketServerProtocol):
        """Send topology information to client."""
        atoms = []
        for atom in self.universe.atoms:
            atoms.append({
                "index": int(atom.index),
                "name": atom.name,
                "type": atom.type if hasattr(atom, "type") else atom.name,
                "resname": atom.resname if hasattr(atom, "resname") else "",
                "resid": int(atom.resid) if hasattr(atom, "resid") else 0,
                "element": atom.element if hasattr(atom, "element") else "",
            })

        # Get bonds if available
        bonds = []
        if hasattr(self.universe, "bonds") and self.universe.bonds:
            for bond in self.universe.bonds:
                bonds.append([int(bond.atoms[0].index), int(bond.atoms[1].index)])

        response = {
            "type": "topology",
            "atoms": atoms,
            "bonds": bonds,
        }

        await websocket.send(json.dumps(response))
        logger.debug("Sent topology")


async def run_trajectory_server(
    trajectory_path: Path,
    topology_path: Path,
    port: int,
    session_id: str,
) -> TrajectoryStreamingServer:
    """
    Run trajectory streaming server.

    Args:
        trajectory_path: Path to trajectory file
        topology_path: Path to topology file
        port: WebSocket server port
        session_id: Unique session identifier

    Returns:
        Running server instance
    """
    server = TrajectoryStreamingServer(trajectory_path, topology_path, port, session_id)
    await server.start()
    return server
