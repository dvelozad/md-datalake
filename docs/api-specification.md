# API Specification

## Version: 1.0.0
## Date: 2026-01-29

---

## 1. Overview

The MD Repository API provides RESTful endpoints for querying, ingesting, and managing MD simulation data. Built with FastAPI, it offers:

- Type-safe request/response models (Pydantic)
- Automatic OpenAPI documentation
- Query filters with precise scientific semantics
- Efficient pagination and sorting
- Content negotiation (JSON, CSV, MessagePack)

**Base URL:** `http://localhost:8000/api/v1`

---

## 2. Core Endpoints

### 2.1 Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "storage": "accessible",
  "version": "1.0.0"
}
```

---

## 3. Simulation Runs

### 3.1 List Runs (with Filters)

```http
GET /runs
```

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `project` | string | Project name | `urea-water-study` |
| `ensemble` | enum | NVE, NVT, NPT, etc. | `NPT` |
| `run_type` | enum | production, equilibration, etc. | `production` |
| `engine_name` | string | LAMMPS, GROMACS | `LAMMPS` |
| `min_temperature` | float | Minimum T (K) | `296.0` |
| `max_temperature` | float | Maximum T (K) | `300.0` |
| `min_pressure` | float | Minimum P (bar) | `0.9` |
| `max_pressure` | float | Maximum P (bar) | `1.1` |
| `composition` | string | System composition (partial match) | `H2O_512` |
| `forcefield` | string | Force field name (partial match) | `CHARMM36` |
| `water_model` | string | Water model | `TIP3P` |
| `status` | enum | completed, failed, running | `completed` |
| `created_by` | string | Username | `diazd` |
| `after` | datetime | Ingested after (ISO 8601) | `2026-01-01T00:00:00Z` |
| `before` | datetime | Ingested before | `2026-02-01T00:00:00Z` |
| `tags` | string[] | Tag names (AND logic) | `production,validated` |
| `has_artifact` | enum | Filter by artifact type | `trajectory` |
| `min_duration` | float | Minimum simulation time (ns) | `10.0` |
| `max_duration` | float | Maximum simulation time (ns) | `100.0` |
| `sort_by` | string | Sort field | `ingestion_time` |
| `sort_order` | enum | asc, desc | `desc` |
| `limit` | int | Max results (default: 100, max: 1000) | `50` |
| `offset` | int | Pagination offset | `0` |

**Example Request:**

```http
GET /runs?ensemble=NPT&min_temperature=296&max_temperature=300&forcefield=CHARMM36&status=completed&limit=50
```

**Response:**

```json
{
  "total": 342,
  "limit": 50,
  "offset": 0,
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "run_name": "urea_water_npt_298K_prod",
      "run_type": "production",
      "ensemble": "NPT",
      "integrator": "velocity_verlet",
      "thermostat": "nose_hoover",
      "barostat": "parrinello_rahman",
      "temperature_target": 298.0,
      "pressure_target": 1.0,
      "timestep": 2.0,
      "n_steps": 5000000,
      "total_time": 10.0,
      "status": "completed",
      "created_by_user": "diazd",
      "ingestion_time": "2026-01-29T12:34:56.789Z",
      "project": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "urea-water-study"
      },
      "system": {
        "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "composition_formula": "H2O_512_urea_32",
        "n_atoms": 17408,
        "forcefield_name": "CHARMM36m",
        "water_model": "TIP3P"
      },
      "engine": {
        "id": "9c5b94b1-35ad-49bb-b118-8e8fc24abf80",
        "name": "LAMMPS",
        "version": "29 Sep 2021"
      },
      "artifact_summary": {
        "total_count": 8,
        "total_size_gb": 4.23,
        "types": ["trajectory", "log", "input", "topology"]
      },
      "tags": ["production", "validated"]
    }
  ]
}
```

### 3.2 Get Single Run

```http
GET /runs/{run_id}
```

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "run_name": "urea_water_npt_298K_prod",
  "run_type": "production",
  "ensemble": "NPT",
  "integrator": "velocity_verlet",
  "thermostat": "nose_hoover",
  "barostat": "parrinello_rahman",
  "temperature_target": 298.0,
  "temperature_tolerance": 2.0,
  "pressure_target": 1.0,
  "pressure_tolerance": 0.1,
  "timestep": 2.0,
  "n_steps": 5000000,
  "total_time": 10.0,
  "start_time": 0,
  "constraints": "h-bonds",
  "cutoff_coulomb": 12.0,
  "cutoff_vdw": 12.0,
  "coulomb_method": "PME",
  "vdw_method": "cutoff",
  "pbc": "xyz",
  "random_seed": 123456,
  "working_directory": "/scratch/diazd/urea_water/npt_298K",
  "hostname": "compute-node-42",
  "slurm_job_id": "987654",
  "environment_hash": "abc123def456",
  "status": "completed",
  "exit_code": 0,
  "ingestion_time": "2026-01-29T12:34:56.789Z",
  "simulation_start_time": "2026-01-28T10:00:00.000Z",
  "simulation_end_time": "2026-01-28T16:30:00.000Z",
  "wall_time_seconds": 23400.0,
  "created_by_user": "diazd",
  "notes": "Production run after 5 ns NPT equilibration",
  "project": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "urea-water-study",
    "description": "Study of urea solvation in water"
  },
  "system": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "composition_formula": "H2O_512_urea_32",
    "composition_hash": "a1b2c3d4...",
    "n_atoms": 17408,
    "n_molecules": {"H2O": 512, "urea": 32},
    "box_type": "cubic",
    "initial_box_vectors": [[30.0, 0, 0], [0, 30.0, 0], [0, 0, 30.0]],
    "initial_volume": 27000.0,
    "initial_density": 1.05,
    "forcefield": {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "name": "CHARMM36m",
      "family": "CHARMM",
      "version": "36m",
      "water_model": "TIP3P"
    }
  },
  "engine": {
    "id": "9c5b94b1-35ad-49bb-b118-8e8fc24abf80",
    "name": "LAMMPS",
    "version": "29 Sep 2021",
    "git_commit": "stable_29Sep2021",
    "build_flags": "-DPKG-MOLECULE -DPKG-KSPACE"
  },
  "lineage": {
    "parents": [
      {
        "run_id": "4c1e8f3a-2b9d-4f6e-8a7c-1d2e3f4a5b6c",
        "run_name": "urea_water_npt_298K_equil",
        "relationship": "continuation"
      }
    ],
    "children": []
  },
  "tags": ["production", "validated"],
  "metadata": {}
}
```

