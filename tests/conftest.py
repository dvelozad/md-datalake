"""Pytest configuration and fixtures."""

import asyncio
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from mddatalake.db.base import Base
from mddatalake.storage import FilesystemBackend


@pytest.fixture(scope="function")
def event_loop():
    """Create event loop for async tests."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(
        "postgresql+asyncpg://mddatalake:devpassword@localhost:5433/mddatalake_test",
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    await engine.dispose()


@pytest.fixture
async def db_session(test_engine):
    """Create database session for tests."""
    async_session = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
def temp_storage(tmp_path: Path):
    """Create temporary storage backend."""
    storage_root = tmp_path / "storage"
    storage_root.mkdir()
    return FilesystemBackend(storage_root)


@pytest.fixture
def lammps_fixture_dir() -> Path:
    """Path to LAMMPS test fixtures."""
    return Path(__file__).parent / "fixtures" / "lammps" / "water_nvt"


@pytest.fixture
def gromacs_fixture_dir() -> Path:
    """Path to GROMACS test fixtures."""
    return Path(__file__).parent / "fixtures" / "gromacs" / "lysozyme"
