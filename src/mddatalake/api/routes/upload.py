"""Upload endpoint for web-based trajectory ingestion."""

from pathlib import Path
import tempfile
import shutil
from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from mddatalake.core.config import settings
from mddatalake.core.enums import ArtifactType, ValidationLevel
from mddatalake.db.session import get_db
from mddatalake.ingestion.service import IngestionService
from mddatalake.ingestion.validators import (
    ALLOWED_EXTENSIONS,
    FilesetValidator,
    validate_file_extension,
    validate_file_size,
)
from mddatalake.parsers import detect_engine

router = APIRouter()


def classify_file(filename: str, engine: str) -> ArtifactType:
    """
    Classify file as artifact type based on filename and engine.

    Args:
        filename: Name of the file
        engine: MD engine (lammps or gromacs)

    Returns:
        ArtifactType classification
    """
    name = filename.lower()
    suffix = Path(filename).suffix.lower()
    stem = Path(filename).stem.lower()  # filename without extension

    # Trajectories
    if suffix in [".dump", ".lammpstrj", ".dcd", ".xtc", ".trr"] or "traj" in name:
        return ArtifactType.TRAJECTORY

    # Input scripts (check BEFORE topology, as .lmp can be either)
    if suffix in [".in", ".mdp", ".lammps"]:
        return ArtifactType.INPUT
    if name.startswith("in.") or stem.startswith("in"):
        return ArtifactType.INPUT
    # .lmp files that are input scripts
    if suffix == ".lmp":
        # Explicitly check stem for input script patterns
        if stem in ["run", "input"] or stem.startswith("in") or "run" in stem or "input" in stem:
            return ArtifactType.INPUT

    # Topology/data files
    if engine.lower() == "lammps":
        # Files starting with "data." are LAMMPS data files (topology)
        if name.startswith("data.") or suffix == ".data":
            return ArtifactType.TOPOLOGY
        # .lmp files with "data" in stem are topology files
        if suffix == ".lmp" and "data" in stem:
            return ArtifactType.TOPOLOGY
    else:  # GROMACS
        if suffix in [".gro", ".pdb", ".top", ".psf"]:
            return ArtifactType.TOPOLOGY

    # Log files
    if suffix in [".log", ".out"] or name.startswith("log.") or stem == "log":
        return ArtifactType.LOG

    # Energy files
    if suffix in [".edr", ".tpr"]:
        return ArtifactType.ENERGY

    # Checkpoint files
    if "restart" in name or "checkpoint" in name:
        return ArtifactType.CHECKPOINT

    # Everything else
    return ArtifactType.OTHER


async def validate_upload_directory(temp_dir: Path) -> str:
    """Validate uploaded files form a valid simulation directory."""
    try:
        engine_name = detect_engine(temp_dir)
        return engine_name
    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot detect MD engine from uploaded files: {str(e)}"
        )


async def save_upload_file(upload_file: UploadFile, destination: Path) -> int:
    """Stream upload file to disk in 64KB chunks."""
    chunk_size = 65536
    total_size = 0

    with open(destination, "wb") as f:
        while chunk := await upload_file.read(chunk_size):
            f.write(chunk)
            total_size += len(chunk)

    return total_size


