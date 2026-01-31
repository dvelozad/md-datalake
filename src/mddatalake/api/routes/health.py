"""Health check endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from mddatalake.db.session import get_db

router = APIRouter()


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Health check endpoint.

    Verifies:
    - API is running
    - Database is accessible
    """
    # Check database connection
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "database": db_status,
        "storage": "accessible",  # TODO: Check storage backend
    }
