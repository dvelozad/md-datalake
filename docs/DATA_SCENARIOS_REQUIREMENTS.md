# MD DataLake - Data Scenarios & Requirements Analysis

## Overview

This document analyzes all possible data scenarios for MD simulations and defines requirements for handling incomplete, partial, or varied data formats from LAMMPS and GROMACS.

## Data Completeness Scenarios

### Scenario Matrix

| Scenario | Trajectory | Topology | Log File | Thermo Data | Molecule IDs | Bonds/Angles | Input Script |
|----------|-----------|----------|----------|-------------|--------------|--------------|--------------|
| **S1** - Complete | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **S2** - No Log | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **S3** - No Molecule IDs | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **S4** - Trajectory Only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **S5** - No Topology | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **S6** - Minimal (Traj+Input) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Detailed Scenario Analysis

### **S1: Complete Dataset** ✅ IDEAL CASE

**Available Data:**
- Trajectory file with full atomic positions
- Topology file with molecule definitions, bonds, angles, dihedrals
- Log file with thermodynamic output
- Input script with simulation parameters
- Molecule IDs in trajectory

**Capabilities:**
- ✅ Full 3D visualization with proper molecular structure
- ✅ Accurate bond/angle rendering
- ✅ Time-series plots of T, P, E, density, etc.
- ✅ Complete metadata extraction
- ✅ Molecular-level analysis (per-molecule properties)
- ✅ Full reproducibility

**Requirements:**
- Parse all file types correctly
- Extract and store all metadata
- Enable all visualization features
- Support advanced analysis

---

### **S2: No Log File** ⚠️ COMMON CASE

**Available Data:**
- Trajectory file
- Topology file
- Input script
- Molecule IDs present

**Missing:**
- Thermodynamic time-series (T, P, E vs time)
- Actual simulation performance metrics
- Convergence information

**Capabilities:**
- ✅ Full 3D visualization with molecular structure
- ✅ Bond/angle rendering
- ✅ Structural analysis (RMSD, RDF, etc.)
- ⚠️ Metadata from input script only (target T, P, not actual)
- ❌ No time-series thermodynamic plots
- ❌ No equilibration verification

**Requirements:**

1. **Metadata Strategy:**
   - Extract target parameters from input script
   - Mark as "target" vs "actual" in database
   - Flag runs with missing log files
   - Store `has_log_file: false` in metadata

2. **UI Handling:**
   - Show warning: "No thermodynamic data available"
   - Display target parameters with "(target)" label
   - Disable time-series plot tabs
   - Suggest: "Upload log file to enable thermo plots"

3. **Fallback Analysis:**
   - Compute temperature from velocities (if available in trajectory)
   - Estimate density from box volume and atom count
   - Calculate structural properties only

**Implementation:**
```python
# Backend: Mark incomplete data
run.metadata = {
    "has_log_file": False,
    "temperature_source": "input_script_target",
    "missing_data": ["thermodynamic_timeseries"]
}

# Frontend: Conditional rendering
{hasLogFile ? (
  <ThermoPlots data={thermoData} />
) : (
  <Alert severity="warning">
    No log file available. Thermodynamic plots unavailable.
  </Alert>
)}
```

---

### **S3: No Molecule IDs** ⚠️ COMMON FOR ATOMIC SYSTEMS

**Available Data:**
- Trajectory file (atom positions only)
- Topology file (may have connectivity)
- Log file with thermodynamic data
- Input script

**Missing:**
- Molecule IDs in trajectory
- Per-molecule tracking

**Capabilities:**
- ✅ 3D visualization of atoms
- ⚠️ Bond rendering (if topology has connectivity)
- ✅ Time-series thermodynamic plots
- ❌ Per-molecule analysis
- ❌ Molecular center-of-mass tracking
- ⚠️ Limited structural analysis

**Challenges:**
- **LAMMPS:** Dump files may not include `mol` column
- **GROMACS:** May have topology but trajectory doesn't preserve molecule info
- Cannot distinguish between molecules of same type
- Cannot track individual molecule diffusion

**Requirements:**

1. **Topology-Based Inference:**
   - If topology file exists, infer molecule IDs from connectivity
   - Use bond graph to cluster atoms into molecules
   - Assign molecule IDs post-hoc

