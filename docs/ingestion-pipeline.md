# Ingestion Pipeline Specification

## Version: 1.0.0
## Date: 2026-01-29

---

## 1. Overview

The ingestion pipeline transforms raw MD simulation outputs into structured database records with integrity-checked artifacts in object storage. It consists of **five sequential stages** that are transactional and idempotent.

### Design Goals

1. **Correctness**: Detect errors early; never ingest corrupt or incomplete data
2. **Idempotency**: Re-running ingestion on same directory produces identical result
3. **Atomicity**: All-or-nothing; partial failures leave no database corruption
4. **Traceability**: Every ingested run traceable to source files and user
5. **Performance**: Parallel ingestion of independent runs; streaming checksum computation

---

## 2. Ingestion Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: Discovery & Validation                            │
│ - Detect engine type (LAMMPS/GROMACS)                      │
│ - Find required files (topology, trajectory, log, input)   │
│ - Validate file integrity (readable, non-empty, format)    │
│ - Check for previous ingestion (skip if already done)      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: Metadata Extraction (Shallow)                     │
│ - Parse input scripts (in.lammps, .mdp)                    │
│ - Parse log files (thermo output, run info)                │
│ - Extract: ensemble, T, P, dt, n_steps, cutoffs           │
│ - Parse topology (composition, force field)                │
│ - Extract engine version and build info                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 3: Artifact Processing                               │
│ - Compute SHA-256 checksums (streaming)                    │
│ - Compress artifacts (if configured)                        │
│ - Upload to object storage (CAS by checksum)               │
│ - Create manifest.json for run                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 4: Database Transaction                              │
│ - Find or create: Project, System, ForceField, Engine      │
│ - Insert SimulationRun record                              │
│ - Insert Artifact records (with checksums, storage keys)   │
│ - Insert Lineage records (if continuation/restart)         │
│ - COMMIT (or ROLLBACK on error)                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 5: Post-Ingestion (Optional)                         │
│ - Deep metadata extraction (if --deep flag)                │
│   - Compute observables (T, P, density over time)          │
│   - Extract trajectories stats (RMSD, RDF, MSD)            │
│ - Tag run (auto-tags: "production", "test", etc.)          │
│ - Send notifications (email, Slack)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Stage 1: Discovery & Validation

### 3.1 Engine Detection

**Algorithm:**

```python
def detect_engine(run_dir: Path) -> EngineType:
    # Check for LAMMPS signatures
    if (run_dir / "log.lammps").exists():
        return EngineType.LAMMPS
    if any(run_dir.glob("in.*.lammps")):
        return EngineType.LAMMPS
    if any(run_dir.glob("data.*.lmp")):
        return EngineType.LAMMPS

    # Check for GROMACS signatures
    if (run_dir / "md.log").exists() and (run_dir / "topol.tpr").exists():
        return EngineType.GROMACS
    if any(run_dir.glob("*.mdp")) and any(run_dir.glob("*.gro")):
        return EngineType.GROMACS

    # Ambiguous or unsupported
    raise UnsupportedEngineError(f"Cannot detect engine in {run_dir}")
```

### 3.2 Required Files Check

**LAMMPS minimum files:**
- `log.lammps` (or `log.<date>.lammps`)
- `in.*.lammps` (input script)
- `data.*.lmp` OR `*.data` (topology, optional if restart)
- At least one trajectory: `*.dump`, `*.dcd`, `*.xtc`, `*.lammpstrj`

**GROMACS minimum files:**
- `*.tpr` (portable binary run input)
- `md.log` (log file)
- At least one trajectory: `*.xtc`, `*.trr`, `*.gro` (optional)

**Optional files (if present, ingest):**
- Checkpoint/restart files: `*.restart`, `*.cpt`
- Energy files: `*.edr`
- Index files: `*.ndx`
- Analysis outputs: `*.xvg`, `*.dat`

### 3.3 File Integrity Checks

For each required file:

```python
def validate_file(file_path: Path, expected_type: str) -> ValidationResult:
    checks = []

    # 1. Exists and readable
    if not file_path.exists():
        return ValidationResult(ok=False, error="File not found")
    if not os.access(file_path, os.R_OK):
        return ValidationResult(ok=False, error="File not readable")

    # 2. Non-empty
    if file_path.stat().st_size == 0:
        return ValidationResult(ok=False, error="File is empty")

    # 3. Format-specific checks
    if expected_type == "lammps_log":
        # Must contain "LAMMPS" header
        with open(file_path) as f:
            header = f.read(1024)
            if "LAMMPS" not in header:
                return ValidationResult(ok=False, error="Not a LAMMPS log file")

    elif expected_type == "gromacs_tpr":
        # Must be readable by gmx dump
        result = subprocess.run(
            ["gmx", "dump", "-s", str(file_path)],
            capture_output=True,
            timeout=10
        )
        if result.returncode != 0:
            return ValidationResult(ok=False, error="TPR file corrupted")

    elif expected_type == "trajectory_xtc":
        # Check magic bytes (XTC starts with specific header)
        with open(file_path, "rb") as f:
            magic = f.read(4)
            if magic != b'\x00\x00\x00\x00':  # XTC magic
                return ValidationResult(ok=False, error="Invalid XTC format")

    return ValidationResult(ok=True)
```

### 3.4 Deduplication Check

Before proceeding, check if run already ingested:

```python
def check_already_ingested(run_dir: Path) -> Optional[UUID]:
    # Strategy 1: Check for .mdrepo_ingested marker file
    marker = run_dir / ".mdrepo_ingested"
    if marker.exists():
        run_id = UUID(marker.read_text().strip())
        # Verify run exists in DB
        if db.query(SimulationRun).filter_by(id=run_id).first():
            return run_id

    # Strategy 2: Check database for matching working_directory
    run = db.query(SimulationRun).filter_by(
        working_directory=str(run_dir.resolve())
    ).first()
    if run:
        return run.id

    return None  # Not ingested yet
```

---

## 4. Stage 2: Metadata Extraction

### 4.1 LAMMPS Metadata Extraction

**Input Script Parsing (`in.*.lammps`):**

```python
def parse_lammps_input(file_path: Path) -> dict:
    metadata = {
        "units": "lj",  # Default
        "timestep": None,
        "ensemble": None,
        "thermostat": None,
        "barostat": None,
        "temperature_target": None,
        "pressure_target": None,
        "pair_style": None,
        "kspace_style": None,
        "boundary": "p p p",  # Default
    }

    with open(file_path) as f:
        for line in f:
            line = line.split('#')[0].strip()  # Remove comments
            if not line:
                continue

            tokens = line.split()
            cmd = tokens[0].lower()

            if cmd == "units":
                metadata["units"] = tokens[1]

            elif cmd == "timestep":
                metadata["timestep"] = float(tokens[1])

            elif cmd == "fix" and len(tokens) >= 4:
                fix_name = tokens[1]
                fix_style = tokens[3]

                if fix_style == "nvt":
                    metadata["ensemble"] = "NVT"
                    metadata["thermostat"] = "nose_hoover"  # Default for fix nvt
                    # Parse temp keyword
                    if "temp" in tokens:
                        idx = tokens.index("temp")
                        metadata["temperature_target"] = float(tokens[idx + 1])

                elif fix_style == "npt":
                    metadata["ensemble"] = "NPT"
                    metadata["thermostat"] = "nose_hoover"
                    metadata["barostat"] = "nose_hoover"
                    # Parse temp and press keywords
                    if "temp" in tokens:
                        idx = tokens.index("temp")
                        metadata["temperature_target"] = float(tokens[idx + 1])
                    if "iso" in tokens or "aniso" in tokens:
                        idx = tokens.index("iso") if "iso" in tokens else tokens.index("aniso")
                        metadata["pressure_target"] = float(tokens[idx + 1])

                elif fix_style == "nve":
                    metadata["ensemble"] = "NVE"
                    metadata["thermostat"] = "none"
                    metadata["barostat"] = "none"

                elif fix_style == "langevin":
                    metadata["thermostat"] = "langevin"
                    metadata["temperature_target"] = float(tokens[4])

            elif cmd == "pair_style":
                metadata["pair_style"] = " ".join(tokens[1:])

            elif cmd == "kspace_style":
                metadata["kspace_style"] = tokens[1]
                if tokens[1] == "pppm":
                    metadata["coulomb_method"] = "PPPM"

            elif cmd == "boundary":
                metadata["boundary"] = " ".join(tokens[1:4])

    return metadata
```

