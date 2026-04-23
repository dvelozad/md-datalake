# Implementation Plan: Data Scenario Handling - Phase 1

## Goal

Implement detection and flagging of data completeness scenarios for MD simulations, allowing the system to gracefully handle incomplete datasets (missing logs, no molecule IDs, trajectory-only, etc.) and clearly communicate data quality to users.

## User Review Required

> [!IMPORTANT]
> **Database Schema Changes**
> This implementation adds new columns to the `simulation_runs` and `artifacts` tables. This is a breaking change that requires a database migration.

> [!WARNING]
> **Backward Compatibility**
> Existing runs in the database will have NULL values for new columns until re-ingested or manually updated.

## Proposed Changes

### Backend Components

#### 1. Database Schema Extensions

##### [NEW] [migration](file:///home/deo/Documents/projects/md-datalake/migrations/versions/add_data_completeness_tracking.py)

Create Alembic migration to add completeness tracking fields:

```python
"""Add data completeness tracking

Revision ID: add_completeness
Revises: previous_revision
Create Date: 2026-01-31
"""

def upgrade():
    # Add columns to simulation_runs
    op.add_column('simulation_runs', 
        sa.Column('completeness_score', sa.Integer(), nullable=True))
    op.add_column('simulation_runs', 
        sa.Column('missing_data', JSONB(), nullable=True, server_default='[]'))
    op.add_column('simulation_runs', 
        sa.Column('data_quality_flags', JSONB(), nullable=True, server_default='{}'))
    
    # Add columns to artifacts
    op.add_column('artifacts',
        sa.Column('has_molecule_ids', sa.Boolean(), nullable=True))
    op.add_column('artifacts',
        sa.Column('has_bonds', sa.Boolean(), nullable=True))
    op.add_column('artifacts',
        sa.Column('inference_metadata', JSONB(), nullable=True, server_default='{}'))
    
    # Create index for completeness queries
    op.create_index('idx_runs_completeness', 'simulation_runs', ['completeness_score'])

def downgrade():
    op.drop_index('idx_runs_completeness')
    op.drop_column('artifacts', 'inference_metadata')
    op.drop_column('artifacts', 'has_bonds')
    op.drop_column('artifacts', 'has_molecule_ids')
    op.drop_column('simulation_runs', 'data_quality_flags')
    op.drop_column('simulation_runs', 'missing_data')
    op.drop_column('simulation_runs', 'completeness_score')
```

##### [MODIFY] [simulation_run.py](file:///home/deo/Documents/projects/md-datalake/src/mddatalake/db/models/simulation_run.py)

Add new fields to SimulationRun model:

```python
# Add to SimulationRun class
completeness_score = Column(Integer, nullable=True)
missing_data = Column(JSONB, nullable=True, server_default='[]')
data_quality_flags = Column(JSONB, nullable=True, server_default='{}')
```

##### [MODIFY] [artifact.py](file:///home/deo/Documents/projects/md-datalake/src/mddatalake/db/models/artifact.py)

Add new fields to Artifact model:

```python
# Add to Artifact class
has_molecule_ids = Column(Boolean, nullable=True)
has_bonds = Column(Boolean, nullable=True)
inference_metadata = Column(JSONB, nullable=True, server_default='{}')
```

---

#### 2. Core Data Structures

##### [NEW] [data_scenario.py](file:///home/deo/Documents/projects/md-datalake/src/mddatalake/core/data_scenario.py)

Define data scenario types and detection logic:

