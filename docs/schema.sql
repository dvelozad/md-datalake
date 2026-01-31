-- MD Simulation Data Repository Schema
-- PostgreSQL 15+
-- Version: 1.0.0
-- Date: 2026-01-29

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For composite indexes

-- =============================================================================
-- ENUM TYPES (for data validation and query precision)
-- =============================================================================

CREATE TYPE ensemble_type AS ENUM (
    'NVE',    -- Microcanonical (constant N, V, E)
    'NVT',    -- Canonical (constant N, V, T)
    'NPT',    -- Isothermal-isobaric (constant N, P, T)
    'NPH',    -- Isenthalpic (constant N, P, H)
    'muVT',   -- Grand canonical (constant mu, V, T)
    'NVT_NVE' -- Hybrid (NVT equilibration, NVE production)
);

CREATE TYPE integrator_type AS ENUM (
    'verlet',
    'velocity_verlet',
    'leapfrog',
    'nose_hoover',
    'langevin',
    'brownian',
    'steep',        -- Steepest descent (minimization)
    'cg',           -- Conjugate gradient
    'md',           -- GROMACS generic MD
    'md_vv',        -- GROMACS velocity-verlet
    'sd'            -- GROMACS stochastic dynamics
);

CREATE TYPE thermostat_type AS ENUM (
    'none',
    'nose_hoover',
    'berendsen',
    'andersen',
    'langevin',
    'v_rescale',       -- Velocity rescaling (GROMACS)
    'nose_hoover_chains',
    'csvr',            -- Canonical sampling through velocity rescaling
    'stochastic_rescaling'
);

CREATE TYPE barostat_type AS ENUM (
    'none',
    'berendsen',
    'parrinello_rahman',
    'mttk',            -- Martyna-Tobias-Klein
    'nose_hoover',
    'langevin',
    'c_rescale'        -- C-rescale (GROMACS 2021+)
);

CREATE TYPE artifact_type AS ENUM (
    'trajectory',      -- XTC, TRR, DCD, DUMP
    'topology',        -- PSF, TOP, PRM, ITP, DATA
    'structure',       -- PDB, GRO, CRD
    'input',           -- MDP, IN script
    'log',             -- LOG, OUT
    'energy',          -- EDR, thermodynamic output
    'checkpoint',      -- CPT, RESTART
    'index',           -- NDX (GROMACS index file)
    'analysis',        -- RDF, MSD, RMSD results
    'custom'
);

CREATE TYPE artifact_role AS ENUM (
    'primary',         -- Main trajectory
    'supplementary',   -- Additional outputs
    'input',           -- Configuration files
    'output',          -- Logs and results
    'derived'          -- Post-processing products
);

CREATE TYPE run_type AS ENUM (
    'minimization',
    'equilibration_nvt',
    'equilibration_npt',
    'production',
    'umbrella_sampling',
    'metadynamics',
    'remd',            -- Replica exchange
    'steered_md',
    'test',
    'other'
);

CREATE TYPE run_status AS ENUM (
    'completed',
    'failed',
    'running',
    'partial',         -- Incomplete but useful
    'cancelled'
);

CREATE TYPE lineage_relationship AS ENUM (
    'restart',         -- Continues from checkpoint
    'continuation',    -- Extends time range
    'branch',          -- Alternative parameters from same parent
    'refinement',      -- Higher resolution/accuracy
    'derived'          -- Analysis product
);

CREATE TYPE box_type AS ENUM (
    'cubic',
    'orthorhombic',
    'triclinic',
    'dodecahedron',
    'octahedron'
);

CREATE TYPE compression_type AS ENUM (
    'none',
    'gzip',
    'xz',
    'zstd',
    'lz4'
);

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Projects: Organizational unit for related simulations
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    owner TEXT NOT NULL,
    funding_source TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT projects_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_projects_owner ON projects(owner);
CREATE INDEX idx_projects_created ON projects(created_at DESC);

-- Force fields: Parameterization schemes
CREATE TABLE forcefields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,  -- e.g., "CHARMM36m", "AMBER99SB-ILDN"
    family TEXT NOT NULL, -- e.g., "CHARMM", "AMBER", "OPLS"
    version TEXT,
    water_model TEXT,    -- e.g., "TIP3P", "SPC/E", "TIP4P/2005"
    parameters JSONB,    -- File hashes, parameter specifics
    citation TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT forcefields_unique_name_version UNIQUE(name, version)
);

