"""Compression utilities."""

import gzip
import lzma
import shutil
from pathlib import Path


def compress_file(
    input_path: Path | str, output_path: Path | str, format: str = "gzip"
) -> None:
    """
    Compress a file.

    Args:
        input_path: Input file path
        output_path: Output compressed file path
        format: Compression format (gzip, xz, zstd)
    """
    input_path = Path(input_path)
    output_path = Path(output_path)

    if format == "gzip":
        with open(input_path, "rb") as f_in:
            with gzip.open(output_path, "wb", compresslevel=6) as f_out:
                shutil.copyfileobj(f_in, f_out)
    elif format == "xz":
        with open(input_path, "rb") as f_in:
            with lzma.open(output_path, "wb", preset=6) as f_out:
                shutil.copyfileobj(f_in, f_out)
    elif format == "zstd":
        try:
            import zstandard as zstd

            with open(input_path, "rb") as f_in:
                with open(output_path, "wb") as f_out:
                    cctx = zstd.ZstdCompressor(level=6)
                    cctx.copy_stream(f_in, f_out)
        except ImportError:
            raise ImportError("zstandard library required for zstd compression")
    else:
        raise ValueError(f"Unsupported compression format: {format}")


def decompress_file(
    input_path: Path | str, output_path: Path | str, format: str = "gzip"
) -> None:
    """
    Decompress a file.

    Args:
        input_path: Input compressed file path
        output_path: Output decompressed file path
        format: Compression format (gzip, xz, zstd)
    """
    input_path = Path(input_path)
    output_path = Path(output_path)

    if format == "gzip":
        with gzip.open(input_path, "rb") as f_in:
            with open(output_path, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)
    elif format == "xz":
        with lzma.open(input_path, "rb") as f_in:
            with open(output_path, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)
    elif format == "zstd":
        try:
            import zstandard as zstd

            with open(input_path, "rb") as f_in:
                with open(output_path, "wb") as f_out:
                    dctx = zstd.ZstdDecompressor()
                    dctx.copy_stream(f_in, f_out)
        except ImportError:
            raise ImportError("zstandard library required for zstd decompression")
    else:
        raise ValueError(f"Unsupported compression format: {format}")
