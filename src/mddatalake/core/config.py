"""Application configuration using Pydantic Settings."""

from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+asyncpg://mdrepo:mdrepo_dev_password@localhost:5432/mdrepo"

    # Storage Backend
    storage_backend: Literal["filesystem", "s3"] = "filesystem"
    storage_root: str = "/tmp/mdrepo/artifacts"

    # S3/MinIO Configuration
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_bucket_name: str = "md-simulations"
    s3_region: str = "us-east-1"

    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_workers: int = 4

    # Logging
    log_level: str = "INFO"
    log_format: Literal["json", "text"] = "text"

    # Ingestion Configuration
    compress_trajectories: bool = True
    compression_format: Literal["gzip", "zstd", "xz"] = "gzip"
    checksum_algorithm: Literal["sha256", "md5"] = "sha256"

    # Trajectory Preview Configuration
    preview_cache_enabled: bool = True
    preview_cache_root: str = "/tmp/mdrepo/preview_cache"
    preview_frame_count: int = 1  # Extract first N frames
    preview_format: Literal["pdb", "dcd"] = "pdb"
    preview_max_file_size_mb: int = 500  # Skip if trajectory > 500 MB
    preview_async_extraction: bool = True  # True = async, False = inline


settings = Settings()