```python
"""Data scenario detection and classification."""

from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional


class ScenarioType(Enum):
    """Data completeness scenarios."""
    COMPLETE = "complete"
    NO_LOG = "no_log"
    NO_MOLECULE_IDS = "no_molecule_ids"
    TRAJECTORY_ONLY = "trajectory_only"
    NO_TOPOLOGY = "no_topology"
    MINIMAL = "minimal"


@dataclass
class DataScenario:
    """Represents the completeness of a simulation dataset."""
    
    scenario_type: ScenarioType
    has_trajectory: bool
    has_topology: bool
    has_log: bool
    has_input: bool
    has_molecule_ids: bool
    has_bonds: bool
    completeness_score: int
    missing_data: list[str]
    warnings: list[str]
    
    @classmethod
    def detect(cls, directory: Path, engine_type: str) -> "DataScenario":
        """Detect data scenario from directory contents."""
        from mddatalake.parsers.detector import detect_files
        
        files = detect_files(directory, engine_type)
        
        has_trajectory = files.get('trajectory') is not None
        has_topology = files.get('topology') is not None
        has_log = files.get('log') is not None
        has_input = files.get('input') is not None
        
        # Check trajectory contents if available
        has_molecule_ids = False
        has_bonds = False
        if has_trajectory:
            has_molecule_ids = cls._check_molecule_ids(files['trajectory'])
        if has_topology:
            has_bonds = cls._check_bonds(files['topology'])
        
        # Determine scenario type
        scenario_type = cls._classify_scenario(
            has_trajectory, has_topology, has_log, 
            has_input, has_molecule_ids, has_bonds
        )
        
        # Calculate completeness score
        score = cls._calculate_score(
            has_trajectory, has_topology, has_log,
            has_input, has_molecule_ids, has_bonds
        )
        
        # Identify missing data
        missing = []
        if not has_log: missing.append("log_file")
        if not has_topology: missing.append("topology")
        if not has_input: missing.append("input_script")
        if not has_molecule_ids: missing.append("molecule_ids")
        if not has_bonds: missing.append("bonds")
        
        # Generate warnings
        warnings = cls._generate_warnings(scenario_type, missing)
        
        return cls(
            scenario_type=scenario_type,
            has_trajectory=has_trajectory,
            has_topology=has_topology,
            has_log=has_log,
            has_input=has_input,
            has_molecule_ids=has_molecule_ids,
            has_bonds=has_bonds,
            completeness_score=score,
            missing_data=missing,
            warnings=warnings
        )
    
    @staticmethod
    def _classify_scenario(traj, topo, log, inp, mol_ids, bonds) -> ScenarioType:
        """Classify the data scenario."""
        if traj and topo and log and inp and mol_ids and bonds:
            return ScenarioType.COMPLETE
        elif traj and topo and inp and mol_ids and bonds and not log:
            return ScenarioType.NO_LOG
        elif traj and topo and log and inp and not mol_ids:
            return ScenarioType.NO_MOLECULE_IDS
        elif traj and not topo and not log and not inp:
            return ScenarioType.TRAJECTORY_ONLY
        elif traj and log and inp and not topo:
            return ScenarioType.NO_TOPOLOGY
        else:
            return ScenarioType.MINIMAL
    
    @staticmethod
    def _calculate_score(traj, topo, log, inp, mol_ids, bonds) -> int:
        """Calculate 0-100 completeness score."""
        weights = {
            'trajectory': 40,
            'topology': 20,
            'log': 20,
            'input': 10,
            'molecule_ids': 5,
            'bonds': 5
        }
        
        score = 0
        if traj: score += weights['trajectory']
        if topo: score += weights['topology']
        if log: score += weights['log']
        if inp: score += weights['input']
        if mol_ids: score += weights['molecule_ids']
        if bonds: score += weights['bonds']
        
        return score
    
    @staticmethod
    def _generate_warnings(scenario_type: ScenarioType, missing: list[str]) -> list[str]:
        """Generate user-friendly warnings."""
        warnings = []
        
        if "log_file" in missing:
            warnings.append("No log file found. Thermodynamic plots will be unavailable.")
        
        if "molecule_ids" in missing:
            warnings.append("Molecule IDs not found in trajectory. Per-molecule analysis disabled.")
        
        if "topology" in missing:
            warnings.append("No topology file. Bond rendering will use distance-based inference.")
        
        if scenario_type == ScenarioType.TRAJECTORY_ONLY:
            warnings.append("Minimal dataset detected. Only basic visualization available.")
        
        return warnings
    
    @staticmethod
    def _check_molecule_ids(trajectory_path: Path) -> bool:
        """Check if trajectory contains molecule IDs."""
        # Implementation depends on file format
        # For LAMMPS: check if 'mol' column exists
        # For GROMACS: check topology
        return False  # Placeholder
    
    @staticmethod
    def _check_bonds(topology_path: Path) -> bool:
        """Check if topology contains bond information."""
        return False  # Placeholder
```

---

#### 3. Ingestion Service Updates

##### [MODIFY] [service.py](file:///home/deo/Documents/projects/md-datalake/src/mddatalake/ingestion/service.py)

Update ingestion service to detect and store scenario information:

```python
# Add imports
from mddatalake.core.data_scenario import DataScenario

# Modify IngestionService.ingest() method
async def ingest(self, directory: Path, project_name: str, run_name: Optional[str] = None):
    """Ingest simulation with scenario detection."""
    
    # Detect engine type
    engine_type = detect_engine(directory)
    
    # Detect data scenario
    scenario = DataScenario.detect(directory, engine_type)
    
    logger.info(f"Detected scenario: {scenario.scenario_type.value}")
    logger.info(f"Completeness score: {scenario.completeness_score}%")
    
    if scenario.warnings:
        for warning in scenario.warnings:
            logger.warning(warning)
    
    # Continue with existing ingestion logic...
    # But store scenario information in database
    
    run = SimulationRun(
        # ... existing fields ...
        completeness_score=scenario.completeness_score,
        missing_data=scenario.missing_data,
        data_quality_flags={
            "has_trajectory": scenario.has_trajectory,
            "has_topology": scenario.has_topology,
            "has_log": scenario.has_log,
            "has_input": scenario.has_input,
            "has_molecule_ids": scenario.has_molecule_ids,
            "has_bonds": scenario.has_bonds,
            "scenario_type": scenario.scenario_type.value
        }
    )
    
    # Store artifact-level flags
    for artifact in artifacts:
        if artifact.artifact_type == ArtifactType.TRAJECTORY:
            artifact.has_molecule_ids = scenario.has_molecule_ids
        elif artifact.artifact_type == ArtifactType.TOPOLOGY:
            artifact.has_bonds = scenario.has_bonds
```

---

#### 4. API Endpoints

##### [NEW] [completeness.py](file:///home/deo/Documents/projects/md-datalake/src/mddatalake/api/routes/completeness.py)

Create API endpoints for data completeness queries:

```python
"""API endpoints for data completeness and quality."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from mddatalake.db.session import get_session
from mddatalake.db.models import SimulationRun

router = APIRouter()


@router.get("/runs/{run_id}/completeness")
async def get_run_completeness(
    run_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    """Get data completeness information for a run."""
    result = await session.execute(
        select(SimulationRun).where(SimulationRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(404, "Run not found")
    
    return {
        "run_id": str(run.id),
        "completeness_score": run.completeness_score,
        "missing_data": run.missing_data or [],
        "data_quality_flags": run.data_quality_flags or {},
        "warnings": _generate_warnings(run),
        "recommendations": _generate_recommendations(run)
    }


def _generate_warnings(run: SimulationRun) -> list[str]:
    """Generate warnings based on missing data."""
    warnings = []
    flags = run.data_quality_flags or {}
    
    if not flags.get("has_log"):
        warnings.append("No log file available. Thermodynamic plots unavailable.")
    
    if not flags.get("has_molecule_ids"):
        warnings.append("Molecule IDs not found. Per-molecule analysis disabled.")
    
    return warnings


def _generate_recommendations(run: SimulationRun) -> list[str]:
    """Generate recommendations for improving data completeness."""
    recommendations = []
    flags = run.data_quality_flags or {}
    
    if not flags.get("has_log"):
        recommendations.append("Upload log file to enable thermodynamic analysis")
    
    if not flags.get("has_topology"):
        recommendations.append("Upload topology file for accurate bond rendering")
    
    if not flags.get("has_molecule_ids") and flags.get("has_topology"):
        recommendations.append("Molecule IDs can be inferred from topology")
    
    return recommendations
```

##### [MODIFY] [main.py](file:///home/deo/Documents/projects/md-datalake/src/mddatalake/api/main.py)

Register the new router:

```python
from mddatalake.api.routes import completeness

app.include_router(completeness.router, prefix="/api/v1", tags=["Data Quality"])
```

---

### Frontend Components

#### 1. Type Definitions

##### [MODIFY] [types/index.ts](file:///home/deo/Documents/projects/md-datalake/frontend/src/types/index.ts)

Add completeness types:

```typescript
export interface DataQualityFlags {
  has_trajectory: boolean;
  has_topology: boolean;
  has_log: boolean;
  has_input: boolean;
  has_molecule_ids: boolean;
  has_bonds: boolean;
  scenario_type: string;
}

export interface CompletenessInfo {
  run_id: string;
  completeness_score: number;
  missing_data: string[];
  data_quality_flags: DataQualityFlags;
  warnings: string[];
  recommendations: string[];
}

export interface SimulationRun {
  // ... existing fields ...
  completeness_score?: number;
  missing_data?: string[];
  data_quality_flags?: DataQualityFlags;
}
```