### 3.3 Get Run Artifacts

```http
GET /runs/{run_id}/artifacts
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | enum | Filter by artifact type |
| `role` | enum | Filter by role |

**Response:**

```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "artifacts": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "artifact_type": "trajectory",
      "role": "primary",
      "filename": "traj.xtc",
      "format": "xtc",
      "checksum_sha256": "abcd1234567890...",
      "size_bytes": 4500000000,
      "size_human": "4.2 GB",
      "compression": "gzip",
      "frame_count": 5000,
      "time_range": [0.0, 10000.0],
      "storage_backend": "s3",
      "object_key": "artifacts/sha256-ab-cd/abcd1234...xtc.gz",
      "download_url": "/artifacts/a1b2c3d4-e5f6-7890-abcd-ef1234567890/download",
      "created_at": "2026-01-29T12:34:56.789Z",
      "last_verified": "2026-01-29T13:00:00.000Z"
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "artifact_type": "log",
      "role": "output",
      "filename": "log.lammps",
      "format": "lammps-log",
      "checksum_sha256": "ef011234567890...",
      "size_bytes": 15000000,
      "size_human": "14.3 MB",
      "compression": "gzip",
      "storage_backend": "s3",
      "object_key": "artifacts/sha256-ef-01/ef011234...log.gz",
      "download_url": "/artifacts/b2c3d4e5-f6a7-8901-bcde-f12345678901/download",
      "created_at": "2026-01-29T12:34:56.789Z"
    }
  ]
}
```

### 3.4 Get Run Observables

```http
GET /runs/{run_id}/observables
```

**Response:**

```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "observables": [
    {
      "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "name": "temperature",
      "value_type": "timeseries",
      "unit": "K",
      "mean": 298.2,
      "std_dev": 1.8,
      "min_value": 293.5,
      "max_value": 303.1,
      "uncertainty": 0.1,
      "analysis_method": "lammps_thermo_parse",
      "time_range": [0.0, 10000.0],
      "computed_at": "2026-01-29T12:40:00.000Z"
    },
    {
      "id": "d4e5f6a7-b8c9-0123-def1-234567890123",
      "name": "pressure",
      "value_type": "timeseries",
      "unit": "bar",
      "mean": 1.02,
      "std_dev": 12.5,
      "min_value": -25.3,
      "max_value": 28.7,
      "uncertainty": 0.5,
      "analysis_method": "lammps_thermo_parse",
      "time_range": [0.0, 10000.0],
      "computed_at": "2026-01-29T12:40:00.000Z"
    },
    {
      "id": "e5f6a7b8-c9d0-1234-ef12-345678901234",
      "name": "density",
      "value_type": "scalar",
      "unit": "g/cm^3",
      "value_scalar": 1.048,
      "uncertainty": 0.002,
      "analysis_method": "mdanalysis_density",
      "computed_at": "2026-01-29T12:45:00.000Z"
    }
  ]
}
```

### 3.5 Get Run Lineage

```http
GET /runs/{run_id}/lineage
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `depth` | int | Traversal depth (default: 10) |
| `direction` | enum | `ancestors`, `descendants`, `both` |

