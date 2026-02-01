"""Upload endpoint for web-based trajectory ingestion."""

from pathlib import Path
import tempfile
import shutil
from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from mddatalake.db.session import get_db
from mddatalake.ingestion.service import IngestionService
from mddatalake.parsers import detect_engine

router = APIRouter()

# Allowed file extensions for MD simulations
ALLOWED_EXTENSIONS = {
    ".dcd", ".xtc", ".trr", ".dump", ".lammpstrj",  # Trajectories
    ".pdb", ".gro", ".data", ".top", ".psf",        # Topology
    ".in", ".mdp", ".lammps",                       # Input scripts
    ".log", ".txt", ".out", ".tpr", ".edr"          # Logs & other
}

MAX_FILE_SIZE_MB = 5000  # 5GB per file


def validate_file_extension(filename: str) -> bool:
    """Check if file extension is allowed."""
    ext = Path(filename).suffix.lower()
    return ext in ALLOWED_EXTENSIONS


def validate_file_size(size: int) -> bool:
    """Check if file size is within limits."""
    max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
    return size <= max_bytes


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
            if not validate_file_size(file_size):
                raise HTTPException(
                    status_code=422,
                    detail=f"File {upload_file.filename} exceeds maximum size of {MAX_FILE_SIZE_MB}MB"
                )

        # Validate uploaded files form a valid simulation directory
        engine_name = await validate_upload_directory(temp_dir)

        # Call ingestion service
        ingestion_service = IngestionService(db)
        run_id = await ingestion_service.ingest(
            directory=temp_dir,
            project_name=project_name,
            run_name=run_name,
            description=description,
        )

        # Format size for response
        size_mb = total_bytes / (1024 * 1024)

        return {
            "run_id": run_id,
            "status": "success",
            "message": f"Successfully uploaded and ingested {engine_name} run {run_id}",
            "files_count": len(files),
            "total_size_mb": round(size_mb, 2),
            "engine": engine_name,
        }

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Catch all other exceptions and return as 400
        raise HTTPException(
            status_code=400,
            detail=f"Upload failed: {str(e)}"
        )
    finally:
        # Cleanup temp directory
        if temp_dir and temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