---

#### 2. UI Components

##### [NEW] [CompletenessIndicator.tsx](file:///home/deo/Documents/projects/md-datalake/frontend/src/components/quality/CompletenessIndicator.tsx)

Create completeness indicator component:

```typescript
import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  LinearProgress,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Box
} from '@mui/material';
import {
  CheckCircle,
  Warning,
  Error,
  Info
} from '@mui/icons-material';
import { CompletenessInfo } from '@/types';

interface Props {
  completeness: CompletenessInfo;
}

export function CompletenessIndicator({ completeness }: Props) {
  const getColor = (score: number): 'success' | 'warning' | 'error' => {
    if (score >= 90) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getIcon = (score: number) => {
    if (score >= 90) return <CheckCircle color="success" />;
    if (score >= 60) return <Warning color="warning" />;
    return <Error color="error" />;
  };

  return (
    <Card>
      <CardHeader 
        title="Data Completeness" 
        avatar={getIcon(completeness.completeness_score)}
      />
      <CardContent>
        <Box sx={{ mb: 2 }}>
          <LinearProgress 
            variant="determinate" 
            value={completeness.completeness_score}
            color={getColor(completeness.completeness_score)}
            sx={{ height: 10, borderRadius: 5 }}
          />
          <Typography variant="h6" sx={{ mt: 1 }}>
            {completeness.completeness_score}% Complete
          </Typography>
        </Box>

        {completeness.missing_data.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Missing Data:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {completeness.missing_data.map(item => (
                <Chip 
                  key={item}
                  label={item.replace('_', ' ')}
                  size="small"
                  color="warning"
                />
              ))}
            </Box>
          </Box>
        )}

        {completeness.warnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <List dense>
              {completeness.warnings.map((warning, idx) => (
                <ListItem key={idx}>
                  <ListItemText primary={warning} />
                </ListItem>
              ))}
            </List>
          </Alert>
        )}

        {completeness.recommendations.length > 0 && (
          <Alert severity="info">
            <Typography variant="subtitle2" gutterBottom>
              Recommendations:
            </Typography>
            <List dense>
              {completeness.recommendations.map((rec, idx) => (
                <ListItem key={idx}>
                  <ListItemIcon>
                    <Info fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={rec} />
                </ListItem>
              ))}
            </List>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
```

##### [MODIFY] [RunCard.tsx](file:///home/deo/Documents/projects/md-datalake/frontend/src/components/browser/RunCard.tsx)

Add completeness badge to run cards:

```typescript
import { Chip } from '@mui/material';

// Add to RunCard component
{run.completeness_score && (
  <Chip 
    label={`${run.completeness_score}% Complete`}
    size="small"
    color={
      run.completeness_score >= 90 ? 'success' :
      run.completeness_score >= 60 ? 'warning' : 'error'
    }
  />
)}
```

---

#### 3. API Service

##### [MODIFY] [api.ts](file:///home/deo/Documents/projects/md-datalake/frontend/src/services/api.ts)

Add completeness API calls:

```typescript
export async function getRunCompleteness(runId: string): Promise<CompletenessInfo> {
  const response = await axios.get(`/api/v1/runs/${runId}/completeness`);
  return response.data;
}
```

---

## Verification Plan

### Automated Tests

1. **Backend Tests**
   ```bash
   # Test scenario detection
   pytest tests/unit/test_data_scenario.py -v
   
   # Test ingestion with different scenarios
   pytest tests/integration/test_ingestion_scenarios.py -v
   
   # Test API endpoints
   pytest tests/api/test_completeness_endpoints.py -v
   ```

2. **Database Migration**
   ```bash
   # Create migration
   poetry run alembic revision --autogenerate -m "add data completeness tracking"
   
   # Test upgrade
   poetry run alembic upgrade head
   
   # Test downgrade
   poetry run alembic downgrade -1
   ```

3. **Frontend Tests**
   ```bash
   cd frontend
   npm run test -- CompletenessIndicator
   ```

### Manual Verification

1. **Ingest test datasets** for each scenario:
   - Complete dataset (S1)
   - No log file (S2)
   - No molecule IDs (S3)
   - Trajectory only (S4)

2. **Verify database** contains correct completeness scores and flags

3. **Check UI** displays appropriate warnings and recommendations

4. **Test API** endpoints return correct completeness information
