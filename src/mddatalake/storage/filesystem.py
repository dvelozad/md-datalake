"""Filesystem storage backend with content-addressed storage (CAS)."""

import shutil
from io import BytesIO
from pathlib import Path
from typing import BinaryIO

from mddatalake.core.exceptions import StorageError
from mddatalake.storage.backend import StorageBackend
from mddatalake.utils.checksum import compute_checksum


class FilesystemBackend(StorageBackend):
    """Filesystem storage backend using content-addressed storage."""

    def __init__(self, root: str | Path):
        """
        Initialize filesystem backend.

        Args:
            root: Root directory for storage
        """
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _get_cas_path(self, checksum: str, extension: str = "") -> Path:
        """
        Get content-addressed storage path.

        Uses 2-level directory structure: {AA}/{BB}/{CHECKSUM}.{ext}

        Args:
            checksum: SHA-256 checksum
            extension: File extension

        Returns:
            Path in CAS structure
        """
        if len(checksum) < 4:
            raise ValueError(f"Checksum too short: {checksum}")

        # Split checksum: first 2 chars, next 2 chars, remainder
        aa = checksum[:2]
        bb = checksum[2:4]

        cas_dir = self.root / "by-checksum" / "sha256" / aa / bb
        cas_dir.mkdir(parents=True, exist_ok=True)

        filename = f"{checksum}{extension}"
        return cas_dir / filename

    async def upload(
        self, file_path: Path, storage_key: str, checksum: str | None = None
    ) -> str:
        """Upload file to filesystem storage with CAS."""
        file_path = Path(file_path)

        if not file_path.exists():
            raise StorageError(f"File not found: {file_path}")

        # Compute checksum if not provided
        if checksum is None:
            checksum = compute_checksum(file_path)

        # Get extension from original file
        extension = "".join(file_path.suffixes)

        # Get CAS path
        cas_path = self._get_cas_path(checksum, extension)

        # If file already exists with same checksum, skip upload (deduplication)
        if cas_path.exists():
            # Verify checksum matches
            existing_checksum = compute_checksum(cas_path)
            if existing_checksum != checksum:
                raise StorageError(f"Checksum mismatch for existing file: {cas_path}")
            return str(cas_path.relative_to(self.root))

        # Copy file to CAS location
        shutil.copy2(file_path, cas_path)

        # Verify uploaded file
        uploaded_checksum = compute_checksum(cas_path)
        if uploaded_checksum != checksum:
            cas_path.unlink()
            raise StorageError(f"Upload verification failed: checksum mismatch")

        return str(cas_path.relative_to(self.root))

    async def download(self, storage_key: str, output_path: Path) -> None:
        """Download file from filesystem storage."""
        source_path = self.root / storage_key

        if not source_path.exists():
            raise StorageError(f"File not found in storage: {storage_key}")

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        shutil.copy2(source_path, output_path)

    async def download_stream(self, storage_key: str) -> BinaryIO:
        """Download file as a stream."""
        source_path = self.root / storage_key

        if not source_path.exists():
            raise StorageError(f"File not found in storage: {storage_key}")

        # Read entire file into BytesIO for simplicity
        # For production, could use file handle directly
        with open(source_path, "rb") as f:
            data = f.read()

        return BytesIO(data)

    async def exists(self, storage_key: str) -> bool:
        """Check if file exists."""
        return (self.root / storage_key).exists()

    async def delete(self, storage_key: str) -> None:
        """Delete file from storage."""
        file_path = self.root / storage_key

        if file_path.exists():
            file_path.unlink()

    async def get_size(self, storage_key: str) -> int:
        """Get file size."""
        file_path = self.root / storage_key

        if not file_path.exists():
            raise StorageError(f"File not found in storage: {storage_key}")

        return file_path.stat().st_size
