"""Storage backends for artifacts."""

from mddatalake.storage.backend import StorageBackend
from mddatalake.storage.filesystem import FilesystemBackend
from mddatalake.storage.s3 import S3Backend


def get_storage_backend() -> StorageBackend:
    """
    Get configured storage backend.

    Returns:
        Storage backend instance based on configuration
    """
    from mddatalake.core.config import settings

    if settings.storage_backend == "s3":
        return S3Backend()
    else:
        return FilesystemBackend(settings.storage_root)


__all__ = ["StorageBackend", "FilesystemBackend", "S3Backend", "get_storage_backend"]