CREATE INDEX idx_forcefields_family ON forcefields(family);
CREATE INDEX idx_forcefields_water ON forcefields(water_model);

-- Simulation engines: Software and versions
CREATE TABLE engines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,  -- "LAMMPS", "GROMACS"
    version TEXT NOT NULL,
    git_commit TEXT,     -- Exact source version
    build_date DATE,
    build_flags TEXT,    -- Compilation options
    compiler TEXT,       -- e.g., "gcc-11.2.0"
    mpi_library TEXT,    -- e.g., "OpenMPI-4.1.1"
    gpu_support BOOLEAN DEFAULT FALSE,
    environment_hash TEXT, -- Hash of full environment (container, modules)
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT engines_unique_version UNIQUE(name, version, git_commit)
);

CREATE INDEX idx_engines_name ON engines(name);
CREATE INDEX idx_engines_version ON engines(name, version);

-- Chemical systems: Atomic composition and topology
CREATE TABLE systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Composition identifiers
    composition_formula TEXT NOT NULL, -- Human-readable, e.g., "H2O_512_urea_32"
    composition_hash TEXT NOT NULL UNIQUE, -- Deterministic hash from sorted atom list

    -- Atomic details
    n_atoms INTEGER NOT NULL CHECK (n_atoms > 0),
    n_molecules JSONB NOT NULL, -- e.g., {"H2O": 512, "urea": 32, "Na": 8, "Cl": 8}
    molecular_weight REAL, -- g/mol

    -- Box geometry
    box_type box_type NOT NULL,
    initial_box_vectors JSONB NOT NULL, -- [[Lx, 0, 0], [0, Ly, 0], [0, 0, Lz]] or full triclinic
    initial_volume REAL, -- Angstrom^3 or nm^3
    initial_density REAL, -- g/cm^3

    -- Topology reference
    topology_file_id UUID, -- FK to artifacts (canonical topology)
    forcefield_id UUID REFERENCES forcefields(id) ON DELETE SET NULL,

    -- Descriptive
    description TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT systems_molecules_nonempty CHECK (jsonb_typeof(n_molecules) = 'object')
);

CREATE INDEX idx_systems_composition_hash ON systems(composition_hash);
CREATE INDEX idx_systems_forcefield ON systems(forcefield_id);
CREATE INDEX idx_systems_n_atoms ON systems(n_atoms);
CREATE INDEX idx_systems_molecules_gin ON systems USING gin(n_molecules);

-- Simulation runs: Individual MD simulations
CREATE TABLE simulation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Relationships
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    system_id UUID NOT NULL REFERENCES systems(id) ON DELETE RESTRICT,
    engine_id UUID NOT NULL REFERENCES engines(id) ON DELETE RESTRICT,

    -- Identifiers
    run_name TEXT NOT NULL,
    run_type run_type NOT NULL,

    -- Simulation parameters
    ensemble ensemble_type NOT NULL,
    integrator integrator_type NOT NULL,
    thermostat thermostat_type,
    barostat barostat_type,

    -- Thermodynamic targets
    temperature_target REAL CHECK (temperature_target IS NULL OR temperature_target > 0),
    temperature_tolerance REAL, -- e.g., ±2 K
    pressure_target REAL,        -- bar
    pressure_tolerance REAL,

    -- Integration parameters
    timestep REAL NOT NULL CHECK (timestep > 0), -- femtoseconds
    n_steps BIGINT NOT NULL CHECK (n_steps > 0),
    total_time REAL GENERATED ALWAYS AS (timestep * n_steps / 1000000.0) STORED, -- nanoseconds
    start_time BIGINT NOT NULL DEFAULT 0, -- Starting step (for continuations)

    -- Constraints and cutoffs
    constraints TEXT, -- e.g., "h-bonds", "all-bonds"
    cutoff_coulomb REAL, -- Angstroms
    cutoff_vdw REAL,     -- Angstroms
    coulomb_method TEXT, -- "PPPM", "PME", "Ewald", "reaction-field"
    vdw_method TEXT,     -- "cutoff", "PME"
    pbc TEXT,            -- "xyz", "xy", "none"

    -- Reproducibility
    random_seed INTEGER,

    -- Execution context
    working_directory TEXT NOT NULL,
    hostname TEXT,
    slurm_job_id TEXT,
    environment_hash TEXT,

    -- Status
    status run_status NOT NULL DEFAULT 'running',
    exit_code INTEGER,
    error_message TEXT,

    -- Timing
    ingestion_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    simulation_start_time TIMESTAMP WITH TIME ZONE,
    simulation_end_time TIMESTAMP WITH TIME ZONE,
    wall_time_seconds REAL,

    -- User context
    created_by_user TEXT NOT NULL,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT runs_name_unique_per_project UNIQUE(project_id, run_name),
    CONSTRAINT runs_end_after_start CHECK (
        simulation_end_time IS NULL OR
        simulation_start_time IS NULL OR
        simulation_end_time >= simulation_start_time
    ),
    CONSTRAINT runs_thermostat_required_for_nvt CHECK (
        ensemble NOT IN ('NVT', 'NPT') OR thermostat IS NOT NULL
    ),
    CONSTRAINT runs_barostat_required_for_npt CHECK (
        ensemble != 'NPT' OR barostat IS NOT NULL
    ),
    CONSTRAINT runs_temperature_for_thermostat CHECK (
        thermostat = 'none' OR temperature_target IS NOT NULL
    )
);