2. **Heuristic Assignment:**
   - For simple systems (e.g., water), use distance-based clustering
   - Group atoms by proximity and known molecular formulas
   - Store inferred molecule IDs separately from original data

3. **UI Handling:**
   - Show warning: "Molecule IDs not in trajectory"
   - Offer: "Infer molecules from topology?" button
   - Display atoms with generic coloring if no inference
   - Disable per-molecule analysis features

4. **Database Schema:**
   ```python
   artifact.metadata = {
       "has_molecule_ids": False,
       "molecule_inference": "topology_based",  # or "heuristic" or "none"
       "inference_confidence": 0.95
   }
   ```

**Implementation Strategy:**
```python
# Molecule inference algorithm
def infer_molecules_from_topology(trajectory, topology):
    """Assign molecule IDs based on topology connectivity."""
    # Build bond graph from topology
    bond_graph = build_bond_graph(topology)
    
    # Find connected components (molecules)
    molecules = find_connected_components(bond_graph)
    
    # Assign IDs to trajectory atoms
    for frame in trajectory:
        for mol_id, atom_ids in enumerate(molecules):
            frame.atoms[atom_ids]['mol'] = mol_id
    
    return trajectory, {"method": "topology", "confidence": 1.0}

def infer_molecules_heuristic(trajectory, composition):
    """Heuristic molecule assignment for simple systems."""
    # For water: cluster every 3 atoms (O-H-H)
    if composition == "H2O":
        return assign_water_molecules(trajectory)
    # Add more heuristics for common molecules
```

---

### **S4: Trajectory Only** ❌ MINIMAL CASE

**Available Data:**
- Trajectory file only (positions, maybe velocities)

**Missing:**
- Topology
- Log file
- Input script
- Molecule IDs
- Bonds/angles

**Capabilities:**
- ⚠️ Basic 3D visualization (atoms as spheres)
- ❌ No bond rendering
- ❌ No thermodynamic plots
- ❌ Minimal metadata
- ⚠️ Limited analysis (atom-based only)

**Requirements:**

1. **Minimal Ingestion:**
   - Accept trajectory-only uploads
   - Extract basic info: n_atoms, n_frames, box size
   - Guess atom types from masses (if available)
   - Flag as "incomplete dataset"

2. **UI Handling:**
   - Show prominent warning: "Incomplete dataset"
   - Display only available information
   - Render atoms as colored spheres (by type)
   - No bond/stick representations
   - Suggest: "Upload topology for molecular structure"

3. **Metadata Extraction:**
   ```python
   # Extract what we can from trajectory alone
   metadata = {
       "n_atoms": len(trajectory.atoms),
       "n_frames": len(trajectory),
       "box_dimensions": trajectory.dimensions,
       "atom_types": infer_atom_types(trajectory.atoms.masses),
       "completeness": "trajectory_only",
       "warnings": ["No topology", "No log file", "No bonds"]
   }
   ```

4. **Database Constraints:**
   - Allow NULL for topology_file_id
   - Mark run_status as "partial"
   - Store completeness score

**Visualization Fallback:**
```javascript
// Frontend: Minimal visualization
if (!hasTopology) {
  // Render atoms only, no bonds
  stage.addRepresentation('ball+stick', {
    sele: 'all',
    aspectRatio: 8,  // Large spheres
    bondScale: 0     // No bonds
  });
  
  // Show info message
  showMessage("Rendering atoms only. Upload topology for bonds.");
}
```

---

### **S5: No Topology File** ⚠️ COMMON FOR LAMMPS

**Available Data:**
- Trajectory with molecule IDs
- Log file with thermodynamic data
- Input script

**Missing:**
- Explicit topology file (PSF, TOP, etc.)
- Bond/angle definitions

**Capabilities:**
- ✅ 3D visualization with molecule coloring
- ⚠️ Bond inference possible (distance-based)
- ✅ Time-series thermodynamic plots
- ✅ Per-molecule tracking
- ⚠️ Approximate structural analysis

**Requirements:**

1. **Bond Inference:**
   - Use distance-based bond detection
   - Apply standard covalent radii rules
   - Cache inferred bonds for performance

2. **Topology Generation:**
   - Generate minimal topology from trajectory
   - Store as derived artifact
   - Mark as "inferred" vs "provided"

