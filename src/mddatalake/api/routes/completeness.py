"""API routes for data completeness and quality information."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from mddatalake.db.session import get_db
from mddatalake.db.models import SimulationRun

router = APIRouter()


class DataQualityFlags(BaseModel):
    """Data quality flags."""

    has_trajectory: bool
    has_topology: bool
    has_log_file: bool
    has_input_script: bool
    has_molecule_ids: bool
    has_bonds_angles: bool
    scenario_type: str


class CompletenessInfo(BaseModel):
    """Completeness information for a simulation run."""

    run_id: int
    run_name: str
    completeness_score: int | None
    missing_data: list[str]
    data_quality_flags: dict
    warnings: list[str] = []
    recommendations: list[str] = []


class CompletenessStatistics(BaseModel):
    """Aggregate completeness statistics."""

    total_runs: int
    complete_runs: int  # score == 100
    incomplete_runs: int  # score < 100
    average_score: float
    score_distribution: dict[str, int]  # bins: "0-20", "20-40", etc.


@router.get("/runs/{run_id}/completeness", response_model=CompletenessInfo)
async def get_run_completeness(
    run_id: int,
    db: AsyncSession = Depends(get_db),
) -> CompletenessInfo:
    """Get completeness information for a specific simulation run.

    Args:
        run_id: Simulation run ID
        db: Database session

    Returns:
        CompletenessInfo with score, missing data, and quality flags

    Raises:
        HTTPException: If run not found
    """
    result = await db.execute(select(SimulationRun).where(SimulationRun.id == run_id))
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail=f"Simulation run {run_id} not found")

    # Generate warnings and recommendations based on missing data
    warnings = _generate_warnings(run.missing_data or [])
    recommendations = _generate_recommendations(run.missing_data or [])

    return CompletenessInfo(
        run_id=run.id,
        run_name=run.run_name,
        completeness_score=run.completeness_score,
        missing_data=run.missing_data or [],
        data_quality_flags=run.data_quality_flags or {},
        warnings=warnings,
        recommendations=recommendations,
    )


@router.get("/runs/incomplete", response_model=list[CompletenessInfo])
async def list_incomplete_runs(
    max_score: int = Query(90, ge=0, le=100, description="Maximum completeness score"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of results"),
    db: AsyncSession = Depends(get_db),
) -> list[CompletenessInfo]:
    """List simulation runs with incomplete data.

    Args:
        max_score: Maximum completeness score (default 90)
        limit: Maximum number of results (default 50)
        db: Database session

    Returns:
        List of CompletenessInfo for incomplete runs
    """
    result = await db.execute(
        select(SimulationRun)
        .where(SimulationRun.completeness_score <= max_score)
        .order_by(SimulationRun.completeness_score)
        .limit(limit)
    )
    runs = result.scalars().all()

    return [
        CompletenessInfo(
            run_id=run.id,
            run_name=run.run_name,
            completeness_score=run.completeness_score,
            missing_data=run.missing_data or [],
            data_quality_flags=run.data_quality_flags or {},
            warnings=_generate_warnings(run.missing_data or []),
            recommendations=_generate_recommendations(run.missing_data or []),
        )
        for run in runs
    ]


@router.get("/runs/statistics/completeness", response_model=CompletenessStatistics)
async def get_completeness_statistics(
    db: AsyncSession = Depends(get_db),
) -> CompletenessStatistics:
    """Get aggregate completeness statistics across all runs.

    Args:
        db: Database session

    Returns:
        CompletenessStatistics with distribution and averages
    """
    # Total runs
    total_result = await db.execute(select(func.count()).select_from(SimulationRun))
    total_runs = total_result.scalar_one()

    # Complete runs (score == 100)
    complete_result = await db.execute(
        select(func.count()).select_from(SimulationRun).where(SimulationRun.completeness_score == 100)
    )
    complete_runs = complete_result.scalar_one()

    # Incomplete runs
    incomplete_runs = total_runs - complete_runs

    # Average score (excluding NULL)
    avg_result = await db.execute(
        select(func.avg(SimulationRun.completeness_score)).where(
            SimulationRun.completeness_score.isnot(None)
        )
    )
    average_score = avg_result.scalar_one() or 0.0

    # Score distribution (bins: 0-20, 20-40, 40-60, 60-80, 80-100)
    score_distribution = {}
    bins = [(0, 20), (20, 40), (40, 60), (60, 80), (80, 100)]

    for low, high in bins:
        if high == 100:
            # Include 100 in the last bin
            count_result = await db.execute(
                select(func.count())
                .select_from(SimulationRun)
                .where(
                    SimulationRun.completeness_score >= low, SimulationRun.completeness_score <= high
                )
            )
        else:
            count_result = await db.execute(
                select(func.count())
                .select_from(SimulationRun)
                .where(SimulationRun.completeness_score >= low, SimulationRun.completeness_score < high)
            )
        count = count_result.scalar_one()
        score_distribution[f"{low}-{high}"] = count

    return CompletenessStatistics(
        total_runs=total_runs,
        complete_runs=complete_runs,
        incomplete_runs=incomplete_runs,
        average_score=float(average_score),
        score_distribution=score_distribution,
    )


def _generate_warnings(missing_data: list[str]) -> list[str]:
    """Generate warnings based on missing data."""
    warnings = []

    warning_map = {
        "trajectory": "No trajectory file found - visualization and analysis not possible",
        "topology": "No topology file found - structural analysis limited",
        "log_file": "No log file found - thermodynamic observables unavailable",
        "input_script": "No input script found - simulation parameters may be incomplete",
        "molecule_ids": "Trajectory lacks molecule IDs - molecular analysis disabled",
        "bonds_angles": "Topology lacks bond/angle data - connectivity analysis limited",
    }

    for item in missing_data:
        if item in warning_map:
            warnings.append(warning_map[item])

    return warnings


def _generate_recommendations(missing_data: list[str]) -> list[str]:
    """Generate recommendations for improving data completeness."""
    recommendations = []

    recommendation_map = {
        "trajectory": "Upload trajectory file to enable visualization",
        "topology": "Upload topology file to enable structural analysis",
        "log_file": "Upload log file to access thermodynamic data",
        "input_script": "Upload input script for complete reproducibility",
        "molecule_ids": "Re-run simulation with molecule ID output enabled",
        "bonds_angles": "Include bond/angle definitions in topology file",
    }

    for item in missing_data:
        if item in recommendation_map:
            recommendations.append(recommendation_map[item])

    return recommendations