-- Indexes for common queries
CREATE INDEX idx_runs_project ON simulation_runs(project_id);
CREATE INDEX idx_runs_system ON simulation_runs(system_id);
CREATE INDEX idx_runs_engine ON simulation_runs(engine_id);
CREATE INDEX idx_runs_ensemble ON simulation_runs(ensemble);
CREATE INDEX idx_runs_run_type ON simulation_runs(run_type);
CREATE INDEX idx_runs_status ON simulation_runs(status);
CREATE INDEX idx_runs_temperature ON simulation_runs(temperature_target) WHERE temperature_target IS NOT NULL;
CREATE INDEX idx_runs_pressure ON simulation_runs(pressure_target) WHERE pressure_target IS NOT NULL;
CREATE INDEX idx_runs_ingestion_time ON simulation_runs(ingestion_time DESC);
CREATE INDEX idx_runs_created_by ON simulation_runs(created_by_user);
CREATE INDEX idx_runs_metadata_gin ON simulation_runs USING gin(metadata);

-- Composite indexes for common filter combinations
CREATE INDEX idx_runs_ensemble_temp_press ON simulation_runs(ensemble, temperature_target, pressure_target);
CREATE INDEX idx_runs_system_ensemble_type ON simulation_runs(system_id, ensemble, run_type);

-- Artifacts: Files associated with runs
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,

    -- Classification
    artifact_type artifact_type NOT NULL,
    role artifact_role NOT NULL,

    -- Storage location
    file_path TEXT NOT NULL,        -- Original path on filesystem
    object_key TEXT,                -- S3/MinIO object key
    storage_backend TEXT NOT NULL,  -- "filesystem", "s3", "minio"

    -- Integrity
    checksum_sha256 TEXT NOT NULL,  -- Content hash (primary key for deduplication)
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    compression compression_type NOT NULL DEFAULT 'none',

    -- Metadata
    filename TEXT NOT NULL,
    format TEXT,                    -- "xtc", "trr", "dcd", "dump", etc.
    frame_count INTEGER,            -- For trajectories
    time_range JSONB,               -- [start_ps, end_ps]

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_verified TIMESTAMP WITH TIME ZONE, -- Last checksum verification
    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT artifacts_unique_checksum_per_run UNIQUE(run_id, checksum_sha256),
    CONSTRAINT artifacts_object_key_if_cloud CHECK (
        storage_backend = 'filesystem' OR object_key IS NOT NULL
    )
);

CREATE INDEX idx_artifacts_run ON artifacts(run_id);
CREATE INDEX idx_artifacts_type ON artifacts(artifact_type);
CREATE INDEX idx_artifacts_checksum ON artifacts(checksum_sha256);
CREATE INDEX idx_artifacts_storage ON artifacts(storage_backend);

