.PHONY: help dev test lint format clean migrations upgrade

help:
	@echo "MD DataLake Development Commands"
	@echo ""
	@echo "  make dev          - Start development environment (Docker Compose)"
	@echo "  make test         - Run tests with coverage"
	@echo "  make lint         - Run linters (ruff, mypy)"
	@echo "  make format       - Format code with black"
	@echo "  make clean        - Stop containers and clean volumes"
	@echo "  make migrations   - Generate new Alembic migration"
	@echo "  make upgrade      - Apply Alembic migrations"
	@echo "  make shell        - Open IPython shell with app context"

dev:
	docker-compose up -d postgres minio
	@echo "Waiting for services to be ready..."
	@sleep 5
	@echo "Services running:"
	@echo "  PostgreSQL: localhost:5432"
	@echo "  MinIO: localhost:9000 (console: localhost:9001)"

test:
	poetry run pytest

lint:
	poetry run ruff check src/ tests/
	poetry run mypy src/

format:
	poetry run black src/ tests/
	poetry run ruff check --fix src/ tests/

clean:
	docker-compose down -v

migrations:
	poetry run alembic revision --autogenerate -m "$(MSG)"

upgrade:
	poetry run alembic upgrade head

downgrade:
	poetry run alembic downgrade -1

shell:
	poetry run ipython

install:
	poetry install

run-api:
	poetry run uvicorn mddatalake.api.main:app --reload --host 0.0.0.0 --port 8000
