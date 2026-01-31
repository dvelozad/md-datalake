"""Test checksum utilities."""

from pathlib import Path

import pytest

from mddatalake.utils.checksum import compute_checksum


def test_compute_checksum(tmp_path: Path):
    """Test checksum computation."""
    # Create test file
    test_file = tmp_path / "test.txt"
    test_file.write_text("Hello, MD Repo!")

    # Compute checksum
    checksum = compute_checksum(test_file)

    # Verify it's a valid SHA-256 hex digest
    assert len(checksum) == 64
    assert all(c in "0123456789abcdef" for c in checksum)

    # Verify consistency
    checksum2 = compute_checksum(test_file)
    assert checksum == checksum2