-- Observables: Computed quantities from simulations
CREATE TABLE observables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,

    -- Observable identification
    name TEXT NOT NULL,             -- "temperature", "pressure", "density", "rmsd"
    value_type TEXT NOT NULL,       -- "scalar", "timeseries", "distribution"
    unit TEXT NOT NULL,             -- "K", "bar", "g/cm^3", "Angstrom"

    -- Values
    value_scalar REAL,              -- For single values
    value_timeseries JSONB,         -- [[time, value], ...] for time-dependent
    value_distribution JSONB,       -- Histogram or distribution data

    -- Statistics
    mean REAL,
    std_dev REAL,
    min_value REAL,
    max_value REAL,
    uncertainty REAL,               -- Statistical or systematic

    -- Provenance
    analysis_method TEXT,           -- How was this computed
    time_range JSONB,               -- Time window used [start, end]
    computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    computed_by TEXT,               -- Tool/script used

    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT observables_unique_name_per_run UNIQUE(run_id, name, analysis_method),
    CONSTRAINT observables_value_present CHECK (
        value_scalar IS NOT NULL OR
        value_timeseries IS NOT NULL OR
        value_distribution IS NOT NULL
    )
);

CREATE INDEX idx_observables_run ON observables(run_id);
CREATE INDEX idx_observables_name ON observables(name);
CREATE INDEX idx_observables_type ON observables(value_type);

-- Lineage: Parent-child relationships between runs
CREATE TABLE lineage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    child_run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    relationship lineage_relationship NOT NULL,
    continuation_step BIGINT,       -- For restarts, which step
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT lineage_unique_parent_child UNIQUE(parent_run_id, child_run_id),
    CONSTRAINT lineage_no_self_reference CHECK (parent_run_id != child_run_id)
);

CREATE INDEX idx_lineage_parent ON lineage(parent_run_id);
CREATE INDEX idx_lineage_child ON lineage(child_run_id);
CREATE INDEX idx_lineage_relationship ON lineage(relationship);

-- Tags: Flexible labeling system
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    category TEXT,                  -- "status", "quality", "project", "method"
    description TEXT,
    color TEXT,                     -- Hex color for UI
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT tags_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_tags_category ON tags(category);

-- Many-to-many relationship: runs <-> tags
CREATE TABLE run_tags (
    run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by TEXT,

    PRIMARY KEY (run_id, tag_id)
);

CREATE INDEX idx_run_tags_run ON run_tags(run_id);
CREATE INDEX idx_run_tags_tag ON run_tags(tag_id);