**Log File Parsing (`log.lammps`):**

```python
def parse_lammps_log(file_path: Path) -> dict:
    metadata = {
        "version": None,
        "git_commit": None,
        "n_steps": None,
        "start_time": 0,
        "thermo_keywords": [],
        "exit_code": 0,
        "error_message": None,
    }

    with open(file_path) as f:
        lines = f.readlines()

    # Parse header for version
    for line in lines[:50]:
        if "LAMMPS (" in line:
            # Example: "LAMMPS (29 Sep 2021 - Update 3)"
            match = re.search(r"LAMMPS \((.+?)\)", line)
            if match:
                metadata["version"] = match.group(1)
        if "Git commit:" in line:
            metadata["git_commit"] = line.split(":")[-1].strip()

    # Parse run command for n_steps
    for line in lines:
        if line.startswith("run "):
            tokens = line.split()
            metadata["n_steps"] = int(tokens[1])

    # Parse thermo output keywords
    for i, line in enumerate(lines):
        if "Step" in line and "Temp" in line:
            # Example: "Step Temp Press PotEng KinEng TotEng"
            metadata["thermo_keywords"] = line.split()
            break

    # Check for errors
    for line in reversed(lines):
        if "ERROR" in line:
            metadata["error_message"] = line.strip()
            metadata["exit_code"] = 1
            break
        if "Total wall time:" in line:
            # Successful completion
            break

    return metadata
```

**Data File Parsing (`data.*.lmp`):**

```python
def parse_lammps_data(file_path: Path) -> dict:
    metadata = {
        "n_atoms": None,
        "n_bonds": None,
        "n_atom_types": None,
        "box_vectors": None,
    }

    with open(file_path) as f:
        for line in f:
            line = line.strip()
            if "atoms" in line:
                metadata["n_atoms"] = int(line.split()[0])
            elif "bonds" in line:
                metadata["n_bonds"] = int(line.split()[0])
            elif "atom types" in line:
                metadata["n_atom_types"] = int(line.split()[0])
            elif "xlo xhi" in line:
                tokens = line.split()
                xlo, xhi = float(tokens[0]), float(tokens[1])
                if "box_vectors" not in metadata:
                    metadata["box_vectors"] = []
                metadata["box_vectors"].append([xhi - xlo, 0, 0])
            # Continue for ylo, zlo...

    return metadata
```

### 4.2 GROMACS Metadata Extraction

**TPR File Parsing (via `gmx dump`):**

```python
def parse_gromacs_tpr(file_path: Path) -> dict:
    # Run gmx dump to extract metadata
    result = subprocess.run(
        ["gmx", "dump", "-s", str(file_path)],
        capture_output=True,
        text=True,
        timeout=30
    )

    if result.returncode != 0:
        raise ValueError(f"Failed to parse TPR: {result.stderr}")

    output = result.stdout
    metadata = {}

    # Parse output (example lines):
    # integrator               = md
    # nsteps                   = 5000000
    # dt                       = 0.002
    # ref_t                    = 298
    # ref_p                    = 1

    for line in output.split('\n'):
        if '=' in line:
            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip()

            if key == "integrator":
                metadata["integrator"] = value
            elif key == "nsteps":
                metadata["n_steps"] = int(value)
            elif key == "dt":
                metadata["timestep"] = float(value) * 1000  # ps to fs
            elif key == "ref_t":
                metadata["temperature_target"] = float(value)
            elif key == "ref_p":
                metadata["pressure_target"] = float(value)
            elif key == "tcoupl":
                metadata["thermostat"] = value
            elif key == "pcoupl":
                metadata["barostat"] = value
            elif key == "coulombtype":
                metadata["coulomb_method"] = value
            elif key == "rcoulomb":
                metadata["cutoff_coulomb"] = float(value) * 10  # nm to Angstrom

    return metadata
```

