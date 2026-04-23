# MD DataLake - Data Scenario Handling Feature

## Quick Reference

This document provides a quick overview of the data scenario handling feature implementation. For detailed information, see the linked documents.

## 📚 Documentation Files

1. **[DATA_SCENARIOS_REQUIREMENTS.md](./DATA_SCENARIOS_REQUIREMENTS.md)** - Comprehensive requirements analysis
   - 6 data scenarios (S1-S6)
   - Detailed capabilities and limitations for each scenario
   - Implementation strategies for handling incomplete data
   - Database schema extensions
   - UI/UX requirements

2. **[FEATURE_TASKS.md](./FEATURE_TASKS.md)** - Task checklist
   - Phase 1: Detection & Flagging
   - Phase 2: Basic Inference
   - Phase 3: Advanced Handling
   - Phase 4: User Guidance
   - Additional features

3. **[IMPLEMENTATION_PLAN_PHASE1.md](./IMPLEMENTATION_PLAN_PHASE1.md)** - Detailed implementation plan
   - Database migrations
   - Backend service modifications
   - API endpoints
   - Frontend components
   - Testing strategy

## 🎯 Overview

### Problem Statement

MD simulations often have incomplete data:
- Missing log files (no thermodynamic data)
- No molecule IDs in trajectories
- Trajectory-only files
- Missing topology files

### Solution

Implement a **graceful degradation** system that:
1. **Detects** what data is available
2. **Scores** completeness (0-100%)
3. **Infers** missing information when possible
4. **Communicates** limitations clearly to users

## 📊 Data Scenarios

| Scenario | Description | Score | Common? |
|----------|-------------|-------|---------|
| **S1** | Complete dataset | 100% | ✅ Ideal |
| **S2** | No log file | 80% | ⚠️ Common |
| **S3** | No molecule IDs | 85% | ⚠️ Common |
| **S4** | Trajectory only | 40% | ❌ Minimal |
| **S5** | No topology | 75% | ⚠️ Common |
| **S6** | Minimal (traj+input) | 50% | ⚠️ Acceptable |

## 🏗️ Architecture

```
Ingestion Pipeline
    ↓
Scenario Detection
    ↓
Completeness Scoring
    ↓
Database Storage
    ↓
API Endpoints
    ↓
Frontend Display
```

## 🔑 Key Components

### Backend

1. **DataScenario Class** (`src/mddatalake/core/data_scenario.py`)
   - Detects available files
   - Classifies scenario type
   - Calculates completeness score
   - Generates warnings

2. **Database Schema** (new columns)
   - `simulation_runs.completeness_score` (INTEGER)
   - `simulation_runs.missing_data` (JSONB)
   - `simulation_runs.data_quality_flags` (JSONB)
   - `artifacts.has_molecule_ids` (BOOLEAN)
   - `artifacts.has_bonds` (BOOLEAN)

3. **API Endpoints**
   - `GET /api/v1/runs/{id}/completeness` - Get completeness info
   - Returns score, missing data, warnings, recommendations

### Frontend

1. **CompletenessIndicator Component**
   - Progress bar showing score
   - List of missing data
   - Warnings and recommendations
   - Color-coded (green/yellow/red)

2. **RunCard Enhancement**
   - Completeness badge on each run card
   - Quick visual indicator

## 🚀 Implementation Phases

### Phase 1: Detection & Flagging (Current)
- ✅ Detect scenario during ingestion
- ✅ Store completeness info in database
- ✅ Display warnings in UI
- ✅ API endpoints for querying

### Phase 2: Basic Inference
- Infer bonds from distances
- Infer molecule IDs from topology
- UI button to trigger inference

### Phase 3: Advanced Handling
- Heuristic molecule assignment (water, etc.)
- Temperature from velocities
- Topology generation

### Phase 4: User Guidance
- Recommendation engine
- Upload additional files
- Data quality dashboard

## 📝 Example Usage

### Backend (Ingestion)

```python
# Automatic scenario detection
scenario = DataScenario.detect(directory, "LAMMPS")

# Scenario info stored in database
run.completeness_score = 80
run.missing_data = ["log_file"]
run.data_quality_flags = {
    "has_log": False,
    "has_topology": True,
    "scenario_type": "no_log"
}
```

### Frontend (Display)

```typescript
// Fetch completeness info
const info = await getRunCompleteness(runId);

// Display indicator
<CompletenessIndicator completeness={info} />

// Shows:
// - 80% Complete (yellow)
// - Missing: log_file
// - Warning: "No thermodynamic plots available"
// - Recommendation: "Upload log file to enable analysis"
```

## 🧪 Testing

### Test Fixtures Needed

Create test datasets for each scenario:
- `tests/fixtures/complete_lammps_water/` (S1)
- `tests/fixtures/lammps_no_log/` (S2)
- `tests/fixtures/gromacs_atomic/` (S3)
- `tests/fixtures/trajectory_only/` (S4)
- `tests/fixtures/lammps_no_topology/` (S5)
- `tests/fixtures/minimal_data/` (S6)

### Test Commands

```bash
# Backend tests
pytest tests/unit/test_data_scenario.py -v
pytest tests/integration/test_ingestion_scenarios.py -v

# Database migration
poetry run alembic revision --autogenerate -m "add completeness tracking"
poetry run alembic upgrade head

# Frontend tests
cd frontend && npm test -- CompletenessIndicator
```

## 📋 Checklist for Claude Code Agent

### Step 1: Database Migration
- [ ] Create migration file
- [ ] Add columns to `simulation_runs`
- [ ] Add columns to `artifacts`
- [ ] Create index on `completeness_score`
- [ ] Test upgrade/downgrade

### Step 2: Backend Core
- [ ] Create `data_scenario.py`
- [ ] Implement `DataScenario` class
- [ ] Implement scenario detection logic
- [ ] Implement completeness scoring
- [ ] Add unit tests

### Step 3: Ingestion Service
- [ ] Modify `service.py`
- [ ] Add scenario detection call
- [ ] Store completeness data
- [ ] Add logging for warnings

### Step 4: API Endpoints
- [ ] Create `completeness.py` router
- [ ] Implement GET `/completeness` endpoint
- [ ] Add to main app
- [ ] Add API tests

### Step 5: Frontend Types
- [ ] Add TypeScript interfaces
- [ ] Update `SimulationRun` type

### Step 6: Frontend Components
- [ ] Create `CompletenessIndicator.tsx`
- [ ] Modify `RunCard.tsx`
- [ ] Add API service function
- [ ] Add component tests

### Step 7: Integration Testing
- [ ] Create test fixtures
- [ ] Test each scenario
- [ ] Verify database storage
- [ ] Verify UI display

## 🎓 Key Principles

1. **Graceful Degradation** - System works with any data combination
2. **Clear Communication** - Users always know what's missing
3. **Smart Inference** - Fill gaps automatically when possible
4. **Transparency** - Mark inferred vs. provided data
5. **Extensibility** - Easy to add new scenarios/inference methods

## 📞 Next Steps

1. Review this documentation
2. Start with Phase 1 implementation
3. Create database migration
4. Implement backend detection
5. Add frontend display
6. Test with real data

---

**For detailed implementation instructions, see [IMPLEMENTATION_PLAN_PHASE1.md](./IMPLEMENTATION_PLAN_PHASE1.md)**