**Response:**

```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "lineage": {
    "ancestors": [
      {
        "run_id": "4c1e8f3a-2b9d-4f6e-8a7c-1d2e3f4a5b6c",
        "run_name": "urea_water_npt_298K_equil",
        "relationship": "continuation",
        "depth": 1
      },
      {
        "run_id": "3b0d7e29-1a8c-3e5f-9b6d-0c1d2e3f4a5b",
        "run_name": "urea_water_nvt_298K_equil",
        "relationship": "continuation",
        "depth": 2
      }
    ],
    "descendants": [
      {
        "run_id": "6d2e9f4b-3c0a-5f7e-ab8d-1e2f3a4b5c6d",
        "run_name": "urea_water_npt_298K_prod_ext",
        "relationship": "continuation",
        "depth": 1
      }
    ]
  }
}
```

---

## 4. Systems

### 4.1 List Systems

```http
GET /systems
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `composition` | string | Partial match on formula |
| `forcefield` | string | Force field name |
| `water_model` | string | Water model |
| `min_atoms` | int | Minimum atom count |
| `max_atoms` | int | Maximum atom count |

**Response:**

```json
{
  "total": 42,
  "results": [
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "composition_formula": "H2O_512_urea_32",
      "composition_hash": "a1b2c3d4...",
      "n_atoms": 17408,
      "n_molecules": {"H2O": 512, "urea": 32},
      "box_type": "cubic",
      "forcefield_name": "CHARMM36m",
      "water_model": "TIP3P",
      "run_count": 25,
      "created_at": "2026-01-15T10:00:00.000Z"
    }
  ]
}
```

### 4.2 Get System Details

```http
GET /systems/{system_id}
```

**Response:**

```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "composition_formula": "H2O_512_urea_32",
  "composition_hash": "a1b2c3d4...",
  "n_atoms": 17408,
  "n_molecules": {"H2O": 512, "urea": 32},
  "molecular_weight": 9248.5,
  "box_type": "cubic",
  "initial_box_vectors": [[30.0, 0, 0], [0, 30.0, 0], [0, 0, 30.0]],
  "initial_volume": 27000.0,
  "initial_density": 1.05,
  "forcefield": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "name": "CHARMM36m",
    "family": "CHARMM",
    "version": "36m",
    "water_model": "TIP3P"
  },
  "topology_file": {
    "id": "e6f7a8b9-c0d1-2345-ef67-890123456789",
    "filename": "system.psf",
    "checksum_sha256": "1234567890abcd...",
    "size_bytes": 2500000
  },
  "description": "512 water molecules + 32 urea, cubic box",
  "created_at": "2026-01-15T10:00:00.000Z",
  "run_count": 25
}
```

### 4.3 Get System Runs

```http
GET /systems/{system_id}/runs
```

Returns all runs using this system (same schema as `GET /runs`).

---

## 5. Projects

### 5.1 List Projects

```http
GET /projects
```

**Response:**

```json
{
  "total": 8,
  "results": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "urea-water-study",
      "description": "Study of urea solvation in water",
      "owner": "diazd",
      "created_at": "2026-01-10T09:00:00.000Z",
      "run_count": 150,
      "total_storage_gb": 234.5
    }
  ]
}
```

### 5.2 Get Project Details

```http
GET /projects/{project_id}
```

### 5.3 Get Project Runs

```http
GET /projects/{project_id}/runs
```

---

## 6. Force Fields

### 6.1 List Force Fields

```http
GET /forcefields
```

**Response:**

```json
{
  "total": 12,
  "results": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "name": "CHARMM36m",
      "family": "CHARMM",
      "version": "36m",
      "water_model": "TIP3P",
      "citation": "Huang et al. Nature Methods 2017",
      "run_count": 42
    }
  ]
}
```

---

## 7. Engines

### 7.1 List Engines

```http
GET /engines
```

**Response:**

```json
{
  "total": 5,
  "results": [
    {
      "id": "9c5b94b1-35ad-49bb-b118-8e8fc24abf80",
      "name": "LAMMPS",
      "version": "29 Sep 2021",
      "git_commit": "stable_29Sep2021",
      "build_flags": "-DPKG-MOLECULE -DPKG-KSPACE",
      "gpu_support": true,
      "run_count": 300
    }
  ]
}
```

---

## 8. Search

### 8.1 Full-Text Search

```http
GET /search
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query |
| `entity` | enum | `runs`, `systems`, `all` |

