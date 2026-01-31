FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry==1.7.1

# Copy dependency files
COPY pyproject.toml poetry.lock* ./

# Install dependencies
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi

# Copy application code
COPY src/ /app/src/
COPY alembic.ini /app/
COPY migrations/ /app/migrations/

ENV PYTHONPATH=/app

CMD ["uvicorn", "mddatalake.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
