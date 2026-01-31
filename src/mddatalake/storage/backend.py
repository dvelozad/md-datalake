"""Abstract storage backend interface."""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO


class StorageBackend(ABC):
    """Abstract base class for storage backends."""

    @abstractmethod
    async def upload(
        self, file_path: Path, storage_key: str, checksum: str | None = None
    ) -> str:
        """
        Upload a file to storage.

        Args:
            file_path: Local file path
            storage_key: Key/path in storage
            checksum: Optional checksum to verify

        Returns:
            Storage key of uploaded file
        """
        pass

    @abstractmethod
    async def download(self, storage_key: str, output_path: Path) -> None:
        """
        Download a file from storage.

        Args:
            storage_key: Key/path in storage
            output_path: Local destination path
        """
        pass

    @abstractmethod
    async def download_stream(self, storage_key: str) -> BinaryIO:
        """
        Download a file from storage as a stream.

        Args:
            storage_key: Key/path in storage

        Returns:
            Binary stream of file contents
        """
        pass

    @abstractmethod
    async def exists(self, storage_key: str) -> bool:
        """
        Check if a file exists in storage.

        Args:
            storage_key: Key/path in storage

        Returns:
            True if file exists
        """
        pass

    @abstractmethod
    async def delete(self, storage_key: str) -> None:
        """
        Delete a file from storage.

        Args:
            storage_key: Key/path in storage
        """
        pass

    @abstractmethod
    async def get_size(self, storage_key: str) -> int:
        """
        Get file size in bytes.

        Args:
            storage_key: Key/path in storage

        Returns:
            File size in bytes
        """
        pass