3. **Implementation:**
   ```python
   def infer_bonds_from_distances(frame, cutoff_factor=1.2):
       """Infer bonds from interatomic distances."""
       bonds = []
       for i, atom_i in enumerate(frame.atoms):
           for j, atom_j in enumerate(frame.atoms[i+1:], start=i+1):
               distance = np.linalg.norm(atom_i.position - atom_j.position)
               covalent_cutoff = (COVALENT_RADII[atom_i.type] + 
                                  COVALENT_RADII[atom_j.type]) * cutoff_factor
               if distance < covalent_cutoff:
                   bonds.append((i, j))
       return bonds
   ```

---

### **S6: Minimal (Trajectory + Input)** ⚠️ ACCEPTABLE

**Available Data:**
- Trajectory file
- Input script

**Missing:**
- Topology
- Log file
- Molecule IDs

**Capabilities:**
- ⚠️ Basic visualization
- ✅ Metadata from input script
- ❌ No thermodynamic verification
- ⚠️ Limited analysis

**Requirements:**
- Combine strategies from S2, S3, S4
- Maximum inference from available data
- Clear warnings about limitations

---

## Cross-Cutting Requirements

### 1. Data Completeness Scoring

```python
def calculate_completeness_score(run):
    """Calculate 0-100 completeness score."""
    score = 0
    weights = {
        'trajectory': 40,      # Essential
        'topology': 20,        # Important for structure
        'log_file': 20,        # Important for validation
        'input_script': 10,    # Nice to have
        'molecule_ids': 5,     # Nice to have
        'bonds_angles': 5      # Nice to have
    }
    
    if run.has_trajectory: score += weights['trajectory']
    if run.has_topology: score += weights['topology']
    if run.has_log_file: score += weights['log_file']
    if run.has_input_script: score += weights['input_script']
    if run.has_molecule_ids: score += weights['molecule_ids']
    if run.has_bonds_angles: score += weights['bonds_angles']
    
    return score
```

### 2. Database Schema Extensions

```sql
-- Add completeness tracking to simulation_runs
ALTER TABLE simulation_runs ADD COLUMN completeness_score INTEGER;
ALTER TABLE simulation_runs ADD COLUMN missing_data JSONB;
ALTER TABLE simulation_runs ADD COLUMN data_quality_flags JSONB;

-- Example data
UPDATE simulation_runs SET 
  completeness_score = 60,
  missing_data = '["log_file", "molecule_ids"]'::jsonb,
  data_quality_flags = '{
    "has_topology": true,
    "has_log_file": false,
    "molecule_ids_inferred": true,
    "bonds_inferred": false
  }'::jsonb
WHERE id = 'some-uuid';
```

### 3. UI Completeness Indicator

```typescript
// Frontend component
interface CompletenessIndicator {
  score: number;
  missingData: string[];
  warnings: string[];
}

function DataCompletenessCard({ run }: { run: SimulationRun }) {
  const getColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  return (
    <Card>
      <CardHeader title="Data Completeness" />
      <CardContent>
        <LinearProgress 
          variant="determinate" 
          value={run.completeness_score}
          color={getColor(run.completeness_score)}
        />
        <Typography>{run.completeness_score}% Complete</Typography>
        
        {run.missing_data.length > 0 && (
          <Alert severity="warning">
            Missing: {run.missing_data.join(', ')}
          </Alert>
        )}
        
        <List>
          {run.data_quality_flags.molecule_ids_inferred && (
            <ListItem>
              <InfoIcon /> Molecule IDs inferred from topology
            </ListItem>
          )}
        </List>
      </CardContent>
    </Card>
  );
}
```

### 4. Ingestion Pipeline Modifications

