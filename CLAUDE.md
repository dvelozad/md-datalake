# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MD DataLake is a full-stack application for storing, querying, and visualizing molecular dynamics (MD) simulations. It consists of a FastAPI backend (Python), a React/TypeScript frontend, and uses PostgreSQL for metadata and S3/MinIO or filesystem for artifact storage.

## Common Commands

### Setup
```bash
poetry install                    # Install Python dependencies
cd frontend && npm install        # Install frontend dependencies
docker-compose up -d postgres minio  # Start backing services
make upgrade                      # Apply database migrations
```

### Development
```bash
make run-api                      # Start API server (uvicorn, port 8000, auto-reload)
cd frontend && npm run dev        # Start frontend dev server (Vite)
make dev                          # Start postgres + minio via Docker
```

### Testing
```bash
make test                         # Run all tests with coverage
poetry run pytest tests/unit/     # Run only unit tests
poetry run pytest tests/unit/test_storage.py  # Run a single test file
poetry run pytest -k "test_name"  # Run a specific test by name
```

Integration tests require a running PostgreSQL instance at `localhost:5433/mddatalake_test`.

### Linting & Formatting
```bash
make lint                         # ruff check + mypy
make format                       # black + ruff --fix
```

### Database Migrations
```bash
make migrations MSG="description" # Generate new Alembic migration
make upgrade                      # Apply migrations
make downgrade                    # Roll back one migration
```

Migration files live in `migrations/versions/`. Alembic reads `DATABASE_URL` from `Settings` (env var or `.env` file).

## Architecture

### Backend (`src/mddatalake/`)

The backend is a FastAPI app with async SQLAlchemy (asyncpg). Key layers:

- **`api/`** — FastAPI routers. `main.py` mounts all routes under `/api/v1`. All routes except `/health` and `/auth` require JWT authentication via `get_current_user` dependency.
- **`db/`** — SQLAlchemy models and session management. `models/` contains one file per table (simulation_run, artifact, project, user, etc.). `session.py` provides `get_db()` for FastAPI dependency injection. `base.py` holds the declarative Base.
- **`ingestion/`** — 5-stage pipeline (`service.py`) that detects simulation engine, parses metadata, stores artifacts, and creates DB records. `scenario_detector.py` classifies simulation types. `validators.py` handles upload validation.
- **`parsers/`** — Engine-specific parsers for LAMMPS and GROMACS. `detector.py` auto-detects which engine produced the files. Each parser extracts metadata (ensemble, thermostat, force field, etc.) from input/log files.
- **`storage/`** — Abstract `StorageBackend` with `FilesystemBackend` and `S3Backend` implementations. Selected by `STORAGE_BACKEND` env var.
- **`auth/`** — JWT authentication with bcrypt password hashing. `security.py` handles token creation/validation; `dependencies.py` provides FastAPI dependency.
- **`visualization/`** — Trajectory serving for NGL Viewer. Converts trajectories to PDB format and serves them via HTTP.
- **`core/`** — Configuration (`config.py` with pydantic-settings, reads `.env`), enums, and custom exceptions.

### Frontend (`frontend/`)

React 18 + TypeScript + Vite. Uses MUI for components, React Query for data fetching, Zustand for state, React Router for routing, and NGL for 3D molecular visualization. Plotly.js for time-series plots.

### Data Model

A **Project** contains **SimulationRuns**. Each run has associated **Artifacts** (trajectory, topology, input, log files), a **System** (atom counts, box dimensions), an **Engine** (LAMMPS/GROMACS + version), a **ForceField**, and **Observables** (time-series data like temperature, pressure, energy). Runs can have **Tags**, **Comments**, and **Lineage** relationships. **Users** collaborate on projects via **ProjectCollaborators**.

### Configuration

All settings flow through `src/mddatalake/core/config.py` (`Settings` class). Key env vars:
- `DATABASE_URL` — PostgreSQL connection string (default: `postgresql+asyncpg://mddatalake:devpassword@localhost:5433/mddatalake`)
- `STORAGE_BACKEND` — `filesystem` or `s3`
- `S3_ENDPOINT_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` — MinIO/S3 credentials
- `JWT_SECRET_KEY` — Secret for JWT tokens

### Docker Services

`docker-compose.yml` defines: `postgres` (port 5432), `minio` (ports 9000/9001), `api` (port 8000), `frontend` (port 3000), `nginx` (port 80).

## Test Markers

Tests support these pytest markers: `@pytest.mark.unit`, `@pytest.mark.integration`, `@pytest.mark.slow`, `@pytest.mark.requires_mdanalysis`.
