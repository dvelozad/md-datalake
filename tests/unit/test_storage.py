"""Test storage backends."""

from pathlib import Path

import pytest

from mddatalake.storage import FilesystemBackend
from mddatalake.utils.checksum import compute_checksum


@pytest.mark.asyncio
async def test_filesystem_backend_upload_download(tmp_path: Path):
    """Test filesystem backend upload and download."""
    # Create backend
    storage_root = tmp_path / "storage"
    backend = FilesystemBackend(storage_root)

    # Create test file
    test_file = tmp_path / "test.txt"
    test_content = "Hello, MD Repo!"
    test_file.write_text(test_content)

    # Compute checksum
    checksum = compute_checksum(test_file)

    # Upload
    storage_key = await backend.upload(test_file, "", checksum)

    # Verify file exists
    assert await backend.exists(storage_key)

    # Download
    download_path = tmp_path / "downloaded.txt"
    await backend.download(storage_key, download_path)

    # Verify content
    assert download_path.read_text() == test_content


@pytest.mark.asyncio
async def test_filesystem_backend_deduplication(tmp_path: Path):
    """Test that identical files are deduplicated."""
    storage_root = tmp_path / "storage"
    backend = FilesystemBackend(storage_root)

    # Create two identical files
    file1 = tmp_path / "file1.txt"
    file2 = tmp_path / "file2.txt"
    content = "Identical content"
    file1.write_text(content)
    file2.write_text(content)

    # Upload both
    checksum = compute_checksum(file1)
    key1 = await backend.upload(file1, "", checksum)
    key2 = await backend.upload(file2, "", checksum)

    # Verify same storage key (deduplication)
    assert key1 == key2