-- Comments: Annotations on runs
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    author TEXT NOT NULL,
    content TEXT NOT NULL CHECK (length(content) > 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_comments_run ON comments(run_id);
CREATE INDEX idx_comments_author ON comments(author);
CREATE INDEX idx_comments_created ON comments(created_at DESC);

-- Full-text search on comments
CREATE INDEX idx_comments_content_trgm ON comments USING gin(content gin_trgm_ops);

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Complete run information with denormalized joins
CREATE VIEW run_details AS
SELECT
    r.id,
    r.run_name,
    r.run_type,
    r.ensemble,
    r.integrator,
    r.thermostat,
    r.barostat,
    r.temperature_target,
    r.pressure_target,
    r.timestep,
    r.n_steps,
    r.total_time,
    r.status,
    r.created_by_user,
    r.ingestion_time,
    p.name AS project_name,
    s.composition_formula,
    s.n_atoms,
    s.n_molecules,
    ff.name AS forcefield_name,
    ff.water_model,
    e.name AS engine_name,
    e.version AS engine_version
FROM simulation_runs r
LEFT JOIN projects p ON r.project_id = p.id
JOIN systems s ON r.system_id = s.id
LEFT JOIN forcefields ff ON s.forcefield_id = ff.id
JOIN engines e ON r.engine_id = e.id;

-- Artifact summary per run
CREATE VIEW run_artifact_summary AS
SELECT
    run_id,
    COUNT(*) AS total_artifacts,
    SUM(size_bytes) AS total_size_bytes,
    SUM(size_bytes) / (1024.0 * 1024.0 * 1024.0) AS total_size_gb,
    jsonb_object_agg(artifact_type, count) AS artifact_counts
FROM (
    SELECT run_id, artifact_type, size_bytes, COUNT(*) AS count
    FROM artifacts
    GROUP BY run_id, artifact_type, size_bytes
) subq
GROUP BY run_id;

-- Lineage tree (recursive)
CREATE VIEW lineage_tree AS
WITH RECURSIVE tree AS (
    -- Base case: root runs (no parents)
    SELECT
        r.id,
        r.run_name,
        NULL::UUID AS parent_id,
        NULL::TEXT AS parent_name,
        0 AS depth,
        ARRAY[r.id] AS path
    FROM simulation_runs r
    WHERE NOT EXISTS (SELECT 1 FROM lineage WHERE child_run_id = r.id)

    UNION ALL

    -- Recursive case: children
    SELECT
        r.id,
        r.run_name,
        l.parent_run_id,
        p.run_name AS parent_name,
        t.depth + 1,
        t.path || r.id
    FROM simulation_runs r
    JOIN lineage l ON r.id = l.child_run_id
    JOIN tree t ON l.parent_run_id = t.id
    JOIN simulation_runs p ON l.parent_run_id = p.id
    WHERE NOT (r.id = ANY(t.path)) -- Prevent cycles
)
SELECT * FROM tree;

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Validate composition hash matches composition
CREATE OR REPLACE FUNCTION validate_composition_hash()
RETURNS TRIGGER AS $$
BEGIN
    -- In practice, this would call a Python function to compute hash
    -- For now, just ensure it's not empty
    IF length(trim(NEW.composition_hash)) = 0 THEN
        RAISE EXCEPTION 'composition_hash cannot be empty';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER systems_validate_hash
    BEFORE INSERT OR UPDATE ON systems
    FOR EACH ROW
    EXECUTE FUNCTION validate_composition_hash();

-- =============================================================================
-- SCHEMA METADATA
-- =============================================================================

CREATE TABLE schema_versions (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_versions (version, description) VALUES
    ('1.0.0', 'Initial schema with full MD simulation support');

-- =============================================================================
-- INITIAL SEED DATA
-- =============================================================================

-- Common force fields
INSERT INTO forcefields (name, family, version, water_model, citation) VALUES
    ('CHARMM36m', 'CHARMM', '36m', 'TIP3P', 'Huang et al. Nature Methods 2017'),
    ('AMBER99SB-ILDN', 'AMBER', '99SB-ILDN', 'TIP3P', 'Lindorff-Larsen et al. Proteins 2010'),
    ('OPLS-AA', 'OPLS', 'AA', 'TIP4P', 'Jorgensen et al. JACS 1996'),
    ('GROMOS54A7', 'GROMOS', '54A7', 'SPC', 'Schmid et al. Eur. Biophys. J. 2011');

-- Common tags
INSERT INTO tags (name, category, description, color) VALUES
    ('production', 'status', 'Production-quality run', '#00AA00'),
    ('test', 'status', 'Test run, not for analysis', '#AAAAAA'),
    ('needs-review', 'quality', 'Requires manual inspection', '#FF9900'),
    ('validated', 'quality', 'Quality checked and approved', '#0088FF'),
    ('failed-equilibration', 'quality', 'System not equilibrated', '#FF0000'),
    ('high-quality', 'quality', 'Excellent convergence', '#00DD00');

COMMENT ON TABLE projects IS 'Organizational units grouping related simulations';
COMMENT ON TABLE forcefields IS 'Force field parameterizations (CHARMM, AMBER, OPLS, etc.)';
COMMENT ON TABLE engines IS 'MD software with version and build information';
COMMENT ON TABLE systems IS 'Chemical systems (composition, topology, force field)';
COMMENT ON TABLE simulation_runs IS 'Individual MD simulation runs with full parameters';
COMMENT ON TABLE artifacts IS 'Files associated with runs (trajectories, logs, etc.)';
COMMENT ON TABLE observables IS 'Computed thermodynamic and structural properties';
COMMENT ON TABLE lineage IS 'Parent-child relationships between runs';
COMMENT ON TABLE tags IS 'Flexible labels for categorizing runs';
COMMENT ON TABLE run_tags IS 'Many-to-many: runs ↔ tags';
COMMENT ON TABLE comments IS 'User annotations on runs';
