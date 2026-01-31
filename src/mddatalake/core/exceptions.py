"""Custom exceptions for MD Repo."""


class MDRepoException(Exception):
    """Base exception for all MD Repo errors."""

    pass


class IngestionError(MDRepoException):
    """Errors during simulation ingestion."""

    pass


class ParserError(MDRepoException):
    """Errors during file parsing."""

    pass


class StorageError(MDRepoException):
    """Errors during artifact storage operations."""

    pass


class ValidationError(MDRepoException):
    """Errors during data validation."""

    pass


class ConfigurationError(MDRepoException):
    """Errors in configuration."""

    pass
