"""Plotting endpoints for observables and time series data."""

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from mddatalake.db.session import get_db
from mddatalake.db.models import SimulationRun, Artifact
from mddatalake.core.enums import ArtifactType

router = APIRouter()


def parse_lammps_log(log_path: Path) -> dict[str, Any]:
    """
    Parse LAMMPS log file and extract thermo output.

    Returns dictionary with column names as keys and lists of values.
    """
    import re

    data = {}
    in_thermo = False
    headers = []

    with open(log_path, 'r') as f:
        for line in f:
            line = line.strip()

            # Detect start of thermo output
            if line.startswith('Step'):
                headers = line.split()
                in_thermo = True
                # Initialize data dict
                for header in headers:
                    data[header] = []
                continue

            # Detect end of thermo output
            if in_thermo and (line.startswith('Loop') or line == '' or line.startswith('---')):
                in_thermo = False
                continue

            # Parse data lines
            if in_thermo and headers:
                try:
                    values = line.split()
                    if len(values) == len(headers):
                        for header, value in zip(headers, values):
                            try:
                                # Try to convert to float
                                data[header].append(float(value))
                            except ValueError:
                                # Keep as string if conversion fails
                                data[header].append(value)
                except Exception:
                    continue

    return data


def extract_lammps_metadata(log_path: Path) -> dict[str, Any]:
    """
    Extract metadata from LAMMPS log file.

    Returns:
        - units: LAMMPS unit style (real, metal, lj, etc.)
        - timestep: Timestep in LAMMPS time units
        - first_step: First timestep number
        - last_step: Last timestep number
        - n_steps: Total number of steps
        - simulation_time: Total simulation time
    """
    import re

    metadata = {
        'units': None,
        'timestep': None,
        'first_step': None,
        'last_step': None,
        'n_steps': None,
        'simulation_time': None,
    }

    with open(log_path, 'r') as f:
        for line in f:
            line = line.strip()

            # Extract units (handle both "units real" and "Unit style    : real")
            if line.startswith('units'):
                parts = line.split()
                if len(parts) >= 2:
                    metadata['units'] = parts[1]
            elif 'Unit style' in line:
                parts = line.split(':')
                if len(parts) >= 2:
                    metadata['units'] = parts[1].strip()

            # Extract timestep (handle both "timestep 1.0" and "Time step     : 1")
            if line.startswith('timestep'):
                parts = line.split()
                if len(parts) >= 2:
                    try:
                        metadata['timestep'] = float(parts[1])
                    except ValueError:
                        pass
            elif 'Time step' in line:
                parts = line.split(':')
                if len(parts) >= 2:
                    try:
                        metadata['timestep'] = float(parts[1].strip())
                    except ValueError:
                        pass

    # Now parse thermo output to get first/last steps
    data = parse_lammps_log(log_path)

    if 'Step' in data and len(data['Step']) > 0:
        steps = data['Step']
        metadata['first_step'] = int(steps[0])
        metadata['last_step'] = int(steps[-1])
        metadata['n_steps'] = metadata['last_step'] - metadata['first_step']

        # Calculate simulation time if we have timestep
        if metadata['timestep'] is not None:
            # simulation_time in time units (depends on units style)
            metadata['simulation_time'] = metadata['n_steps'] * metadata['timestep']

    return metadata


def parse_gromacs_edr(edr_path: Path) -> dict[str, Any]:
    """
    Parse GROMACS energy file (.edr) and extract observables.

    Note: This is a placeholder. Full implementation would use gmxapi or pyedr.
    """
    # This would require gmxapi or parsing the binary .edr format
    # For now, return empty dict
    return {
        "Time": [],
        "message": "GROMACS .edr parsing not yet implemented. Upload will work, but plotting requires gmxapi."
    }


