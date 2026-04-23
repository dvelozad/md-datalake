"""Application configuration using Pydantic Settings."""

from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

from mddatalake.core.enums import ValidationLevel


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+asyncpg://mddatalake:devpassword@localhost:5433/mddatalake"

    # JWT Authentication
    jwt_secret_key: str = "CHANGE-ME-IN-PRODUCTION-USE-A-LONG-RANDOM-STRING"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 480  # 8 hours

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
    preview_max_file_size_mb: int = 1000  # Skip if trajectory > 1000 MB
    preview_async_extraction: bool = True  # True = async, False = inline

    # Upload Validation Configuration
    validation_mode: ValidationLevel = ValidationLevel.WARNING
    allow_duplicate_trajectories: bool = False
    allow_duplicate_topologies: bool = False
    allow_duplicate_logs: bool = False
    require_minimal_dataset: bool = False
    max_files_per_upload: int = 50
    max_total_upload_size_gb: int = 50
    max_file_size_mb: int = 5000  # 5GB per file


settings = Settings()
