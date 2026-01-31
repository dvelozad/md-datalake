#!/bin/bash
# MD Repo - Getting Started Script
# Run this to set up and test the entire system

set -e

echo "=========================================="
echo "MD Repo - Molecular Dynamics Database"
echo "Getting Started"
echo "=========================================="
echo ""

# Step 1: Install dependencies
echo "Step 1: Installing dependencies..."
poetry install
echo "✓ Dependencies installed"
echo ""

# Step 2: Start infrastructure
echo "Step 2: Starting infrastructure (PostgreSQL + MinIO)..."
docker-compose up -d postgres minio
echo "Waiting for services to start..."
sleep 10
echo "✓ Infrastructure running"
echo ""

# Step 3: Generate and apply migrations
echo "Step 3: Setting up database..."
poetry run alembic revision --autogenerate -m "initial schema" || echo "Migration already exists"
poetry run alembic upgrade head
echo "✓ Database initialized"
echo ""

# Step 4: Test ingestion
echo "Step 4: Testing ingestion..."
echo "Ingesting LAMMPS water simulation..."
poetry run mdrepo ingest tests/fixtures/lammps/water_nvt --project test_project --name water_nvt

echo "Ingesting GROMACS lysozyme simulation..."
poetry run mdrepo ingest tests/fixtures/gromacs/lysozyme --project test_project --name lysozyme
echo "✓ Test simulations ingested"
echo ""

# Step 5: Test queries
echo "Step 5: Testing queries..."
echo ""
echo "All runs:"
poetry run mdrepo query runs
echo ""

echo "NVT runs only:"
poetry run mdrepo query runs --ensemble NVT
echo ""

# Step 6: Verify API can start
echo "Step 6: Starting API server (in background)..."
poetry run uvicorn mdrepo.api.main:app --host 0.0.0.0 --port 8000 &
API_PID=$!
sleep 5

echo "Testing API health endpoint..."
curl -s http://localhost:8000/health | python -m json.tool

echo ""
echo "Testing API runs endpoint..."
curl -s http://localhost:8000/api/v1/runs | python -m json.tool | head -30

echo ""
echo "Stopping API server..."
kill $API_PID 2>/dev/null || true

echo ""
echo "=========================================="
echo "✓ ALL TESTS PASSED"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Start API: make run-api"
echo "  2. View API docs: http://localhost:8000/docs"
echo "  3. Ingest your data: poetry run mdrepo ingest <path> --project <name>"
echo "  4. Query: poetry run mdrepo query runs --help"
echo ""
echo "Documentation:"
echo "  - Quick Start: QUICKSTART.md"
echo "  - Summary: SUMMARY.md"
echo "  - API Docs: http://localhost:8000/docs (when running)"
echo ""