**MDP File Parsing (`.mdp`):**

```python
def parse_gromacs_mdp(file_path: Path) -> dict:
    metadata = {}

    with open(file_path) as f:
        for line in f:
            line = line.split(';')[0].strip()  # Remove comments
            if not line or '=' not in line:
                continue

            key, value = line.split('=', 1)
            key = key.strip().lower()
            value = value.strip()

            if key == "integrator":
                metadata["integrator"] = value
            elif key == "dt":
                metadata["timestep"] = float(value) * 1000  # ps to fs
            elif key == "nsteps":
                metadata["n_steps"] = int(value)
            elif key == "ref-t":
                metadata["temperature_target"] = float(value.split()[0])
            elif key == "ref-p":
                metadata["pressure_target"] = float(value.split()[0])
            elif key == "tcoupl":
                metadata["thermostat"] = value
            elif key == "pcoupl":
                metadata["barostat"] = value

    return metadata
```

**Log File Parsing (`md.log`):**

```python
def parse_gromacs_log(file_path: Path) -> dict:
    metadata = {
        "version": None,
        "git_commit": None,
        "error_message": None,
        "exit_code": 0,
    }

    with open(file_path) as f:
        for line in f:
            if "GROMACS version:" in line:
                metadata["version"] = line.split(":")[-1].strip()
            elif "Git commit:" in line:
                metadata["git_commit"] = line.split(":")[-1].strip()
            elif "Fatal error" in line or "Error" in line:
                metadata["error_message"] = line.strip()
                metadata["exit_code"] = 1

    return metadata
```

### 4.3 System Composition Extraction

**Compute composition hash (deterministic):**

```python
def compute_composition_hash(n_molecules: dict) -> str:
    # Sort molecules by name to ensure determinism
    sorted_molecules = sorted(n_molecules.items())
    # Create canonical string: "H2O:512,Na:8,urea:32"
    composition_str = ",".join(f"{mol}:{count}" for mol, count in sorted_molecules)
    # Hash it
    return hashlib.sha256(composition_str.encode()).hexdigest()
```

**Compute composition formula (human-readable):**

```python
def compute_composition_formula(n_molecules: dict) -> str:
    # Sort by count descending, then by name
    sorted_molecules = sorted(n_molecules.items(), key=lambda x: (-x[1], x[0]))
    # Create formula: "H2O_512_urea_32_Na_8"
    return "_".join(f"{mol}_{count}" for mol, count in sorted_molecules)
```

### 4.4 Force Field Detection

**LAMMPS:**
- Parse `pair_style` from input script
- Map to known force fields:
  - `lj/cut` → "Lennard-Jones"
  - `lj/cut/coul/long` → "LJ + Coulomb (long-range)"
  - `reax/c` → "ReaxFF"

**GROMACS:**
- Parse topology file (`.top`) for `#include` directives
- Examples:
  - `#include "amber99sb-ildn.ff/forcefield.itp"` → "AMBER99SB-ILDN"
  - `#include "charmm36-mar2019.ff/forcefield.itp"` → "CHARMM36m"

---

## 5. Stage 3: Artifact Processing

### 5.1 Checksum Computation (Streaming)

```python
def compute_checksum_streaming(file_path: Path, algorithm="sha256") -> str:
    """Compute checksum without loading entire file into memory."""
    hasher = hashlib.new(algorithm)
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):  # 8 KB chunks
            hasher.update(chunk)
    return hasher.hexdigest()
```

### 5.2 Compression

**Selective compression based on file type:**

