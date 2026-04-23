
# Observable Plots Feature

## Overview

Interactive plotting of thermodynamic observables from MD simulation log files. Users can visualize temperature, pressure, energy, and other observables extracted from LAMMPS or GROMACS log files.

## Features

✅ **Interactive Plots** - Zoom, pan, and hover for detailed values
✅ **Multi-Observable Selection** - Plot multiple observables simultaneously
✅ **Auto-Detection** - Automatically detects available columns from log files
✅ **Real Units** - Displays proper units for each observable
✅ **LAMMPS Support** - Full support for LAMMPS thermo output
✅ **Time-Series Data** - Plot vs. timestep for temporal analysis

## Supported Observables

### LAMMPS Common Observables

From `thermo_style custom` output:

- **Step** - Timestep number (used as x-axis)
- **Temp** - Temperature (K)
- **Press** - Pressure (atm)
- **TotEng** - Total energy (kcal/mol)
- **PotEng** - Potential energy (kcal/mol)
- **KinEng** - Kinetic energy (kcal/mol)
- **E_pair** - Pair energy (kcal/mol)
- **E_mol** - Molecular energy (kcal/mol)
- **Volume** - System volume (Ų)
- **Density** - Density (g/cm³)
- **Lx, Ly, Lz** - Box dimensions (Å)
- **Pxx, Pyy, Pzz** - Pressure tensor components (atm)

### GROMACS Support

Currently placeholder - requires gmxapi or pyedr library for .edr file parsing.

## User Interface

### Location

Navigate to: **Run Detail Page → Observables Tab**

### Controls

1. **Observable Selector** - Multi-select dropdown with all available columns
2. **Refresh Button** - Reload plot data
3. **Interactive Plots** - One plot per selected observable

### Default Selection

Automatically selects common observables if available:
- Temperature (Temp)
- Pressure (Press)
- Total Energy (TotEng)
- Volume (Volume)

## API Endpoints

### Get Available Observables

**Endpoint**: `GET /api/v1/runs/{run_id}/available-observables`

**Description**: Quick check of what observables are available without loading full data.

**Response**:
```json
{
  "available": true,
  "columns": ["Step", "Temp", "Press", "TotEng", "PotEng", "Volume"],
  "engine": "LAMMPS",
  "message": "Found 6 observables in log file"
}
```

**Example**:
```bash
curl http://localhost:8080/api/v1/runs/1/available-observables
```

### Get Plot Data

**Endpoint**: `GET /api/v1/runs/{run_id}/plot-data`

**Query Parameters**:
- `observables` (optional): List of column names to include
  - If not specified, returns all columns
  - Always include "Step" for x-axis

**Response**:
```json
{
  "columns": ["Step", "Temp", "Press"],
  "data": {
    "Step": [0, 1000, 2000, 3000],
    "Temp": [300.1, 299.8, 300.2, 300.0],
    "Press": [1.01, 0.99, 1.02, 1.00]
  },
  "units": {
    "Step": "timestep",
    "Temp": "K",
    "Press": "atm"
  },
  "engine": "LAMMPS",
  "n_points": 4
}
```

**Example - All observables**:
```bash
curl "http://localhost:8080/api/v1/runs/1/plot-data"
```

**Example - Specific observables**:
```bash
curl "http://localhost:8080/api/v1/runs/1/plot-data?observables=Temp&observables=Press"
```

**Python Example**:
```python
import requests

# Get available observables
response = requests.get('http://localhost:8080/api/v1/runs/1/available-observables')
print(response.json())

# Get specific observables
response = requests.get(
    'http://localhost:8080/api/v1/runs/1/plot-data',
    params={'observables': ['Temp', 'Press', 'TotEng']}
)
data = response.json()

# Access data
steps = data['data']['Step']
temps = data['data']['Temp']
print(f"Temperature range: {min(temps):.2f} - {max(temps):.2f} {data['units']['Temp']}")
```

## Usage

### Web Interface

1. Navigate to run detail page
2. Click **Observables** tab
3. Select observables from dropdown (multi-select)
4. View interactive plots
5. Hover over plots to see exact values
6. Zoom in/out by dragging
7. Pan by holding and dragging
8. Reset view with home button

### API Access

```python
from mddatalake.api.client import APIClient

client = APIClient()

# Check what's available
available = client.get_available_observables(run_id=1)
print(f"Available: {available['columns']}")

# Get plot data
data = client.get_plot_data(run_id=1, observables=['Temp', 'Press'])

# Plot with matplotlib
import matplotlib.pyplot as plt

plt.figure(figsize=(12, 4))
plt.subplot(1, 2, 1)
plt.plot(data['data']['Step'], data['data']['Temp'])
plt.xlabel('Step')
plt.ylabel(f"Temperature ({data['units']['Temp']})")

plt.subplot(1, 2, 2)
plt.plot(data['data']['Step'], data['data']['Press'])
plt.xlabel('Step')
plt.ylabel(f"Pressure ({data['units']['Press']})")

plt.tight_layout()
plt.show()
```

## How It Works

### Backend Processing

1. **File Detection**: Finds log file artifact for the run
2. **Engine Detection**: Identifies LAMMPS or GROMACS
3. **Parsing**:
   - **LAMMPS**: Scans for `thermo_style` output blocks
   - **GROMACS**: Would parse .edr files (not yet implemented)
4. **Data Extraction**: Extracts column names and values
5. **Unit Assignment**: Maps column names to standard units
6. **Response**: Returns structured JSON data

### LAMMPS Log Parsing

The parser looks for patterns like:

```
Step Temp Press TotEng Volume
   0 300.0 1.01 -12345.6 27000.0
1000 299.8 0.99 -12340.2 27005.1
2000 300.2 1.02 -12338.9 26998.7
```

And extracts:
- Column headers from "Step Temp..." line
- Data values from subsequent lines
- Handles multiple thermo blocks
- Stops at "Loop time" or other markers

### Frontend Rendering

1. **Load Available Columns**: Quick API call to get column names
2. **Auto-Select Defaults**: Temperature, Pressure, Energy, Volume
3. **Load Plot Data**: Fetch full data when selection changes
4. **Render Plots**: Create one Plotly chart per observable
5. **Interactive Controls**: Zoom, pan, hover tooltips

## File Requirements

### For Plotting to Work

Your simulation must include a **log file** artifact:

**LAMMPS**:
- File type: LOG
- Contains `thermo_style` output
- Usually named `log.lammps` or `log.<something>`

**GROMACS** (future):
- File type: EDR or LOG
- Energy file (`.edr`) or log file (`.log`)

### If No Log File

You'll see:
> "No log file found for this run. Upload a log file to enable plotting."

**Solution**: Re-upload the run with log file included, or add log file to existing run (future feature).

## Configuration

### Units Mapping

Edit `src/mddatalake/api/routes/plots.py` to customize units:

```python
units_map = {
    "Step": "timestep",
    "Temp": "K",  # Change to "°C" if needed
    "Press": "atm",  # Change to "bar" or "Pa"
    # Add custom mappings here
}
```

### Default Observables

Edit `frontend/src/components/properties/ObservablePlots.tsx`:

```typescript
// Auto-select these if available
const defaultColumns = ['Temp', 'Press', 'TotEng', 'Volume'];
```

## Troubleshooting

### No observables available

**Cause**: No log file uploaded

**Solution**: Upload run with log file included

### "Failed to load plot data"

**Cause**: Log file format not recognized or corrupt

**Solution**:
- Check log file contains `thermo_style` output
- Verify file is not empty
- Check backend logs for parsing errors

### Plots are empty

**Cause**: Selected observable not in log file

**Solution**: Check available columns dropdown, select different observable

### Wrong units displayed

**Cause**: Unit mapping not configured for this column

**Solution**: Add unit mapping in `plots.py` (see Configuration section)

### GROMACS not working

**Cause**: GROMACS .edr parsing not implemented

**Solution**: Requires gmxapi or pyedr library - future enhancement

## Performance

### Large Data Sets

For log files with millions of data points:
- First 10,000 points load quickly (< 1 second)
- Full data sets may take longer
- Consider downsampling for very large files

### Optimization Tips

1. **Select fewer observables** - Load only what you need
2. **Filter time range** - Future feature to plot specific time windows
3. **Downsample** - Future feature to reduce points for faster rendering

## Future Enhancements

### Phase 2
- ✨ GROMACS .edr file parsing (requires gmxapi)
- ✨ Time range selection (plot specific time windows)
- ✨ Downsampling for large datasets
- ✨ Export plot as image (PNG, SVG)
- ✨ Export data as CSV
- ✨ Statistical analysis (mean, std, autocorrelation)

### Phase 3
- ✨ Multi-run comparison plots
- ✨ Derivative plots (dT/dt, dP/dt)
- ✨ Running averages and smoothing
- ✨ Custom units conversion
- ✨ Plot templates and saved views

## Examples

### Example 1: Temperature Equilibration Check

**Goal**: Verify NVT equilibration reached target temperature

**Steps**:
1. Navigate to run detail page
2. Click Observables tab
3. Select "Temp" from dropdown
4. Examine temperature plot
5. Check if temperature stabilizes around target

**Expected**: Temperature should fluctuate around 300K (or your target)

### Example 2: Pressure Coupling Check

**Goal**: Verify NPT barostat is working

**Steps**:
1. Select "Press" from dropdown
2. Examine pressure plot
3. Check mean pressure ~1 atm

**Expected**: Pressure oscillates around 1 atm with some variance

### Example 3: Energy Conservation

**Goal**: Verify NVE energy conservation

**Steps**:
1. Select "TotEng" from dropdown
2. Examine total energy plot
3. Look for drift

**Expected**: Total energy should be constant (small fluctuations OK)

### Example 4: Volume Equilibration

**Goal**: Check box volume equilibration in NPT

**Steps**:
1. Select "Volume" from dropdown
2. Examine volume vs. time
3. Check for stabilization

**Expected**: Volume should reach steady state

## Architecture

### Backend

**Files**:
- `src/mddatalake/api/routes/plots.py` - Plot data endpoints
- `src/mddatalake/parsers/lammps/parser.py` - LAMMPS log parsing (existing)

**Flow**:
```
Client Request
  ↓
GET /runs/{id}/plot-data
  ↓
Find log file artifact
  ↓
Parse log file (LAMMPS or GROMACS)
  ↓
Extract time series data
  ↓
Return JSON with data + units
```

### Frontend

**Files**:
- `frontend/src/components/properties/ObservablePlots.tsx` - Plotting component
- `frontend/src/services/api.ts` - API client methods

**Flow**:
```
Component Mount
  ↓
Load available observables
  ↓
Auto-select defaults
  ↓
Load plot data
  ↓
Render Plotly charts
  ↓
User selects different observables
  ↓
Reload data and re-render
```

## Related Documentation

- [Run Detail Page](../frontend/src/pages/RunDetailPage.tsx)
- [API Routes](../src/mddatalake/api/routes/plots.py)
- [LAMMPS Parser](../src/mddatalake/parsers/lammps/parser.py)