@router.get("/runs/{run_id}/plot-data")
async def get_plot_data(
    run_id: int,
    observables: list[str] = Query(None, description="List of observable names to include"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Get time series data for plotting observables.

    Extracts data from log files (LAMMPS) or energy files (GROMACS).

    Args:
        run_id: Simulation run ID
        observables: List of observable column names to include (e.g., ['Temp', 'Press'])
                    If None, returns all available columns

    Returns:
        Dictionary with:
        - columns: List of available column names
        - data: Dict mapping column names to lists of values
        - units: Dict mapping column names to units (if known)
        - engine: MD engine name (LAMMPS or GROMACS)
    """
    # Get run and check it exists (with eager loading of engine)
    stmt = select(SimulationRun).options(selectinload(SimulationRun.engine)).where(SimulationRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Get log file artifact
    stmt = select(Artifact).where(
        Artifact.simulation_run_id == run_id,
        Artifact.artifact_type == ArtifactType.LOG
    )
    result = await db.execute(stmt)
    log_artifact = result.scalar_one_or_none()

    if not log_artifact:
        raise HTTPException(
            status_code=404,
            detail="No log file found for this run. Upload a log file to enable plotting."
        )

    # Parse log file based on engine
    log_path = Path(log_artifact.file_path)

    if not log_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Log file not found at {log_path}"
        )

    # Determine engine from run metadata
    engine_name = run.engine.name if run.engine else "Unknown"

    if engine_name.upper() == "LAMMPS":
        data = parse_lammps_log(log_path)
    elif engine_name.upper() == "GROMACS":
        # For GROMACS, we'd need to parse .edr files
        # This is more complex and requires special libraries
        data = parse_gromacs_edr(log_path)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported engine: {engine_name}"
        )

    if not data:
        raise HTTPException(
            status_code=404,
            detail="No thermodynamic data found in log file"
        )

    # Filter to requested observables if specified
    if observables:
        filtered_data = {}
        for obs in observables:
            if obs in data:
                filtered_data[obs] = data[obs]
        data = filtered_data

    # Get units (LAMMPS standard units)
    units_map = {
        "Step": "timestep",
        "Temp": "K",
        "Press": "atm",
        "PotEng": "kcal/mol",
        "KinEng": "kcal/mol",
        "TotEng": "kcal/mol",
        "E_pair": "kcal/mol",
        "E_mol": "kcal/mol",
        "Volume": "Å³",
        "Density": "g/cm³",
        "Lx": "Å",
        "Ly": "Å",
        "Lz": "Å",
        "Pxx": "atm",
        "Pyy": "atm",
        "Pzz": "atm",
    }

    return {
        "columns": list(data.keys()),
        "data": data,
        "units": {col: units_map.get(col, "") for col in data.keys()},
        "engine": engine_name,
        "n_points": len(data.get("Step", [])) if "Step" in data else 0,
    }


@router.get("/runs/{run_id}/log-metadata")
async def get_log_metadata(
    run_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Extract metadata from log file (units, timestep, simulation time, etc.).

    Returns metadata that can be used to update the run record.
    """
    # Get run
    stmt = select(SimulationRun).options(selectinload(SimulationRun.engine)).where(SimulationRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Get log file
    stmt = select(Artifact).where(
        Artifact.simulation_run_id == run_id,
        Artifact.artifact_type == ArtifactType.LOG
    )
    result = await db.execute(stmt)
    log_artifact = result.scalar_one_or_none()

    if not log_artifact:
        raise HTTPException(
            status_code=404,
            detail="No log file found for this run"
        )

    log_path = Path(log_artifact.file_path)

    if not log_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Log file not found at {log_path}"
        )

    # Extract metadata
    engine_name = run.engine.name if run.engine else "Unknown"

    if engine_name.upper() == "LAMMPS":
        metadata = extract_lammps_metadata(log_path)
        return {
            "engine": "LAMMPS",
            "extracted_metadata": metadata,
            "can_update_run": True,
            "message": "Metadata extracted successfully from LAMMPS log file"
        }
    else:
        return {
            "engine": engine_name,
            "extracted_metadata": {},
            "can_update_run": False,
            "message": f"Metadata extraction not supported for {engine_name}"
        }


@router.post("/runs/{run_id}/update-from-log")
async def update_run_from_log(
    run_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Update run metadata (timestep, n_steps, total_time) from log file.

    Extracts metadata from log file and updates the simulation run record.
    """
    # Get run
    stmt = select(SimulationRun).options(selectinload(SimulationRun.engine)).where(SimulationRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Get log file
    stmt = select(Artifact).where(
        Artifact.simulation_run_id == run_id,
        Artifact.artifact_type == ArtifactType.LOG
    )
    result = await db.execute(stmt)
    log_artifact = result.scalar_one_or_none()

    if not log_artifact:
        raise HTTPException(
            status_code=404,
            detail="No log file found for this run"
        )

    log_path = Path(log_artifact.file_path)

    if not log_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Log file not found at {log_path}"
        )

    # Extract metadata
    engine_name = run.engine.name if run.engine else "Unknown"

    if engine_name.upper() != "LAMMPS":
        raise HTTPException(
            status_code=400,
            detail=f"Metadata extraction only supported for LAMMPS, not {engine_name}"
        )

    metadata = extract_lammps_metadata(log_path)

    # Update run record
    updated_fields = []

    if metadata['timestep'] is not None:
        run.timestep = metadata['timestep']
        updated_fields.append('timestep')

    if metadata['n_steps'] is not None:
        run.n_steps = metadata['n_steps']
        updated_fields.append('n_steps')

    if metadata['simulation_time'] is not None:
        # Convert from LAMMPS time units to nanoseconds based on units style
        # For 'real' units: timestep is in femtoseconds, so time is in fs
        # Need to convert to ns: fs * 1e-6 = ns
        if metadata['units'] == 'real':
            run.total_time = metadata['simulation_time'] * 1e-6  # fs to ns
            updated_fields.append('total_time')
        elif metadata['units'] == 'metal':
            run.total_time = metadata['simulation_time'] * 1e-3  # ps to ns
            updated_fields.append('total_time')
        # Add more unit conversions as needed

    # Commit changes
    await db.commit()
    await db.refresh(run)

    return {
        "run_id": run_id,
        "updated_fields": updated_fields,
        "metadata": metadata,
        "message": f"Successfully updated {len(updated_fields)} fields from log file"
    }


@router.get("/runs/{run_id}/available-observables")
async def get_available_observables(
    run_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Get list of available observables for plotting.

    Returns just the column names and metadata, not the full data.
    Useful for populating UI dropdowns before loading data.
    """
    # Get run (with eager loading of engine)
    stmt = select(SimulationRun).options(selectinload(SimulationRun.engine)).where(SimulationRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Get log file
    stmt = select(Artifact).where(
        Artifact.simulation_run_id == run_id,
        Artifact.artifact_type == ArtifactType.LOG
    )
    result = await db.execute(stmt)
    log_artifact = result.scalar_one_or_none()

    if not log_artifact:
        return {
            "available": False,
            "columns": [],
            "message": "No log file available for this run"
        }

    # Quick parse to get just column names
    log_path = Path(log_artifact.file_path)

    if not log_path.exists():
        return {
            "available": False,
            "columns": [],
            "message": "Log file not found"
        }

    engine_name = run.engine.name if run.engine else "Unknown"

    if engine_name.upper() == "LAMMPS":
        # Quick scan for column names
        columns = []
        with open(log_path, 'r') as f:
            for line in f:
                if line.strip().startswith('Step'):
                    columns = line.strip().split()
                    break

        return {
            "available": True,
            "columns": columns,
            "engine": "LAMMPS",
            "message": f"Found {len(columns)} observables in log file"
        }
    elif engine_name.upper() == "GROMACS":
        return {
            "available": False,
            "columns": [],
            "engine": "GROMACS",
            "message": "GROMACS .edr parsing not yet implemented"
        }
    else:
        return {
            "available": False,
            "columns": [],
            "message": f"Unsupported engine: {engine_name}"
        }