```python
def should_compress(file_path: Path) -> bool:
    # Compress text-based trajectories and logs
    compressible = [".dump", ".lammpstrj", ".log", ".dat", ".xvg"]
    return file_path.suffix in compressible

def compress_artifact(input_path: Path, output_path: Path, method="gzip") -> None:
    if method == "gzip":
        with open(input_path, "rb") as f_in:
            with gzip.open(output_path, "wb", compresslevel=6) as f_out:
                shutil.copyfileobj(f_in, f_out)
    elif method == "zstd":
        # Use zstandard library
        with open(input_path, "rb") as f_in:
            with open(output_path, "wb") as f_out:
                compressor = zstandard.ZstdCompressor(level=3, threads=4)
                compressor.copy_stream(f_in, f_out)
```

### 5.3 Upload to Object Storage

```python
def upload_artifact(file_path: Path, checksum: str, storage_backend: str) -> str:
    # Determine object key from checksum
    prefix = checksum[:2]
    subprefix = checksum[2:4]
    filename = file_path.name
    object_key = f"artifacts/sha256-{prefix}-{subprefix}/{checksum}{file_path.suffix}"

    if storage_backend == "s3":
        s3_client.upload_file(
            Filename=str(file_path),
            Bucket="md-simulations",
            Key=object_key,
            ExtraArgs={
                "Metadata": {
                    "checksum-sha256": checksum,
                    "original-filename": filename,
                }
            }
        )
    elif storage_backend == "filesystem":
        dest_dir = storage_root / "artifacts" / "by-checksum" / "sha256" / prefix / subprefix
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path = dest_dir / f"{checksum}{file_path.suffix}"
        shutil.copy2(file_path, dest_path)

    return object_key
```

### 5.4 Manifest Creation

```python
def create_manifest(run_id: UUID, artifacts: list[dict], metadata: dict) -> dict:
    return {
        "run_id": str(run_id),
        "run_name": metadata["run_name"],
        "ingestion_time": datetime.now(timezone.utc).isoformat(),
        "storage_version": "1.0.0",
        "schema_version": "1.0.0",
        "artifacts": artifacts,
        "metadata": metadata,
    }
```

---

## 6. Stage 4: Database Transaction

### 6.1 Find-or-Create Pattern

```python
def find_or_create_system(composition_hash: str, metadata: dict) -> UUID:
    # Try to find existing system
    system = db.query(System).filter_by(composition_hash=composition_hash).first()
    if system:
        return system.id

    # Create new system
    system = System(
        id=uuid.uuid4(),
        composition_formula=metadata["composition_formula"],
        composition_hash=composition_hash,
        n_atoms=metadata["n_atoms"],
        n_molecules=metadata["n_molecules"],
        box_type=metadata["box_type"],
        initial_box_vectors=metadata["box_vectors"],
    )
    db.add(system)
    db.flush()  # Get ID without committing
    return system.id
```

### 6.2 Transactional Ingestion

```python
def ingest_to_database(run_data: dict) -> UUID:
    try:
        with db.begin():  # Transaction starts
            # 1. Find or create dependencies
            project_id = find_or_create_project(run_data["project_name"])
            forcefield_id = find_or_create_forcefield(run_data["forcefield"])
            engine_id = find_or_create_engine(run_data["engine"])
            system_id = find_or_create_system(run_data["composition_hash"], run_data["system"])

            # 2. Create simulation run
            run_id = uuid.uuid4()
            run = SimulationRun(
                id=run_id,
                project_id=project_id,
                system_id=system_id,
                engine_id=engine_id,
                run_name=run_data["run_name"],
                run_type=run_data["run_type"],
                ensemble=run_data["ensemble"],
                integrator=run_data["integrator"],
                thermostat=run_data["thermostat"],
                barostat=run_data["barostat"],
                temperature_target=run_data["temperature_target"],
                pressure_target=run_data["pressure_target"],
                timestep=run_data["timestep"],
                n_steps=run_data["n_steps"],
                # ... all other fields
            )
            db.add(run)

            # 3. Create artifact records
            for artifact_data in run_data["artifacts"]:
                artifact = Artifact(
                    id=uuid.uuid4(),
                    run_id=run_id,
                    artifact_type=artifact_data["type"],
                    role=artifact_data["role"],
                    file_path=artifact_data["original_path"],
                    object_key=artifact_data["object_key"],
                    storage_backend=artifact_data["storage_backend"],
                    checksum_sha256=artifact_data["checksum"],
                    size_bytes=artifact_data["size_bytes"],
                    compression=artifact_data["compression"],
                    filename=artifact_data["filename"],
                )
                db.add(artifact)

            # 4. Create lineage if restart/continuation
            if run_data.get("parent_run_id"):
                lineage = Lineage(
                    id=uuid.uuid4(),
                    parent_run_id=run_data["parent_run_id"],
                    child_run_id=run_id,
                    relationship=run_data["lineage_relationship"],
                )
                db.add(lineage)

            # COMMIT happens automatically at end of 'with' block
            return run_id

    except Exception as e:
        # ROLLBACK happens automatically on exception
        logger.error(f"Ingestion failed: {e}")
        raise
```

