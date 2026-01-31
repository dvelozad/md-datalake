"""Simulation run endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mddatalake.core.enums import EnsembleType
from mddatalake.db.models import SimulationRun
from mddatalake.db.session import get_db

router = APIRouter()


@router.get("/runs")
async def list_runs(
    db: AsyncSession = Depends(get_db),
    project_name: str | None = Query(None),
    ensemble: EnsembleType | None = Query(None),
    engine_name: str | None = Query(None),
    min_temperature: float | None = Query(None),
    max_temperature: float | None = Query(None),
    composition: str | None = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """
    List simulation runs with optional filters.

    Query parameters:
    - project_name: Filter by project name
    - ensemble: Filter by ensemble type (NVE, NVT, NPT, etc.)
    - engine_name: Filter by MD engine name
    - min_temperature: Minimum temperature (K)
    - max_temperature: Maximum temperature (K)
    - composition: Substring match on system composition
    - limit: Maximum number of results (default 100, max 1000)
    - offset: Number of results to skip (for pagination)
    """
    # Build query
    stmt = select(SimulationRun)

    # Apply filters
    if ensemble:
        stmt = stmt.where(SimulationRun.ensemble == ensemble)

    if min_temperature is not None:
        stmt = stmt.where(SimulationRun.temperature_target >= min_temperature)

    if max_temperature is not None:
        stmt = stmt.where(SimulationRun.temperature_target <= max_temperature)

    # TODO: Add joins for project_name, engine_name, composition filters

    # Apply pagination
    stmt = stmt.limit(limit).offset(offset)

    # Execute query
    result = await db.execute(stmt)
    runs = result.scalars().all()

    # Convert to dict
    runs_data = []
    for run in runs:
        runs_data.append(
            {
                "id": run.id,
                "run_name": run.run_name,
                "ensemble": run.ensemble.value,
                "temperature_target": run.temperature_target,
                "pressure_target": run.pressure_target,
                "timestep": run.timestep,
                "n_steps": run.n_steps,
                "created_at": run.created_at.isoformat() if run.created_at else None,
            }
        )

    return {
        "total": len(runs_data),
        "limit": limit,
        "offset": offset,
        "runs": runs_data,
    }


@router.get("/runs/{run_id}")
async def get_run(run_id: int, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Get a single simulation run by ID."""
    result = await db.execute(select(SimulationRun).where(SimulationRun.id == run_id))
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    return {
        "id": run.id,
        "run_name": run.run_name,
        "description": run.description,
        "ensemble": run.ensemble.value,
        "integrator": run.integrator.value if run.integrator else None,
        "thermostat": run.thermostat.value if run.thermostat else None,
        "barostat": run.barostat.value if run.barostat else None,
        "coulomb_method": run.coulomb_method.value if run.coulomb_method else None,
        "temperature_target": run.temperature_target,
        "pressure_target": run.pressure_target,
        "timestep": run.timestep,
        "n_steps": run.n_steps,
        "total_time": run.total_time,
        "cutoff_coulomb": run.cutoff_coulomb,
        "cutoff_vdw": run.cutoff_vdw,
        "exit_code": run.exit_code,
        "error_message": run.error_message,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }


@router.get("/runs/{run_id}/artifacts")
async def list_run_artifacts(
    run_id: int, db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    """List all artifacts for a simulation run."""
    from mddatalake.db.models import Artifact

    result = await db.execute(select(Artifact).where(Artifact.simulation_run_id == run_id))
    artifacts = result.scalars().all()

    artifacts_data = []
    for artifact in artifacts:
        artifacts_data.append(
            {
                "id": artifact.id,
                "file_name": artifact.file_name,
                "artifact_type": artifact.artifact_type.value,
                "file_size_bytes": artifact.file_size_bytes,
                "checksum_sha256": artifact.checksum_sha256,
                "compression": artifact.compression,
            }
        )

    return {"run_id": run_id, "total": len(artifacts_data), "artifacts": artifacts_data}