**Response:**

```json
{
  "query": "urea NPT 298K",
  "total": 28,
  "results": [
    {
      "type": "run",
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "urea_water_npt_298K_prod",
      "highlight": "urea water <em>NPT</em> <em>298K</em> production",
      "score": 12.5
    }
  ]
}
```

---

## 9. Tags

### 9.1 List Tags

```http
GET /tags
```

**Response:**

```json
{
  "total": 15,
  "results": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "production",
      "category": "status",
      "description": "Production-quality run",
      "color": "#00AA00",
      "run_count": 142
    }
  ]
}
```

### 9.2 Add Tag to Run

```http
POST /runs/{run_id}/tags
```

**Request Body:**

```json
{
  "tag_name": "validated"
}
```

**Response:**

```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "tag": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "name": "validated",
    "category": "quality"
  }
}
```

### 9.3 Remove Tag from Run

```http
DELETE /runs/{run_id}/tags/{tag_id}
```

---

## 10. Comments

### 10.1 List Comments for Run

```http
GET /runs/{run_id}/comments
```

**Response:**

```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "comments": [
    {
      "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "author": "diazd",
      "content": "Excellent equilibration, temperature stable.",
      "created_at": "2026-01-29T14:00:00.000Z",
      "updated_at": "2026-01-29T14:00:00.000Z"
    }
  ]
}
```

