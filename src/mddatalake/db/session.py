"""Database session management."""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from mddatalake.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.log_level == "DEBUG",
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for FastAPI to get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database (create tables if needed)."""
    from mddatalake.db.base import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
