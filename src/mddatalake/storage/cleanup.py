"""Storage cleanup utilities for removing orphaned files."""

import logging
from collections import defaultdict
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mddatalake.db.models import Artifact
from mddatalake.storage.backend import StorageBackend

logger = logging.getLogger(__name__)


class StorageCleanup:
    """Utility for cleaning up orphaned files in storage."""

    def __init__(self, storage: StorageBackend, db: AsyncSession):
        """
        Initialize storage cleanup utility.

        Args:
            storage: Storage backend instance
            db: Database session
        """
        self.storage = storage
        self.db = db

    async def scan_storage(self) -> dict[str, Any]:
        """
        Scan storage and identify orphaned files.

        Returns:
            Dictionary with storage statistics and orphaned files
        """
        # Get all files in storage
        storage_files = await self._get_all_storage_files()

        # Get all referenced storage keys from database
        referenced_keys = await self._get_referenced_storage_keys()

        # Find orphaned files
        orphaned_files = []
        for file_info in storage_files:
            if file_info["storage_key"] not in referenced_keys:
                orphaned_files.append(file_info)

        # Calculate statistics
        total_size = sum(f["size"] for f in storage_files)
        used_size = sum(
            f["size"] for f in storage_files if f["storage_key"] in referenced_keys
        )
        orphaned_size = sum(f["size"] for f in orphaned_files)

        # Group orphaned files by extension
        orphaned_by_ext = defaultdict(list)
        for file_info in orphaned_files:
            ext = Path(file_info["path"]).suffix or "(no extension)"
            orphaned_by_ext[ext].append(file_info)

        return {
            "total_files": len(storage_files),
            "referenced_files": len(referenced_keys),
            "orphaned_files": len(orphaned_files),
            "total_size_bytes": total_size,
            "used_size_bytes": used_size,
            "orphaned_size_bytes": orphaned_size,
            "orphaned_files_list": orphaned_files,
            "orphaned_by_extension": {
                ext: {
                    "count": len(files),
                    "size_bytes": sum(f["size"] for f in files),
                }
                for ext, files in orphaned_by_ext.items()
            },
        }

    async def _get_all_storage_files(self) -> list[dict[str, Any]]:
        """
        Get all files in storage.

        Returns:
            List of file information dictionaries
        """
        files = []

        # For filesystem backend, walk the storage directory
        if hasattr(self.storage, "root"):
            storage_root = self.storage.root
            for file_path in storage_root.rglob("*"):
                if file_path.is_file():
                    # Get storage key (relative path from root)
                    storage_key = str(file_path.relative_to(storage_root))
                    files.append(
                        {
                            "path": str(file_path),
                            "storage_key": storage_key,
                            "size": file_path.stat().st_size,
                        }
                    )

        return files

    async def _get_referenced_storage_keys(self) -> set[str]:
        """
        Get all storage keys referenced in the database.

        Returns:
            Set of storage keys that are currently referenced
        """
        stmt = select(Artifact.storage_key).distinct()
        result = await self.db.execute(stmt)
        storage_keys = result.scalars().all()
        return set(storage_keys)

    async def cleanup(self, dry_run: bool = True) -> dict[str, Any]:
        """
        Clean up orphaned files from storage.

        Args:
            dry_run: If True, only report what would be deleted without deleting

        Returns:
            Dictionary with cleanup results
        """
        scan_result = await self.scan_storage()
        orphaned_files = scan_result["orphaned_files_list"]

        deleted_files = []
        deleted_size = 0
        errors = []

        if not dry_run:
            for file_info in orphaned_files:
                try:
                    # Delete the file
                    file_path = Path(file_info["path"])
                    if file_path.exists():
                        file_path.unlink()
                        deleted_files.append(file_info)
                        deleted_size += file_info["size"]
                        logger.info(f"Deleted orphaned file: {file_info['storage_key']}")

                        # Clean up empty parent directories
                        self._cleanup_empty_dirs(file_path.parent)
                except Exception as e:
                    error_msg = f"Failed to delete {file_info['path']}: {str(e)}"
                    errors.append(error_msg)
                    logger.error(error_msg)

        return {
            "dry_run": dry_run,
            "orphaned_files_found": len(orphaned_files),
            "orphaned_size_bytes": scan_result["orphaned_size_bytes"],
            "deleted_files_count": len(deleted_files),
            "deleted_size_bytes": deleted_size,
            "errors": errors,
            "deleted_files": deleted_files if not dry_run else [],
        }

    def _cleanup_empty_dirs(self, directory: Path) -> None:
        """
        Recursively remove empty parent directories.

        Args:
            directory: Directory to start cleanup from
        """
        try:
            # Only remove if empty
            if directory.exists() and not any(directory.iterdir()):
                directory.rmdir()
                logger.debug(f"Removed empty directory: {directory}")
                # Recursively clean parent
                if directory.parent != self.storage.root:
                    self._cleanup_empty_dirs(directory.parent)
        except (OSError, PermissionError) as e:
            logger.debug(f"Could not remove directory {directory}: {e}")

    def format_size(self, size_bytes: int) -> str:
        """
        Format size in bytes to human-readable format.

        Args:
            size_bytes: Size in bytes

        Returns:
            Formatted size string
        """
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024.0:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.2f} PB"