### 10.2 Add Comment

```http
POST /runs/{run_id}/comments
```

**Request Body:**

```json
{
  "content": "Excellent equilibration, temperature stable."
}
```

---

## 11. Ingestion

### 11.1 Ingest Run (Async)

```http
POST /ingest
```

**Request Body:**

```json
{
  "run_directory": "/scratch/diazd/urea_water/npt_298K",
  "project_name": "urea-water-study",
  "run_name": "npt_298K_prod",
  "run_type": "production",
  "deep_analysis": true,
  "auto_tag": true
}
```

**Response:**

```json
{
  "task_id": "d4e5f6a7-b8c9-0123-def1-234567890123",
  "status": "queued",
  "status_url": "/tasks/d4e5f6a7-b8c9-0123-def1-234567890123"
}
```

### 11.2 Check Ingestion Status

```http
GET /tasks/{task_id}
```

**Response (in progress):**

```json
{
  "task_id": "d4e5f6a7-b8c9-0123-def1-234567890123",
  "status": "running",
  "progress": {
    "stage": "artifact_processing",
    "artifacts_uploaded": 5,
    "artifacts_total": 8,
    "percent_complete": 62.5
  }
}
```

**Response (completed):**

```json
{
  "task_id": "d4e5f6a7-b8c9-0123-def1-234567890123",
  "status": "completed",
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "run_url": "/runs/550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 12. Artifacts

### 12.1 Download Artifact

```http
GET /artifacts/{artifact_id}/download
```

**Response:**

Binary stream with headers:

```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="traj.xtc.gz"
Content-Length: 4500000000
X-Checksum-SHA256: abcd1234567890...
```

### 12.2 Get Artifact Metadata

```http
GET /artifacts/{artifact_id}
```

**Response:**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "artifact_type": "trajectory",
  "role": "primary",
  "filename": "traj.xtc",
  "format": "xtc",
  "checksum_sha256": "abcd1234567890...",
  "size_bytes": 4500000000,
  "compression": "gzip",
  "frame_count": 5000,
  "time_range": [0.0, 10000.0],
  "storage_backend": "s3",
  "object_key": "artifacts/sha256-ab-cd/abcd1234...xtc.gz",
  "created_at": "2026-01-29T12:34:56.789Z",
  "last_verified": "2026-01-29T13:00:00.000Z",
  "run": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "run_name": "urea_water_npt_298K_prod"
  }
}
```

---

## 13. Statistics and Aggregations

### 13.1 Database Statistics

```http
GET /stats
```

**Response:**

```json
{
  "total_runs": 1542,
  "total_artifacts": 12336,
  "total_storage_gb": 4523.5,
  "total_simulation_time_ns": 45320.0,
  "run_by_engine": {
    "LAMMPS": 892,
    "GROMACS": 650
  },
  "run_by_ensemble": {
    "NPT": 1024,
    "NVT": 412,
    "NVE": 106
  },
  "run_by_status": {
    "completed": 1450,
    "failed": 62,
    "partial": 30
  }
}
```

### 13.2 Project Statistics

```http
GET /projects/{project_id}/stats
```

**Response:**

```json
{
  "project_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "project_name": "urea-water-study",
  "total_runs": 150,
  "total_storage_gb": 234.5,
  "total_simulation_time_ns": 1500.0,
  "systems_used": 5,
  "unique_compositions": 3,
  "date_range": {
    "first_run": "2026-01-10T09:00:00.000Z",
    "last_run": "2026-01-29T16:30:00.000Z"
  }
}
```

---

## 14. Bulk Operations

### 14.1 Bulk Tag

```http
POST /runs/bulk/tag
```

**Request Body:**

```json
{
  "run_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "6d2e9f4b-3c0a-5f7e-ab8d-1e2f3a4b5c6d"
  ],
  "tag_name": "validated"
}
```

### 14.2 Bulk Export