### 6.3 Marker File Creation

After successful database commit, write marker to prevent re-ingestion:

```python
def write_ingestion_marker(run_dir: Path, run_id: UUID) -> None:
    marker_path = run_dir / ".mdrepo_ingested"
    marker_path.write_text(str(run_id))
```

---

## 7. Stage 5: Post-Ingestion (Deep Analysis)

### 7.1 Observable Extraction

```python
def extract_observables_lammps(run_id: UUID, log_file: Path) -> None:
    # Parse thermo output from log file
    thermo_data = parse_lammps_thermo(log_file)

    # Compute statistics
    for keyword, values in thermo_data.items():
        if keyword in ["Temp", "Press", "PotEng", "KinEng", "TotEng", "Density"]:
            observable = Observable(
                id=uuid.uuid4(),
                run_id=run_id,
                name=keyword.lower(),
                value_type="timeseries",
                unit=get_unit_for_keyword(keyword),
                mean=np.mean(values),
                std_dev=np.std(values),
                min_value=np.min(values),
                max_value=np.max(values),
                value_timeseries=list(zip(thermo_data["Step"], values)),
                analysis_method="lammps_thermo_parse",
            )
            db.add(observable)
```

### 7.2 Auto-Tagging

```python
def auto_tag_run(run: SimulationRun) -> None:
    # Tag based on run type
    if run.run_type == "production":
        add_tag(run.id, "production")
    elif run.run_type == "test":
        add_tag(run.id, "test")

    # Tag based on quality indicators
    if run.status == "completed" and run.exit_code == 0:
        # Check if equilibrated (temperature stable)
        temp_obs = db.query(Observable).filter_by(
            run_id=run.id, name="temperature"
        ).first()
        if temp_obs and temp_obs.std_dev < 5.0:  # Low fluctuation
            add_tag(run.id, "validated")
        else:
            add_tag(run.id, "needs-review")
    elif run.status == "failed":
        add_tag(run.id, "failed-equilibration")
```

---

## 8. CLI Interface

### 8.1 Basic Ingestion

```bash
mdrepo ingest /path/to/lammps/run \
  --project "urea-water-study" \
  --run-name "npt_298K_1bar_prod" \
  --run-type production \
  --deep  # Enable deep analysis
```

### 8.2 Batch Ingestion

```bash
mdrepo ingest-batch runs.txt \
  --project "urea-water-study" \
  --parallel 4 \
  --fail-fast  # Stop on first error
```

Where `runs.txt` contains:
```
/scratch/runs/run_001
/scratch/runs/run_002
/scratch/runs/run_003
```

### 8.3 HPC Integration (SLURM)

**Ingestion script submitted as SLURM job:**

```bash
#!/bin/bash
#SBATCH --job-name=mdrepo_ingest
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --time=01:00:00
#SBATCH --mem=4G

module load python/3.11
module load gromacs/2023

mdrepo ingest $SLURM_SUBMIT_DIR \
  --project "${PROJECT_NAME}" \
  --run-name "${SLURM_JOB_NAME}_${SLURM_JOB_ID}" \
  --slurm-job-id "${SLURM_JOB_ID}" \
  --deep
```

### 8.4 Watch Folder (Daemon Mode)

```bash
mdrepo watch /scratch/incoming \
  --project "auto-ingest" \
  --interval 60  # Check every 60 seconds
```

---