```python
# Enhanced ingestion with scenario detection
class EnhancedIngestionPipeline:
    
    def detect_scenario(self, directory: Path) -> DataScenario:
        """Detect which data scenario we're dealing with."""
        has_trajectory = self._find_trajectory(directory) is not None
        has_topology = self._find_topology(directory) is not None
        has_log = self._find_log(directory) is not None
        has_input = self._find_input(directory) is not None
        
        # Check trajectory contents
        mol_ids = False
        bonds = False
        if has_trajectory:
            traj = self._load_trajectory(directory)
            mol_ids = 'mol' in traj.atoms.columns
            bonds = len(traj.bonds) > 0 if has_topology else False
        
        return DataScenario(
            has_trajectory=has_trajectory,
            has_topology=has_topology,
            has_log=has_log,
            has_input=has_input,
            has_molecule_ids=mol_ids,
            has_bonds=bonds
        )
    
    def ingest_with_scenario(self, directory: Path, project: str):
        """Ingest data handling different scenarios."""
        scenario = self.detect_scenario(directory)
        
        # Apply scenario-specific strategies
        if not scenario.has_log:
            logger.warning("No log file found. Thermodynamic data unavailable.")
            metadata = self._extract_from_input_only(directory)
        
        if not scenario.has_molecule_ids and scenario.has_topology:
            logger.info("Inferring molecule IDs from topology...")
            self._infer_molecule_ids(directory)
        
        if not scenario.has_topology and scenario.has_trajectory:
            logger.info("Generating minimal topology from trajectory...")
            self._generate_topology(directory)
        
        # Continue with ingestion
        return self._ingest_standard(directory, project, scenario)
```

### 5. API Endpoints for Data Quality

```python
# New API endpoints
@router.get("/runs/{run_id}/completeness")
async def get_run_completeness(run_id: UUID):
    """Get data completeness information for a run."""
    run = await get_run(run_id)
    return {
        "completeness_score": run.completeness_score,
        "missing_data": run.missing_data,
        "data_quality_flags": run.data_quality_flags,
        "recommendations": generate_recommendations(run)
    }

@router.post("/runs/{run_id}/infer-molecules")
async def infer_molecules(run_id: UUID, method: str = "topology"):
    """Trigger molecule ID inference for a run."""
    run = await get_run(run_id)
    if method == "topology" and not run.has_topology:
        raise HTTPException(400, "No topology available")
    
    # Run inference in background
    task = await inference_service.infer_molecules(run_id, method)
    return {"task_id": task.id, "status": "processing"}
```

---

## Implementation Priority

### Phase 1: Detection & Flagging
- [ ] Implement scenario detection in ingestion pipeline
- [ ] Add completeness_score to database
- [ ] Store missing_data and quality flags
- [ ] Display warnings in UI

### Phase 2: Basic Inference
- [ ] Implement bond inference from distances
- [ ] Implement molecule ID inference from topology
- [ ] Add "Infer Molecules" button in UI
- [ ] Cache inferred data as derived artifacts

### Phase 3: Advanced Handling
- [ ] Heuristic molecule assignment for common systems
- [ ] Temperature estimation from velocities
- [ ] Topology generation from trajectories
- [ ] Quality score visualization

### Phase 4: User Guidance
- [ ] Recommendation engine for missing data
- [ ] Upload additional files to existing runs
- [ ] Data quality dashboard
- [ ] Export completeness reports

---

## Testing Strategy

### Test Cases by Scenario

```python
# Test fixtures for each scenario
test_fixtures = {
    "S1_complete": "tests/fixtures/complete_lammps_water/",
    "S2_no_log": "tests/fixtures/lammps_no_log/",
    "S3_no_mol_ids": "tests/fixtures/gromacs_atomic/",
    "S4_traj_only": "tests/fixtures/trajectory_only/",
    "S5_no_topology": "tests/fixtures/lammps_no_topology/",
    "S6_minimal": "tests/fixtures/minimal_data/"
}

@pytest.mark.parametrize("scenario", test_fixtures.keys())
def test_ingestion_scenario(scenario):
    """Test ingestion handles each scenario correctly."""
    directory = test_fixtures[scenario]
    result = ingest(directory, project="test")
    
    # Verify appropriate flags are set
    assert result.completeness_score > 0
    assert len(result.missing_data) >= 0
    
    # Scenario-specific assertions
    if scenario == "S2_no_log":
        assert "log_file" in result.missing_data
        assert result.data_quality_flags["has_log_file"] == False
```

---

## Summary

This requirements document defines how MD DataLake should handle all real-world data scenarios, from complete datasets to minimal trajectory-only files. The key principles are:

1. **Graceful Degradation** - System works with partial data
2. **Clear Communication** - Users know what's missing
3. **Smart Inference** - Automatically fill gaps where possible
4. **Extensibility** - Easy to add new inference methods
5. **Transparency** - Always mark inferred vs provided data