```http
POST /runs/bulk/export
```

**Request Body:**

```json
{
  "run_ids": ["..."],
  "format": "csv",
  "include_artifacts": false
}
```

**Response:**

```json
{
  "task_id": "e5f6a7b8-c9d0-1234-ef12-345678901234",
  "download_url": "/exports/e5f6a7b8-c9d0-1234-ef12-345678901234"
}
```

---

## 15. Example Query Scenarios

### Query 1: All NPT runs of urea-water at 298K using SPC/E water

```http
GET /runs?ensemble=NPT&min_temperature=296&max_temperature=300&water_model=SPC/E&composition=urea
```

**Semantics:**
- `ensemble=NPT`: Exact match (isothermal-isobaric)
- `min_temperature=296&max_temperature=300`: Range [296, 300] K (inclusive)
- `water_model=SPC/E`: Exact match on force field water model
- `composition=urea`: Substring match on `composition_formula`

### Query 2: LAMMPS runs with PPPM and dt=1 fs and Nose-Hoover thermostat

```http
GET /runs?engine_name=LAMMPS&coulomb_method=PPPM&timestep=1.0&thermostat=nose_hoover
```

**Semantics:**
- `coulomb_method=PPPM`: Exact match (Particle-Particle Particle-Mesh)
- `timestep=1.0`: Exact match (femtoseconds)
- `thermostat=nose_hoover`: Exact match on ENUM type

### Query 3: Group by system composition and compare thermodynamic outputs

```http
GET /systems?composition=H2O
```

Then for each system:

```http
GET /systems/{system_id}/runs?status=completed
```

For each run, fetch observables:

```http
GET /runs/{run_id}/observables?name=density
```

**Alternative: Use aggregation endpoint (future):**

```http
GET /aggregate/observables?group_by=system_id&observable=density&composition=H2O
```

### Query 4: Find runs with specific tags

```http
GET /runs?tags=production,validated&status=completed
```

**Semantics:**
- `tags=production,validated`: AND logic (run must have BOTH tags)
- Returns only runs tagged with both "production" AND "validated"

### Query 5: Find runs ingested in last 7 days

```http
GET /runs?after=2026-01-22T00:00:00Z&sort_by=ingestion_time&sort_order=desc
```

### Query 6: Find runs by user

```http
GET /runs?created_by=diazd&status=completed
```

### Query 7: Find runs with trajectory artifacts

```http
GET /runs?has_artifact=trajectory&status=completed
```

### Query 8: Find long production runs (>50 ns)

```http
GET /runs?run_type=production&min_duration=50.0&status=completed
```

### Query 9: Find failed runs for debugging

```http
GET /runs?status=failed&engine_name=GROMACS&after=2026-01-25T00:00:00Z
```

### Query 10: Find all descendants of a run (lineage)

```http
GET /runs/{run_id}/lineage?direction=descendants&depth=5
```

---

## 16. Error Responses

### 400 Bad Request

```json
{
  "error": "validation_error",
  "message": "Invalid ensemble type",
  "details": {
    "field": "ensemble",
    "value": "NpT",
    "allowed_values": ["NVE", "NVT", "NPT", "NPH", "muVT", "NVT_NVE"]
  }
}
```

### 404 Not Found

```json
{
  "error": "not_found",
  "message": "Run not found",
  "run_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 500 Internal Server Error

```json
{
  "error": "internal_error",
  "message": "Database connection failed",
  "request_id": "abc123def456"
}
```

---

## 17. Rate Limiting

**Limits:**
- Anonymous: 100 requests/hour
- Authenticated: 1000 requests/hour
- Admin: 10000 requests/hour

**Response headers:**

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1643472000
```

**Rate limit exceeded (429):**

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests",
  "retry_after": 3600
}
```

---

## 18. Authentication (Future)

**Bearer token:**

```http
GET /runs
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (401):**

