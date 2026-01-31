"""Query command."""

from rich.console import Console
from rich.table import Table
from sqlalchemy import select

from mddatalake.core.enums import EnsembleType
from mddatalake.db.models import SimulationRun
from mddatalake.db.session import AsyncSessionLocal

console = Console()


async def query_command(
    entity: str,
    ensemble: str | None = None,
    min_temp: float | None = None,
    max_temp: float | None = None,
    project: str | None = None,
    limit: int = 20,
):
    """Query the database."""
    if entity != "runs":
        console.print(f"[red]Entity '{entity}' not yet supported[/red]")
        return

    async with AsyncSessionLocal() as session:
        # Build query
        stmt = select(SimulationRun)

        if ensemble:
            try:
                ensemble_enum = EnsembleType(ensemble.upper())
                stmt = stmt.where(SimulationRun.ensemble == ensemble_enum)
            except ValueError:
                console.print(f"[red]Invalid ensemble: {ensemble}[/red]")
                return

        if min_temp is not None:
            stmt = stmt.where(SimulationRun.temperature_target >= min_temp)

        if max_temp is not None:
            stmt = stmt.where(SimulationRun.temperature_target <= max_temp)

        stmt = stmt.limit(limit)

        # Execute query
        result = await session.execute(stmt)
        runs = result.scalars().all()

        # Display results
        if not runs:
            console.print("[yellow]No runs found[/yellow]")
            return

        table = Table(title=f"Simulation Runs (showing {len(runs)})")
        table.add_column("ID", style="cyan")
        table.add_column("Run Name", style="green")
        table.add_column("Ensemble")
        table.add_column("T (K)")
        table.add_column("P (bar)")
        table.add_column("Steps")

        for run in runs:
            table.add_row(
                str(run.id),
                run.run_name,
                run.ensemble.value,
                f"{run.temperature_target:.1f}" if run.temperature_target else "—",
                f"{run.pressure_target:.1f}" if run.pressure_target else "—",
                str(run.n_steps) if run.n_steps else "—",
            )

        console.print(table)
