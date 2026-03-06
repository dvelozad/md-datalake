"""Simulation run endpoints."""

import hashlib
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Body, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from mddatalake.core.config import settings
from mddatalake.core.enums import ArtifactType, EnsembleType
from mddatalake.db.models import Artifact, SimulationRun
from mddatalake.db.session import get_db
from mddatalake.storage import FilesystemBackend, S3Backend
from mddatalake.utils.checksum import compute_checksum

router = APIRouter()


class UpdateRunRequest(BaseModel):
    """Request model for updating a simulation run."""

    run_name: str | None = None
    description: str | None = None

    class Config:
        extra = "forbid"  # Don't allow extra fields


@router.get("/runs")
async def list_runs(
    db: AsyncSession = Depends(get_db),
    project_name: str | None = Query(None),
    ensemble: EnsembleType | None = Query(None),
    engine_name: str | None = Query(None),
    min_temperature: float | None = Query(None),
    max_temperature: float | None = Query(None),
    min_pressure: float | None = Query(None),
    max_pressure: float | None = Query(None),
    composition: str | None = Query(None),
    min_completeness: float | None = Query(None),
    max_completeness: float | None = Query(None),
    has_trajectory: bool | None = Query(None),
    has_topology: bool | None = Query(None),
    search: str | None = Query(None),
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
    # Track which tables we've joined for filtering
    engine_joined = False
    system_joined = False
    project_joined = False

    # Build base query
    stmt = select(SimulationRun)

    # Apply filters
    if ensemble:
        stmt = stmt.where(SimulationRun.ensemble == ensemble)

    if min_temperature is not None:
        stmt = stmt.where(SimulationRun.temperature_target >= min_temperature)

    if max_temperature is not None:
        stmt = stmt.where(SimulationRun.temperature_target <= max_temperature)

    if min_pressure is not None:
        stmt = stmt.where(SimulationRun.pressure_target >= min_pressure)

    if max_pressure is not None:
        stmt = stmt.where(SimulationRun.pressure_target <= max_pressure)

    if min_completeness is not None:
        stmt = stmt.where(SimulationRun.completeness_score >= min_completeness)

    if max_completeness is not None:
        stmt = stmt.where(SimulationRun.completeness_score <= max_completeness)

    if project_name:
        from mddatalake.db.models import Project
        stmt = stmt.join(SimulationRun.project)
        project_joined = True
        stmt = stmt.where(Project.name.ilike(f"%{project_name}%"))

    if engine_name:
        from mddatalake.db.models import MDEngine
        stmt = stmt.join(SimulationRun.engine)
        engine_joined = True
        stmt = stmt.where(MDEngine.name.ilike(f"%{engine_name}%"))

    if composition:
        from mddatalake.db.models import SystemDescription
        stmt = stmt.join(SimulationRun.system)
        system_joined = True
        stmt = stmt.where(
            SystemDescription.composition_description.ilike(f"%{composition}%")
        )

    if search:
        # Search across run_name, composition, and method
        from mddatalake.db.models import SystemDescription
        from sqlalchemy import or_

        # Only join if not already joined
        if not system_joined:
            stmt = stmt.outerjoin(SimulationRun.system)

        # Build search conditions
        search_conditions = [
            SimulationRun.run_name.ilike(f"%{search}%"),
        ]

        # Add composition search (only if system is available)
        search_conditions.append(
            SystemDescription.composition_description.ilike(f"%{search}%")
        )

        # Add simulation_method search (handle NULL values properly)
        search_conditions.append(
            SimulationRun.simulation_method.ilike(f"%{search}%")
        )

        stmt = stmt.where(or_(*search_conditions))

    if has_trajectory is not None:
        stmt = stmt.where(SimulationRun.data_quality_flags['has_trajectory'].as_boolean() == has_trajectory)

    if has_topology is not None:
        stmt = stmt.where(SimulationRun.data_quality_flags['has_topology'].as_boolean() == has_topology)

    # Add eager loading for relationships
    # Use contains_eager for joined relationships, selectinload for others
    from sqlalchemy.orm import contains_eager

    if engine_joined:
        stmt = stmt.options(contains_eager(SimulationRun.engine))
    else:
        stmt = stmt.options(selectinload(SimulationRun.engine))

    if system_joined:
        stmt = stmt.options(contains_eager(SimulationRun.system))
    else:
        stmt = stmt.options(selectinload(SimulationRun.system))

    if project_joined:
        stmt = stmt.options(contains_eager(SimulationRun.project))
    else:
        stmt = stmt.options(selectinload(SimulationRun.project))

    # Get total count before pagination
    from sqlalchemy import func
    count_stmt = select(func.count()).select_from(stmt.alias())
    total_result = await db.execute(count_stmt)
    total_count = total_result.scalar_one()

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
                "simulation_method": run.simulation_method.value if run.simulation_method else None,
                "particle_insertion": run.particle_insertion,
                "atom_style": run.atom_style.value if run.atom_style else None,
                "temperature_target": run.temperature_target,
                "pressure_target": run.pressure_target,
                "timestep": run.timestep,
                "n_steps": run.n_steps,
                "total_time": run.total_time,
                "engine": {
                    "name": run.engine.name if run.engine else "Unknown",
                    "version": run.engine.version if run.engine else "unknown",
                },
                "system": {
                    "n_atoms": run.system.n_atoms if run.system else 0,
                    "composition": run.system.composition_description if run.system else "Unknown",
                },
                "created_at": run.created_at.isoformat() if run.created_at else None,
                # Completeness fields
                "completeness_score": run.completeness_score,
                "missing_data": run.missing_data,
                "data_quality_flags": run.data_quality_flags,
            }
        )

    return {
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "runs": runs_data,
    }