```json
{
  "error": "unauthorized",
  "message": "Invalid or expired token"
}
```

---

## 19. Content Negotiation

**Request JSON:**

```http
GET /runs/550e8400-e29b-41d4-a716-446655440000
Accept: application/json
```

**Request CSV (for list endpoints):**

```http
GET /runs?ensemble=NPT&limit=100
Accept: text/csv
```

**Response CSV:**

```csv
id,run_name,ensemble,temperature_target,pressure_target,total_time,status
550e8400-e29b-41d4-a716-446655440000,urea_water_npt_298K_prod,NPT,298.0,1.0,10.0,completed
...
```

**Request MessagePack (binary, efficient):**

```http
GET /runs?limit=1000
Accept: application/msgpack
```

---

## 20. API Versioning

**Version in URL:**

```http
GET /api/v1/runs
GET /api/v2/runs  # Future version
```

**Version in header (alternative):**

```http
GET /runs
X-API-Version: 1
```

---

## 21. Query Semantics (Clarifications)

### Temperature Ranges

`min_temperature=296&max_temperature=300` means:

```sql
WHERE temperature_target >= 296 AND temperature_target <= 300
```

NOT "runs where actual temperature was in range" (that requires observable filtering).

### Ensemble Filtering

`ensemble=NPT` matches **only** NPT runs, not "runs that had pressure control at some point."

To find runs with pressure control regardless of ensemble:

```http
GET /runs?barostat!=none
```

(Note: This requires support for negation filters, to be implemented.)

### Composition Matching

`composition=H2O` is a **substring match** on `composition_formula`:

- Matches: `H2O_512`, `H2O_1024_Na_8`, `H2O_512_urea_32`
- Does not match: `water_512` (must use molecular formula)

For exact match:

```http
GET /systems?composition_hash={exact_hash}
```

### Tag Filtering

`tags=production,validated` uses **AND logic**:

```sql
WHERE run_id IN (
  SELECT run_id FROM run_tags WHERE tag_id IN (
    SELECT id FROM tags WHERE name IN ('production', 'validated')
  )
  GROUP BY run_id
  HAVING COUNT(DISTINCT tag_id) = 2
)
```

For OR logic (future):

```http
GET /runs?tags_any=production,validated
```

---

## 22. Performance Considerations

### Pagination

Always use `limit` and `offset` for large result sets:

```http
GET /runs?limit=100&offset=0   # Page 1
GET /runs?limit=100&offset=100 # Page 2
```

**Do not request more than 1000 results at once.** Use pagination or export endpoints.

### Filtering vs Post-Processing

**Good:** Filter in API

```http
GET /runs?ensemble=NPT&temperature_target=298
```

**Bad:** Fetch all, filter client-side

```http
GET /runs?limit=10000  # Then filter in Python
```

### Aggregations

For statistics across many runs, use aggregate endpoints (not available in MVP, planned for v1.1):

```http
GET /aggregate/observables?group_by=system_id&observable=density
```

Instead of fetching all runs and computing in client.

---

## 23. OpenAPI Documentation

Auto-generated documentation available at:

```
http://localhost:8000/docs        # Swagger UI
http://localhost:8000/redoc       # ReDoc
http://localhost:8000/openapi.json # OpenAPI schema
```

---

## Summary

The API provides:

1. **Precise filter semantics** for scientific queries
2. **Comprehensive data access** (runs, systems, artifacts, observables)
3. **Lineage traversal** for provenance tracking
4. **Tagging and comments** for collaborative workflows
5. **Async ingestion** for long-running operations
6. **Bulk operations** for batch management
7. **Multiple output formats** (JSON, CSV, MessagePack)
8. **Pagination and sorting** for performance
9. **Full-text search** for exploratory queries
10. **Statistics endpoints** for high-level overviews

All endpoints are type-safe, documented, and designed for both interactive (CLI/UI) and programmatic (scripts/notebooks) access.
