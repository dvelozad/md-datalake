"""Artifact endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mddatalake.core.config import settings
from mddatalake.db.models import Artifact
from mddatalake.db.session import get_db
from mddatalake.storage import FilesystemBackend, S3Backend

router = APIRouter()


def get_storage_backend():
    """Get storage backend based on configuration."""
    if settings.storage_backend == "s3":
        return S3Backend()
    else:
        return FilesystemBackend(settings.storage_root)


@router.get("/artifacts/{artifact_id}")
async def get_artifact(artifact_id: int, db: AsyncSession = Depends(get_db)):
    """Get artifact metadata."""
    result = await db.execute(select(Artifact).where(Artifact.id == artifact_id))
    artifact = result.scalar_one_or_none()

    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    return {
        "id": artifact.id,
        "simulation_run_id": artifact.simulation_run_id,
        "file_name": artifact.file_name,
        "artifact_type": artifact.artifact_type.value,
        "storage_key": artifact.storage_key,
        "checksum_sha256": artifact.checksum_sha256,
        "file_size_bytes": artifact.file_size_bytes,
        "compression": artifact.compression,
        "created_at": artifact.created_at.isoformat() if artifact.created_at else None,
    }


@router.get("/artifacts/{artifact_id}/download")
async def download_artifact(artifact_id: int, db: AsyncSession = Depends(get_db)):
    """Download artifact file."""
    result = await db.execute(select(Artifact).where(Artifact.id == artifact_id))
    artifact = result.scalar_one_or_none()

    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    # Get storage backend
    storage = get_storage_backend()

    # Download file as stream
    try:
        file_stream = await storage.download_stream(artifact.storage_key)

        return StreamingResponse(
            file_stream,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{artifact.file_name}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download artifact: {str(e)}")
