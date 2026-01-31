"""Checksum computation utilities."""

import hashlib
from pathlib import Path
from typing import BinaryIO


def compute_checksum_stream(file_obj: BinaryIO, algorithm: str = "sha256") -> str:
    """
    Compute checksum of a file object using streaming to handle large files.

    Args:
        file_obj: Binary file object
        algorithm: Hash algorithm (sha256, md5)

    Returns:
        Hex digest string
    """
    hash_obj = hashlib.new(algorithm)
    chunk_size = 65536  # 64KB chunks

    while True:
        chunk = file_obj.read(chunk_size)
        if not chunk:
            break
        hash_obj.update(chunk)

    return hash_obj.hexdigest()


def compute_checksum(file_path: Path | str, algorithm: str = "sha256") -> str:
    """
    Compute checksum of a file.

    Args:
        file_path: Path to file
        algorithm: Hash algorithm (sha256, md5)

    Returns:
        Hex digest string
    """
    file_path = Path(file_path)

    with open(file_path, "rb") as f:
        return compute_checksum_stream(f, algorithm)