@router.post("/upload")
async def upload_simulation(
    # Metadata
    project_name: Annotated[str, Form()],
    run_name: Annotated[str, Form()],
    description: Annotated[str | None, Form()] = None,
    atom_style: Annotated[str | None, Form()] = None,  # LAMMPS atom style
    simulation_method: Annotated[str | None, Form()] = None,  # Simulation method (ATOMISTIC, H_ADRESS)
    ensemble: Annotated[str | None, Form()] = None,  # Ensemble type (NVE, NVT, NPT, etc.)
    temperature_target: Annotated[float | None, Form()] = None,  # Target temperature in Kelvin
    pressure_target: Annotated[float | None, Form()] = None,  # Target pressure in atmospheres
    artifact_types: Annotated[str | None, Form()] = None,  # JSON mapping of filename -> artifact_type
    # Files
    files: Annotated[list[UploadFile], File()] = [],
    # Database session
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Upload simulation files and ingest into database.

    Accepts multiple files (trajectory + optional supplementary files).
    Automatically detects LAMMPS vs GROMACS from uploaded files.

    Args:
        project_name: Name of the project
        run_name: Name of the simulation run
        description: Optional description
        atom_style: LAMMPS atom style (required for LAMMPS trajectories)
        files: List of uploaded files
        db: Database session

    Returns:
        Dictionary with run_id, status, and message

    Raises:
        HTTPException: If validation fails or ingestion errors occur
    """
    if not files:
        raise HTTPException(
            status_code=422,
            detail="No files provided. Please upload at least one simulation file."
        )

    temp_dir = None
    try:
        # Validate file extensions
        invalid_files = [
            f.filename for f in files
            if not validate_file_extension(f.filename or "")
        ]
        if invalid_files:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid file types: {', '.join(invalid_files)}. "
                       f"Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            )

        # Create temp directory
        temp_dir = Path(tempfile.mkdtemp(prefix="upload_"))

        # Save uploaded files to temp directory
        total_bytes = 0
        for upload_file in files:
            if not upload_file.filename:
                continue

            file_path = temp_dir / upload_file.filename
            file_size = await save_upload_file(upload_file, file_path)
            total_bytes += file_size

            # Validate size
            if not validate_file_size(file_size, settings.max_file_size_mb):
                raise HTTPException(
                    status_code=422,
                    detail=f"File {upload_file.filename} exceeds maximum size of {settings.max_file_size_mb}MB"
                )

        # Validate uploaded files form a valid simulation directory
        engine_name = await validate_upload_directory(temp_dir)

        # Parse user-provided artifact types if available
        user_artifact_types = {}
        if artifact_types:
            import json
            try:
                user_artifact_types = json.loads(artifact_types)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=422,
                    detail="Invalid artifact_types JSON format"
                )

        # Classify artifacts
        artifacts = []
        for file_path in temp_dir.glob("*"):
            if file_path.is_file():
                # Use user-provided type if available, otherwise auto-classify
                if file_path.name in user_artifact_types:
                    artifact_type = user_artifact_types[file_path.name]
                else:
                    artifact_type = classify_file(file_path.name, engine_name)

                artifacts.append({
                    "file_name": file_path.name,
                    "artifact_type": artifact_type,
                    "file_size": file_path.stat().st_size,
                })

        # For LAMMPS, enforce single topology file rule
        # Prefer data.* files over .lmp files as topology
        if engine_name.lower() == "lammps":
            topology_artifacts = [a for a in artifacts if a["artifact_type"] == ArtifactType.TOPOLOGY]
            if len(topology_artifacts) > 1:
                # Find data.* file (preferred topology)
                data_file = next((a for a in topology_artifacts if a["file_name"].lower().startswith("data.")), None)
                # Reclassify other topology files as OTHER
                for artifact in artifacts:
                    if artifact["artifact_type"] == ArtifactType.TOPOLOGY:
                        if data_file and artifact["file_name"] != data_file["file_name"]:
                            artifact["artifact_type"] = ArtifactType.OTHER

        # Validate artifacts
        validator = FilesetValidator()
        validation_result = validator.validate_artifacts(
            artifacts, engine_name, mode=settings.validation_mode
        )

        if not validation_result.valid:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "File validation failed",
                    "errors": validation_result.errors,
                    "warnings": validation_result.warnings,
                    "recommendations": validation_result.recommendations,
                    "validation_mode": settings.validation_mode.value,
                }
            )

        # Call ingestion service
        ingestion_service = IngestionService(db)
        run_id = await ingestion_service.ingest(
            directory=temp_dir,
            project_name=project_name,
            run_name=run_name,
            description=description,
            atom_style=atom_style,
            simulation_method=simulation_method,
            ensemble=ensemble,
            temperature_target=temperature_target,
            pressure_target=pressure_target,
            user_artifact_types=user_artifact_types if user_artifact_types else None,
        )

        # Format size for response
        size_mb = total_bytes / (1024 * 1024)

        response = {
            "run_id": run_id,
            "status": "success",
            "message": f"Successfully uploaded and ingested {engine_name} run {run_id}",
            "files_count": len(files),
            "total_size_mb": round(size_mb, 2),
            "engine": engine_name,
        }

        # Include validation warnings and recommendations if present
        if validation_result.warnings or validation_result.recommendations:
            response["validation"] = {
                "warnings": validation_result.warnings,
                "recommendations": validation_result.recommendations,
            }

        return response

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Log the full error for debugging
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Upload failed: {str(e)}")
        logger.error(traceback.format_exc())

        # Catch all other exceptions and return as 400
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Upload failed",
                "error": str(e),
                "error_type": type(e).__name__,
            }
        )
    finally:
        # Cleanup temp directory
        if temp_dir and temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
