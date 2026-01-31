"""FastAPI application factory."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from mddatalake.api.routes import artifacts, health, runs, visualization
from mddatalake.api.scheduler import scheduler
from mddatalake.__version__ import __version__

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Handles startup and shutdown events.
    """
    # Startup
    logger.info("Starting application...")
    await scheduler.start()
    logger.info("Application started")

    yield

    # Shutdown
    logger.info("Shutting down application...")
    await scheduler.stop()
    logger.info("Application stopped")


app = FastAPI(
    title="MD Repo API",
    description="Production-ready backend for molecular dynamics simulation database",
    version=__version__,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(runs.router, prefix="/api/v1", tags=["Simulation Runs"])
app.include_router(artifacts.router, prefix="/api/v1", tags=["Artifacts"])
app.include_router(visualization.router, prefix="/api/v1", tags=["Visualization"])
