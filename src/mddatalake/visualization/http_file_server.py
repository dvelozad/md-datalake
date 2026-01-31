"""Simple HTTP server for serving trajectory and topology files."""

import asyncio
import logging
from pathlib import Path
from aiohttp import web

logger = logging.getLogger(__name__)


class HTTPFileServer:
    """
    Simple HTTP server for serving topology and trajectory files to NGL Viewer.

    NGL Viewer requires HTTP access to load PDB and DCD files directly.
    """

    def __init__(
        self,
        trajectory_path: Path,
        topology_path: Path,
        port: int,
        session_id: str,
    ):
        """
        Initialize HTTP file server.

        Args:
            trajectory_path: Path to trajectory file (DCD, XTC, TRR, etc.)
            topology_path: Path to topology file (PDB, GRO, etc.)
            port: HTTP server port
            session_id: Unique session identifier
        """
        self.trajectory_path = trajectory_path
        self.topology_path = topology_path
        self.port = port
        self.session_id = session_id
        self.app = None
        self.runner = None
        self.site = None

    async def start(self):
        """Start the HTTP server."""
        self.app = web.Application()

        # Add CORS middleware
        async def cors_middleware(app, handler):
            async def middleware_handler(request):
                # Handle OPTIONS request for CORS preflight
                if request.method == 'OPTIONS':
                    return web.Response(
                        headers={
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET, OPTIONS',
                            'Access-Control-Allow-Headers': '*',
                        }
                    )

                # Handle actual request
                response = await handler(request)
                response.headers['Access-Control-Allow-Origin'] = '*'
                return response

            return middleware_handler

        self.app.middlewares.append(cors_middleware)

        # Add routes
        self.app.router.add_get('/topology.pdb', self.serve_topology)
        self.app.router.add_get('/trajectory.dcd', self.serve_trajectory)
        self.app.router.add_get('/health', self.health_check)

        # Start server
        self.runner = web.AppRunner(self.app)
        await self.runner.setup()
        self.site = web.TCPSite(self.runner, '0.0.0.0', self.port)
        await self.site.start()

        logger.info(f"HTTP file server started on port {self.port} for session {self.session_id}")

    async def stop(self):
        """Stop the HTTP server."""
        if self.site:
            await self.site.stop()
        if self.runner:
            await self.runner.cleanup()
        logger.info(f"HTTP file server stopped for session {self.session_id}")

    async def serve_topology(self, request):
        """Serve topology file."""
        if not self.topology_path.exists():
            logger.error(f"Topology file not found: {self.topology_path}")
            raise web.HTTPNotFound(text=f"Topology file not found")

        logger.info(f"Serving topology: {self.topology_path}")
        return web.FileResponse(
            path=self.topology_path,
            headers={
                'Content-Type': 'chemical/x-pdb',
                'Access-Control-Allow-Origin': '*',
            }
        )

    async def serve_trajectory(self, request):
        """Serve trajectory file."""
        if not self.trajectory_path.exists():
            logger.error(f"Trajectory file not found: {self.trajectory_path}")
            raise web.HTTPNotFound(text=f"Trajectory file not found")

        logger.info(f"Serving trajectory: {self.trajectory_path}")
        return web.FileResponse(
            path=self.trajectory_path,
            headers={
                'Content-Type': 'application/octet-stream',
                'Access-Control-Allow-Origin': '*',
            }
        )

    async def health_check(self, request):
        """Health check endpoint."""
        return web.json_response({
            'status': 'ok',
            'session_id': self.session_id,
            'topology': str(self.topology_path),
            'trajectory': str(self.trajectory_path),
        })


async def run_http_file_server(
    trajectory_path: Path,
    topology_path: Path,
    port: int,
    session_id: str,
) -> HTTPFileServer:
    """
    Run HTTP file server.

    Args:
        trajectory_path: Path to trajectory file
        topology_path: Path to topology file
        port: HTTP server port
        session_id: Unique session identifier

    Returns:
        Running server instance
    """
    server = HTTPFileServer(trajectory_path, topology_path, port, session_id)
    await server.start()
    return server
