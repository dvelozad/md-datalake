## MD DataLake - Test Suite

### Test Structure

```
tests/
├── fixtures/               # Test data
│   ├── lammps/
│   │   └── water_nvt/     # LAMMPS water NVT simulation
│   └── gromacs/
│       └── lysozyme/      # GROMACS lysozyme simulation
│
├── unit/                  # Unit tests (fast, isolated)
│   └── visualization/
│       ├── test_converters.py        # Trajectory conversion
│       ├── test_trajectory_server.py # WebSocket server
│       └── test_session_manager.py   # Session management
│
└── integration/           # Integration tests (slower, DB required)
    └── test_visualization_flow.py    # Full visualization flow
```

### Running Tests

#### All Tests
```bash
# Using pytest
poetry run pytest

# Using make
make test

# With coverage
poetry run pytest --cov=src/mddatalake --cov-report=html
```

#### Unit Tests Only (Fast)
```bash
poetry run pytest tests/unit/

# Specific module
poetry run pytest tests/unit/visualization/test_converters.py

# Specific test
poetry run pytest tests/unit/visualization/test_converters.py::TestTrajectoryConverter::test_lammps_conversion_to_dcd
```

#### Integration Tests Only
```bash
poetry run pytest tests/integration/

# Skip integration tests
poetry run pytest -m "not integration"
```

#### With Verbose Output
```bash
poetry run pytest -v -s
```

### Test Requirements

#### Required Packages
- **pytest** - Test framework
- **pytest-asyncio** - Async test support
- **pytest-cov** - Coverage reporting
- **MDAnalysis** - Trajectory analysis (for visualization tests)

#### Optional Packages
- **pytest-xdist** - Parallel test execution
- **pytest-timeout** - Timeout support

### Test Fixtures

#### Creating Test Trajectories
```bash
# Generate minimal test trajectory files
python tests/fixtures/create_test_trajectories.py
```

This creates:
- `tests/fixtures/lammps/water_nvt/traj.dump` - 2-frame LAMMPS dump
- `tests/fixtures/gromacs/lysozyme/conf.gro` - GROMACS structure

### Test Markers

Tests are marked with pytest markers:

```python
@pytest.mark.unit          # Fast unit test
@pytest.mark.integration   # Integration test (requires DB)
@pytest.mark.asyncio       # Async test
@pytest.mark.slow          # Slow test (>5 seconds)
```

#### Running Specific Markers
```bash
# Only unit tests
pytest -m unit

# Only integration tests
pytest -m integration

# Skip slow tests
pytest -m "not slow"
```

### Writing New Tests

#### Unit Test Example
```python
# tests/unit/mymodule/test_myfunction.py
import pytest
from mddatalake.mymodule import myfunction

class TestMyFunction:
    def test_basic_case(self):
        result = myfunction(input_value)
        assert result == expected_value

    def test_error_case(self):
        with pytest.raises(ValueError):
            myfunction(invalid_input)
```

#### Async Test Example
```python
@pytest.mark.asyncio
async def test_async_function():
    result = await my_async_function()
    assert result is not None
```

#### Integration Test Example
```python
@pytest.mark.integration
@pytest.mark.asyncio
async def test_database_operation(db_session):
    # Use database
    record = MyModel(field="value")
    db_session.add(record)
    await db_session.commit()

    # Verify
    assert record.id is not None
```

### Test Coverage

#### Generate Coverage Report
```bash
# Terminal report
poetry run pytest --cov=src/mddatalake

# HTML report (opens in browser)
poetry run pytest --cov=src/mddatalake --cov-report=html
open htmlcov/index.html

# XML report (for CI)
poetry run pytest --cov=src/mddatalake --cov-report=xml
```

#### Coverage Goals
- **Overall:** >80%
- **Critical modules:** >90%
  - `visualization/converters.py`
  - `visualization/mdserv_manager.py`
  - `api/routes/visualization.py`

### Continuous Integration

#### GitHub Actions Workflow
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          pip install poetry
          poetry install
      - name: Run tests
        run: poetry run pytest --cov
```

### Test Data

#### LAMMPS Test Data
- **File:** `tests/fixtures/lammps/water_nvt/traj.dump`
- **Atoms:** 32
- **Frames:** 2
- **Format:** LAMMPS dump (text)

#### GROMACS Test Data
- **File:** `tests/fixtures/gromacs/lysozyme/conf.gro`
- **Atoms:** 32
- **Frames:** 1
- **Format:** GROMACS GRO

### Troubleshooting

#### Import Errors
```bash
# Ensure src is in PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"

# Or install in development mode
poetry install
```

#### MDAnalysis Not Found
```bash
# Install MDAnalysis
poetry add mdanalysis

# Or with pip
pip install MDAnalysis
```

#### Database Connection Errors
```bash
# Start PostgreSQL
docker-compose up -d postgres

# Run migrations
poetry run alembic upgrade head
```

#### Port Already in Use
```bash
# Tests use high ports (38090-38190) to avoid conflicts
# If still conflicts, change port range in test files
```

### Performance Tips

#### Speed Up Tests
```bash
# Run in parallel (requires pytest-xdist)
poetry run pytest -n auto

# Run only failed tests
poetry run pytest --lf

# Run until first failure
poetry run pytest -x
```

#### Skip Slow Tests
```bash
# Skip integration tests
pytest -m "not integration"

# Skip tests requiring MDAnalysis
pytest -m "not requires_mdanalysis"
```

### Test Database

Integration tests use a test database:

```python
# conftest.py
@pytest.fixture
async def db_session():
    """Create test database session."""
    async with AsyncSessionLocal() as session:
        yield session
        # Cleanup after test
        await session.rollback()
```

### Mocking

#### Mock External Dependencies
```python
from unittest.mock import patch, MagicMock

@patch('mddatalake.storage.backend.S3Backend')
def test_with_mock_s3(mock_s3):
    mock_s3.upload.return_value = "test-key"
    # Test code using mocked S3
```

### Best Practices

1. **Test Independence** - Each test should be independent
2. **Use Fixtures** - Share setup code via fixtures
3. **Clear Names** - Test names should describe what they test
4. **One Assertion** - Prefer one logical assertion per test
5. **Fast Tests** - Keep tests fast (mock slow operations)
6. **Cleanup** - Always cleanup resources (use fixtures)

### Resources

- **pytest docs:** https://docs.pytest.org/
- **pytest-asyncio:** https://pytest-asyncio.readthedocs.io/
- **Coverage.py:** https://coverage.readthedocs.io/
