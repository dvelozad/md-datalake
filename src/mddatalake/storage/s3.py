"""S3/MinIO storage backend."""

from io import BytesIO
from pathlib import Path
from typing import BinaryIO

import boto3
from botocore.exceptions import ClientError

from mddatalake.core.config import settings
from mddatalake.core.exceptions import StorageError
from mddatalake.storage.backend import StorageBackend
from mddatalake.utils.checksum import compute_checksum


class S3Backend(StorageBackend):
    """S3/MinIO storage backend."""

    def __init__(
        self,
        bucket_name: str | None = None,
        endpoint_url: str | None = None,
        access_key_id: str | None = None,
        secret_access_key: str | None = None,
        region: str | None = None,
    ):
        """
        Initialize S3 backend.

        Args:
            bucket_name: S3 bucket name
            endpoint_url: S3 endpoint URL (for MinIO)
            access_key_id: AWS access key ID
            secret_access_key: AWS secret access key
            region: AWS region
        """
        self.bucket_name = bucket_name or settings.s3_bucket_name
        self.endpoint_url = endpoint_url or settings.s3_endpoint_url
        self.access_key_id = access_key_id or settings.s3_access_key_id
        self.secret_access_key = secret_access_key or settings.s3_secret_access_key
        self.region = region or settings.s3_region

        # Initialize S3 client
        self.s3_client = boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key,
            region_name=self.region,
        )

        # Ensure bucket exists
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self) -> None:
        """Create bucket if it doesn't exist."""
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except ClientError:
            try:
                self.s3_client.create_bucket(Bucket=self.bucket_name)
            except ClientError as e:
                raise StorageError(f"Failed to create bucket: {e}")

    def _get_s3_key(self, checksum: str, extension: str = "") -> str:
        """
        Get S3 key for content-addressed storage.

        Format: artifacts/sha256-{AA}-{BB}/{CHECKSUM}.{ext}

        Args:
            checksum: SHA-256 checksum
            extension: File extension

        Returns:
            S3 key
        """
        if len(checksum) < 4:
            raise ValueError(f"Checksum too short: {checksum}")

        aa = checksum[:2]
        bb = checksum[2:4]

        filename = f"{checksum}{extension}"
        return f"artifacts/sha256-{aa}-{bb}/{filename}"

    async def upload(
        self, file_path: Path, storage_key: str, checksum: str | None = None
    ) -> str:
        """Upload file to S3."""
        file_path = Path(file_path)

        if not file_path.exists():
            raise StorageError(f"File not found: {file_path}")

        # Compute checksum if not provided
        if checksum is None:
            checksum = compute_checksum(file_path)

        # Get extension and S3 key
        extension = "".join(file_path.suffixes)
        s3_key = self._get_s3_key(checksum, extension)

        # Check if file already exists (deduplication)
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            # File exists, skip upload
            return s3_key
        except ClientError:
            # File doesn't exist, proceed with upload
            pass

        # Upload file
        try:
            self.s3_client.upload_file(
                str(file_path),
                self.bucket_name,
                s3_key,
                ExtraArgs={"Metadata": {"checksum-sha256": checksum}},
            )
        except ClientError as e:
            raise StorageError(f"Failed to upload file: {e}")

        return s3_key

    async def download(self, storage_key: str, output_path: Path) -> None:
        """Download file from S3."""
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            self.s3_client.download_file(self.bucket_name, storage_key, str(output_path))
        except ClientError as e:
            raise StorageError(f"Failed to download file: {e}")

    async def download_stream(self, storage_key: str) -> BinaryIO:
        """Download file as a stream."""
        try:
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=storage_key)
            data = response["Body"].read()
            return BytesIO(data)
        except ClientError as e:
            raise StorageError(f"Failed to download file: {e}")

    async def exists(self, storage_key: str) -> bool:
        """Check if file exists."""
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=storage_key)
            return True
        except ClientError:
            return False

    async def delete(self, storage_key: str) -> None:
        """Delete file from S3."""
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=storage_key)
        except ClientError as e:
            raise StorageError(f"Failed to delete file: {e}")

    async def get_size(self, storage_key: str) -> int:
        """Get file size."""
        try:
            response = self.s3_client.head_object(Bucket=self.bucket_name, Key=storage_key)
            return response["ContentLength"]
        except ClientError as e:
            raise StorageError(f"Failed to get file size: {e}")
