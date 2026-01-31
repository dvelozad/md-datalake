#!/bin/bash
#
# Quick Start Script for MD DataLake
# Sets up and tests the complete visualization system
#

set -e

echo "======================================"
echo "MD DataLake - Quick Start"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo "Step 1: Checking prerequisites..."
echo ""

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found${NC}"
    echo "  Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✓ Docker installed${NC}"

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found${NC}"
    echo "  Please install Docker Compose"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose installed${NC}"

echo ""

# Step 2: Build services
echo "Step 2: Building Docker services..."
echo ""

docker-compose build api
echo -e "${GREEN}✓ API service built${NC}"

cd frontend && docker build -t mddatalake-frontend . && cd ..
echo -e "${GREEN}✓ Frontend service built${NC}"

echo ""

# Step 3: Start infrastructure
echo "Step 3: Starting infrastructure (PostgreSQL, MinIO)..."
echo ""

docker-compose up -d postgres minio

echo "Waiting for services to be healthy..."
sleep 10

docker-compose ps postgres minio
echo -e "${GREEN}✓ Infrastructure started${NC}"

echo ""

# Step 4: Run migrations
echo "Step 4: Running database migrations..."
echo ""

docker-compose run --rm api alembic upgrade head
echo -e "${GREEN}✓ Migrations complete${NC}"

echo ""

# Step 5: Test visualization components
echo "Step 5: Testing visualization components..."
echo ""

docker-compose run --rm api python scripts/test_visualization.py

echo ""

# Step 6: Start full stack
echo "Step 6: Starting full stack..."
echo ""

docker-compose up -d

echo "Waiting for services to start..."
sleep 5

echo ""
echo "======================================"
echo "Services Status:"
echo "======================================"
docker-compose ps

echo ""
echo "======================================"
echo "Quick Start Complete!"
echo "======================================"
echo ""
echo "Access the application:"
echo ""
echo -e "  ${GREEN}Frontend:${NC}      http://localhost:3000"
echo -e "  ${GREEN}API Docs:${NC}      http://localhost:8000/docs"
echo -e "  ${GREEN}MinIO Console:${NC} http://localhost:9001"
echo -e "  ${GREEN}Health Check:${NC}  http://localhost:8000/health"
echo ""
echo "Next steps:"
echo ""
echo "  1. Ingest test data:"
echo "     docker-compose exec api poetry run md-datalake ingest \\"
echo "       /app/tests/fixtures/lammps/water_nvt --project test"
echo ""
echo "  2. Create visualization session:"
echo "     curl -X POST http://localhost:8000/api/v1/runs/1/visualizations"
echo ""
echo "  3. Open frontend and browse runs:"
echo "     open http://localhost:3000"
echo ""
echo "View logs:"
echo "  docker-compose logs -f api"
echo ""
echo "Stop services:"
echo "  docker-compose down"
echo ""