@router.get("/runs/{run_id}")
async def get_run(run_id: int, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Get a single simulation run by ID."""
    stmt = select(SimulationRun).options(
        selectinload(SimulationRun.engine),
        selectinload(SimulationRun.system),
    ).where(SimulationRun.id == run_id)

    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    return {
        "id": run.id,
        "run_name": run.run_name,
        "description": run.description,
        "ensemble": run.ensemble.value,
        "simulation_method": run.simulation_method.value if run.simulation_method else None,
        "particle_insertion": run.particle_insertion,
        "integrator": run.integrator.value if run.integrator else None,
        "thermostat": run.thermostat.value if run.thermostat else None,
        "barostat": run.barostat.value if run.barostat else None,
        "coulomb_method": run.coulomb_method.value if run.coulomb_method else None,
        "atom_style": run.atom_style.value if run.atom_style else None,
        "temperature_target": run.temperature_target,
        "pressure_target": run.pressure_target,
        "timestep": run.timestep,
        "n_steps": run.n_steps,
        "total_time": run.total_time,
        "cutoff_coulomb": run.cutoff_coulomb,
        "cutoff_vdw": run.cutoff_vdw,
        "exit_code": run.exit_code,
        "error_message": run.error_message,
        "engine": {
            "name": run.engine.name if run.engine else "Unknown",
            "version": run.engine.version if run.engine else "unknown",
        },
        "system": {
            "n_atoms": run.system.n_atoms if run.system else 0,
            "composition": run.system.composition_description if run.system else "Unknown",
        },
        "created_at": run.created_at.isoformat() if run.created_at else None,
        # Completeness fields
        "completeness_score": run.completeness_score,
        "missing_data": run.missing_data,
        "data_quality_flags": run.data_quality_flags,
        # LAMMPS-specific fields
        "atom_type_mapping": run.atom_type_mapping,
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
                "storage_key": artifact.storage_key,  # DEBUG: temporary
            }
        )

    return {"run_id": run_id, "total": len(artifacts_data), "artifacts": artifacts_data}


@router.get("/runs/{run_id}/artifacts/{artifact_id}/download")
async def download_artifact(
    run_id: int,
    artifact_id: int,
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """
    Download a specific artifact file.

    Returns the file with appropriate content-type headers.
    """
    # Get the artifact
    result = await db.execute(
        select(Artifact).where(
            Artifact.id == artifact_id,
            Artifact.simulation_run_id == run_id
        )
    )
    artifact = result.scalar_one_or_none()

    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    # Initialize storage backend
    if settings.storage_backend == "s3":
        storage = S3Backend()
    else:
        storage = FilesystemBackend(settings.storage_root)

    # Get file path from storage key
    if settings.storage_backend == "s3":
        # For S3, download to temp file
        temp_file = Path(tempfile.mktemp(suffix=Path(artifact.file_name).suffix))
        try:
            await storage.download(artifact.storage_key, temp_file)
            file_path = temp_file
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve file from storage: {str(e)}"
            )
    else:
        # For filesystem, construct path directly
        file_path = Path(settings.storage_root) / artifact.storage_key

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="File not found in storage"
        )

    # Return file response
    return FileResponse(
        path=str(file_path),
        filename=artifact.file_name,
        media_type="application/octet-stream",
    )


@router.get("/runs/{run_id}/artifacts/download-all")
async def download_all_artifacts(
    run_id: int,
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """
    Download all artifacts for a run as a compressed zip file.

    Creates a temporary zip file containing all artifacts and returns it.
    """
    # Get the run
    run_result = await db.execute(
        select(SimulationRun).where(SimulationRun.id == run_id)
    )
    run = run_result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Get all artifacts for this run
    artifacts_result = await db.execute(
        select(Artifact).where(Artifact.simulation_run_id == run_id)
    )
    artifacts = artifacts_result.scalars().all()

    if not artifacts:
        raise HTTPException(
            status_code=404,
            detail="No artifacts found for this run"
        )

    # Initialize storage backend
    if settings.storage_backend == "s3":
        storage = S3Backend()
    else:
        storage = FilesystemBackend(settings.storage_root)

    # Create temporary zip file
    temp_dir = Path(tempfile.mkdtemp(prefix="artifact_download_"))
    zip_path = temp_dir / f"run_{run_id}_artifacts.zip"

    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for artifact in artifacts:
                try:
                    # Get file path from storage
                    if settings.storage_backend == "s3":
                        # For S3, download to temp file
                        temp_file = temp_dir / artifact.file_name
                        await storage.download(artifact.storage_key, temp_file)
                        file_path = temp_file
                    else:
                        # For filesystem, construct path directly
                        file_path = Path(settings.storage_root) / artifact.storage_key

                    if file_path.exists():
                        # Add to zip with original filename
                        zipf.write(file_path, arcname=artifact.file_name)
                except Exception as e:
                    # Log error but continue with other files
                    print(f"Warning: Failed to add {artifact.file_name} to zip: {e}")

        # Return zip file
        return FileResponse(
            path=str(zip_path),
            filename=f"run_{run_id}_{run.run_name}_artifacts.zip",
            media_type="application/zip",
            background=lambda: shutil.rmtree(temp_dir, ignore_errors=True),
        )

    except Exception as e:
        # Cleanup on error
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create zip file: {str(e)}"
        )


@router.get("/runs/{run_id}/observables")
async def list_run_observables(
    run_id: int, db: AsyncSession = Depends(get_db)
) -> list[dict[str, Any]]:
    """List all observables for a simulation run."""
    from mddatalake.db.models import Observable

    result = await db.execute(select(Observable).where(Observable.simulation_run_id == run_id))
    observables = result.scalars().all()

    observables_data = []
    for obs in observables:
        observables_data.append(
            {
                "id": obs.id,
                "simulation_run_id": obs.simulation_run_id,
                "observable_name": obs.observable_name,
                "observable_type": obs.observable_type,
                "value_mean": obs.value_mean,
                "value_std": obs.value_std,
                "value_min": obs.value_min,
                "value_max": obs.value_max,
                "units": obs.units,
                "timeseries_data": obs.timeseries_data,  # Full timeseries for plotting
            }
        )

    return observables_data


@router.get("/runs/{run_id}/available-observables")
async def get_available_observables(
    run_id: int, db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    """Get available observable columns for plotting."""
    from mddatalake.db.models import Observable, SimulationRun

    # Get simulation run to check engine
    run_result = await db.execute(
        select(SimulationRun)
        .options(selectinload(SimulationRun.engine))
        .where(SimulationRun.id == run_id)
    )
    run = run_result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Get observables for this run
    obs_result = await db.execute(
        select(Observable).where(Observable.simulation_run_id == run_id)
    )
    observables = obs_result.scalars().all()

    if not observables:
        return {
            "available": False,
            "columns": [],
            "engine": run.engine.name if run.engine else "unknown",
            "message": "Log file not found - no thermodynamic data extracted",
        }

    # Extract column names (observable names mapped to LAMMPS column names)
    # Map back to LAMMPS column names for frontend compatibility
    name_to_column_map = {
        "Temperature": "Temp",
        "Pressure": "Press",
        "Volume": "Volume",
        "Density": "Density",
        "Total Energy": "TotEng",
        "Kinetic Energy": "KinEng",
        "Potential Energy": "PotEng",
        "Pair Energy": "E_pair",
        "Bond Energy": "E_bond",
        "Angle Energy": "E_angle",
        "Dihedral Energy": "E_dihed",
        "Van der Waals Energy": "E_vdwl",
        "Coulomb Energy": "E_coul",
        "Long-range Energy": "E_long",
    }

    columns = ["Step"]  # Always include Step for x-axis
    for obs in observables:
        column_name = name_to_column_map.get(obs.observable_name, obs.observable_name)
        columns.append(column_name)

    return {
        "available": True,
        "columns": columns,
        "engine": run.engine.name if run.engine else "unknown",
        "message": "Observables loaded from database",
    }


@router.get("/runs/{run_id}/plot-data")
async def get_plot_data(
    run_id: int,
    observables: list[str] = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get plot data for selected observables."""
    from mddatalake.db.models import Observable, SimulationRun

    # Get simulation run
    run_result = await db.execute(
        select(SimulationRun)
        .options(selectinload(SimulationRun.engine))
        .where(SimulationRun.id == run_id)
    )
    run = run_result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Get all observables for this run
    obs_result = await db.execute(
        select(Observable).where(Observable.simulation_run_id == run_id)
    )
    all_observables = obs_result.scalars().all()

    if not all_observables:
        raise HTTPException(
            status_code=404,
            detail="No observables found - log file may not have been processed",
        )

    # Map observable names to LAMMPS column names
    name_to_column_map = {
        "Temperature": "Temp",
        "Pressure": "Press",
        "Volume": "Volume",
        "Density": "Density",
        "Total Energy": "TotEng",
        "Kinetic Energy": "KinEng",
        "Potential Energy": "PotEng",
        "Pair Energy": "E_pair",
        "Bond Energy": "E_bond",
        "Angle Energy": "E_angle",
        "Dihedral Energy": "E_dihed",
        "Van der Waals Energy": "E_vdwl",
        "Coulomb Energy": "E_coul",
        "Long-range Energy": "E_long",
    }

    # Build reverse map
    column_to_name_map = {v: k for k, v in name_to_column_map.items()}

    # Prepare data structure
    data = {}
    units = {}
    columns_returned = []

    # Get timesteps from first observable
    if all_observables[0].timeseries_data:
        data["Step"] = all_observables[0].timeseries_data.get("timesteps", [])

    # Filter observables by requested columns
    for obs in all_observables:
        column_name = name_to_column_map.get(obs.observable_name, obs.observable_name)

        # If specific observables requested, filter
        if observables and column_name not in observables:
            continue

        # Extract data
        if obs.timeseries_data:
            data[column_name] = obs.timeseries_data.get("values", [])
            units[column_name] = obs.units or ""
            columns_returned.append(column_name)

    return {
        "columns": ["Step"] + columns_returned,
        "data": data,
        "units": units,
        "engine": run.engine.name if run.engine else "unknown",
        "n_points": len(data.get("Step", [])),
    }


@router.patch("/runs/{run_id}")
async def update_run(
    run_id: int,
    update_data: UpdateRunRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Update simulation run details.

    Only run_name and description can be updated.
    Other fields are derived from the simulation data.
    """
    # Get the run
    stmt = select(SimulationRun).where(SimulationRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Update fields
    if update_data.run_name is not None:
        run.run_name = update_data.run_name
    if update_data.description is not None:
        run.description = update_data.description

    # Commit changes
    await db.commit()
    await db.refresh(run)

    return {
        "id": run.id,
        "run_name": run.run_name,
        "description": run.description,
        "message": "Run updated successfully",
    }


@router.delete("/runs/{run_id}")
async def delete_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Delete a simulation run and all associated data.

    This will cascade delete:
    - Artifacts
    - Observables
    - System information
    - Engine information
    - Visualization sessions

    WARNING: This operation cannot be undone.
    """
    # Check if run exists
    stmt = select(SimulationRun).where(SimulationRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Delete the run (cascade deletes will handle related records)
    await db.delete(run)
    await db.commit()

    return {
        "id": run_id,
        "status": "deleted",
        "message": f"Run {run_id} and all associated data deleted successfully",
    }


@router.post("/runs/{run_id}/artifacts/upload")
async def upload_artifacts_to_run(
    run_id: int,
    files: Annotated[list[UploadFile], File()],
    artifact_types: Annotated[str | None, Form()] = None,  # JSON string of {filename: type}
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Upload additional artifacts to an existing simulation run.

    This endpoint allows you to add supplementary files to a run that has already
    been ingested, such as:
    - Missing log files for metadata extraction
    - Additional checkpoint files
    - Analysis results
    - Topology files for structure visualization

    Args:
        run_id: ID of the simulation run
        files: List of files to upload
        artifact_types: Optional JSON mapping of filename to artifact type override
        db: Database session

    Returns:
        Information about uploaded artifacts and updated completeness score
    """
    if not files:
        raise HTTPException(status_code=422, detail="No files provided")

    # Check if run exists
    stmt = select(SimulationRun).where(SimulationRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Parse artifact type overrides if provided
    import json
    type_overrides = {}
    if artifact_types:
        try:
            type_overrides = json.loads(artifact_types)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=422,
                detail="Invalid artifact_types format. Expected JSON object."
            )

    # Initialize storage backend
    if settings.storage_backend == "s3":
        storage = S3Backend()
    else:
        storage = FilesystemBackend(settings.storage_root)

    temp_dir = None
    uploaded_artifacts = []

    try:
        # Create temp directory
        temp_dir = Path(tempfile.mkdtemp(prefix="artifact_upload_"))

        # Save and process each file
        for upload_file in files:
            if not upload_file.filename:
                continue

            # Save to temp location
            temp_file = temp_dir / upload_file.filename
            with open(temp_file, "wb") as f:
                content = await upload_file.read()
                f.write(content)

            # Get artifact type (from override or auto-classify)
            if upload_file.filename in type_overrides:
                artifact_type = ArtifactType(type_overrides[upload_file.filename])
            else:
                # Auto-classify based on filename
                artifact_type = _classify_artifact_file(upload_file.filename)

            # Compute checksum
            checksum = compute_checksum(temp_file, settings.checksum_algorithm)

            # Check if artifact with same checksum already exists
            existing_stmt = select(Artifact).where(
                Artifact.simulation_run_id == run_id,
                Artifact.checksum_sha256 == checksum
            )
            existing_result = await db.execute(existing_stmt)
            if existing_result.scalar_one_or_none():
                uploaded_artifacts.append({
                    "filename": upload_file.filename,
                    "status": "skipped",
                    "message": "File already exists (duplicate checksum)"
                })
                continue

            # Generate storage key
            storage_key = f"runs/{run_id}/artifacts/{upload_file.filename}"

            # Store file
            await storage.store(temp_file, storage_key)

            # Create artifact record
            artifact = Artifact(
                simulation_run_id=run_id,
                file_name=upload_file.filename,
                file_path=str(temp_file),
                artifact_type=artifact_type,
                storage_key=storage_key,
                checksum_sha256=checksum,
                file_size_bytes=temp_file.stat().st_size,
                compression=None,
            )
            db.add(artifact)

            uploaded_artifacts.append({
                "filename": upload_file.filename,
                "artifact_type": artifact_type.value,
                "file_size_bytes": temp_file.stat().st_size,
                "status": "uploaded",
            })

        # Commit all artifacts
        await db.commit()

        # Refresh run to get updated relationships
        await db.refresh(run)

        # TODO: Recalculate completeness score after adding artifacts
        # This would require calling the completeness calculation logic

        return {
            "run_id": run_id,
            "uploaded_count": len([a for a in uploaded_artifacts if a["status"] == "uploaded"]),
            "skipped_count": len([a for a in uploaded_artifacts if a["status"] == "skipped"]),
            "artifacts": uploaded_artifacts,
            "message": f"Successfully uploaded {len([a for a in uploaded_artifacts if a['status'] == 'uploaded'])} artifact(s)",
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Upload failed: {str(e)}")
    finally:
        # Cleanup temp directory
        if temp_dir and temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)


def _classify_artifact_file(filename: str) -> ArtifactType:
    """Classify artifact file by filename pattern."""
    name = filename.lower()
    suffix = Path(filename).suffix.lower()

    # Trajectories
    if suffix in [".dump", ".lammpstrj", ".dcd", ".xtc", ".trr"] or "traj" in name:
        return ArtifactType.TRAJECTORY

    # Topology
    if suffix in [".data", ".gro", ".pdb", ".top", ".psf"]:
        return ArtifactType.TOPOLOGY

    # Input scripts
    if suffix in [".in", ".mdp", ".lammps"] or name.startswith("in."):
        return ArtifactType.INPUT

    # Log files
    if suffix in [".log", ".out"] or name.startswith("log."):
        return ArtifactType.LOG

    # Energy files
    if suffix in [".edr", ".tpr"]:
        return ArtifactType.ENERGY

    # Checkpoint files
    if "restart" in name or "checkpoint" in name:
        return ArtifactType.CHECKPOINT

    # Analysis files
    if "analysis" in name or suffix in [".dat", ".csv", ".json"]:
        return ArtifactType.ANALYSIS

    # Default
    return ArtifactType.OTHER