## 9. Error Handling

### 9.1 Validation Failures

**Example: Missing required file**

```
ERROR: Validation failed for /scratch/runs/run_001
  - Missing required file: log.lammps
  - Found: ['in.lammps', 'data.water.lmp', 'traj.dump']
  - Action: Check if simulation completed successfully
```

**Action:** Skip this run, log error, continue with next (unless `--fail-fast`)

### 9.2 Parsing Failures

**Example: Corrupted log file**

```
ERROR: Failed to parse log file: /scratch/runs/run_001/log.lammps
  - Could not extract 'n_steps' from log
  - Possible causes: Simulation crashed, log truncated
  - Action: Manual inspection required
```

**Action:** Mark run as `status='partial'`, ingest artifacts but flag for review

### 9.3 Database Conflicts

**Example: Duplicate run_name**

```
ERROR: Run name 'npt_298K_prod' already exists in project 'urea-water-study'
  - Existing run ID: 550e8400-e29b-41d4-a716-446655440000
  - Ingested at: 2026-01-28T10:30:00Z
  - Action: Use a unique run name or append timestamp
```

**Action:** Suggest `--auto-rename` flag to append timestamp

### 9.4 Storage Failures

**Example: S3 upload timeout**

```
ERROR: Failed to upload artifact to S3
  - File: traj.xtc.gz (4.2 GB)
  - Bucket: md-simulations
  - Error: Connection timeout after 300 seconds
  - Action: Retrying (attempt 2/3)...
```

**Action:** Retry with exponential backoff (3 attempts), then fail

---

## 10. Idempotency Guarantees

### 10.1 Checksum-Based Deduplication

If same file (by checksum) uploaded multiple times:
- Only one copy stored in CAS
- Multiple artifact records can point to same checksum
- No wasted storage

### 10.2 Run Deduplication

If ingesting same directory twice:
1. Check `.mdrepo_ingested` marker → skip if exists
2. Check database for matching `working_directory` → skip if exists
3. Otherwise, treat as new run (different parameters or continuations)

### 10.3 Partial Re-Ingestion

If ingestion failed mid-way:
- Database transaction rolled back → no partial records
- Artifacts uploaded to storage remain (idempotent)
- Re-running ingestion will re-upload (checksums identical, no duplicates)

---

## 11. Performance Optimization

### 11.1 Parallel File Processing

```python
from concurrent.futures import ThreadPoolExecutor

def ingest_artifacts_parallel(artifacts: list[Path]) -> list[dict]:
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [
            executor.submit(process_artifact, artifact)
            for artifact in artifacts
        ]
        return [f.result() for f in futures]
```

### 11.2 Streaming Uploads

For large files, use multipart uploads:

```python
def upload_large_file(file_path: Path, object_key: str) -> None:
    part_size = 50 * 1024 * 1024  # 50 MB
    with open(file_path, "rb") as f:
        part_num = 1
        while chunk := f.read(part_size):
            upload_part(object_key, part_num, chunk)
            part_num += 1
    complete_multipart_upload(object_key)
```

### 11.3 Caching Metadata

Cache parsed metadata in staging directory:

```
staging/run_001/.mdrepo_cache/
├── metadata.json
├── checksums.txt
└── manifest.json
```

On retry, reuse cached data instead of re-parsing.

---

## 12. Testing Strategy

### 12.1 Unit Tests

- `test_detect_engine()`: Test LAMMPS/GROMACS detection
- `test_parse_lammps_input()`: Parse various input scripts
- `test_parse_gromacs_tpr()`: Parse TPR files
- `test_compute_checksum()`: Verify SHA-256 correctness
- `test_composition_hash()`: Ensure determinism

### 12.2 Integration Tests

- `test_ingest_lammps_run()`: Full ingestion of LAMMPS run
- `test_ingest_gromacs_run()`: Full ingestion of GROMACS run
- `test_ingest_idempotency()`: Ingest same run twice, verify no duplicates
- `test_ingest_failure_rollback()`: Simulate upload failure, verify rollback

### 12.3 Regression Tests

Maintain test fixture directories:

```
tests/fixtures/
├── lammps/
│   ├── water_nvt/
│   ├── urea_water_npt/
│   └── polymer_nve/
└── gromacs/
    ├── lysozyme_npt/
    └── membrane_nvt/
```

Run ingestion on all fixtures, verify:
- Correct metadata extraction
- Expected artifact count
- Checksum stability

---

## 13. Failure Recovery

### 13.1 Resume Interrupted Ingestion

If ingestion crashes during Stage 3 (artifact upload):
1. Check staging directory for partial uploads
2. Verify checksums of uploaded artifacts
3. Resume from first missing artifact

**Implementation:**
```python
def resume_ingestion(run_dir: Path) -> None:
    # Load progress from cache
    progress_file = run_dir / ".mdrepo_cache" / "progress.json"
    if progress_file.exists():
        progress = json.loads(progress_file.read_text())
        uploaded_checksums = set(progress["uploaded_artifacts"])
    else:
        uploaded_checksums = set()

    # Re-scan artifacts, skip already uploaded
    artifacts = scan_artifacts(run_dir)
    for artifact in artifacts:
        if artifact["checksum"] not in uploaded_checksums:
            upload_artifact(artifact)
            uploaded_checksums.add(artifact["checksum"])
            save_progress(progress_file, uploaded_checksums)
```

### 13.2 Quarantine Failed Runs

If ingestion fails validation but run seems salvageable:
- Move to quarantine directory: `/staging/quarantine/{run_id}/`
- Log detailed error report
- Notify user for manual review

---

## 14. Lineage Tracking

### 14.1 Restart Detection

**LAMMPS:** Check for `read_restart` command in input script

```python
def detect_lammps_restart(input_file: Path) -> Optional[Path]:
    with open(input_file) as f:
        for line in f:
            if line.startswith("read_restart"):
                restart_file = line.split()[1]
                return Path(restart_file)
    return None
```

**GROMACS:** Check for `-cpi` flag in command or `continuation = yes` in MDP

### 14.2 Parent-Child Linking

If restart detected:
1. Find parent run by checkpoint file checksum
2. Create lineage record with relationship="restart"
3. Inherit system_id and project_id from parent

```python
def link_restart(child_run_id: UUID, checkpoint_checksum: str) -> None:
    # Find parent run that produced this checkpoint
    parent_artifact = db.query(Artifact).filter_by(
        checksum_sha256=checkpoint_checksum,
        artifact_type="checkpoint"
    ).first()

    if parent_artifact:
        lineage = Lineage(
            parent_run_id=parent_artifact.run_id,
            child_run_id=child_run_id,
            relationship="restart",
        )
        db.add(lineage)
```

---

## 15. Configuration

**Global config (`~/.config/mdrepo/config.yaml`):**

```yaml
ingestion:
  default_project: "default"
  auto_rename_duplicates: true
  deep_analysis: false
  compression:
    enabled: true
    method: gzip  # gzip, zstd, xz
    level: 6
  validation:
    require_topology: true
    require_log: true
    check_file_formats: true
  parallel_uploads: 4
  retry_attempts: 3
  retry_backoff: 2  # seconds

storage:
  backend: minio
  endpoint: http://localhost:9000
  bucket: md-simulations
  access_key: ${MINIO_ACCESS_KEY}
  secret_key: ${MINIO_SECRET_KEY}

database:
  url: postgresql://mdrepo:password@localhost:5432/mdrepo
  pool_size: 10

logging:
  level: INFO
  format: json
  file: /var/log/mdrepo/ingest.log
```

---

## Summary

The ingestion pipeline ensures:

1. **Correctness**: Only valid, complete runs ingested
2. **Atomicity**: All-or-nothing database transactions
3. **Integrity**: Checksums verify data not corrupted
4. **Traceability**: Full provenance from source files to database
5. **Idempotency**: Safe to re-run on same data
6. **Performance**: Parallel processing, streaming uploads
7. **Robustness**: Retry logic, error recovery, quarantine

This design supports both interactive use (CLI) and automated workflows (HPC batch jobs, watch folders).
