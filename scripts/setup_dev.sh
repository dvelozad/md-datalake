#!/bin/bash
# Development environment setup script

set -e

echo "Setting up MD DataLake development environment..."

# Check for Poetry
if ! command -v poetry &> /dev/null; then
    echo "Poetry not found. Installing Poetry..."
    curl -sSL https://install.python-poetry.org | python3 -
fi

# Install dependencies
echo "Installing dependencies..."
poetry install

# Start infrastructure
echo "Starting PostgreSQL and MinIO..."
docker-compose up -d postgres minio

# Wait for services
echo "Waiting for services to be ready..."
sleep 10

# Run migrations
echo "Running database migrations..."
poetry run alembic upgrade head

echo ""
echo "✓ Development environment ready!"
echo ""
echo "Next steps:"
echo "  1. Ingest a simulation: poetry run md-datalake ingest <directory> --project <name>"
echo "  2. Query runs: poetry run md-datalake query runs"
echo "  3. Start API: poetry run uvicorn mddatalake.api.main:app --reload"
echo "  4. View API docs: http://localhost:8000/docs"
echo ""
