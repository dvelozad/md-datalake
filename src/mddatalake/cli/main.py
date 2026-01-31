"""Main CLI application using Typer."""

import asyncio
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

from mddatalake.__version__ import __version__

app = typer.Typer(
    name="mdrepo",
    help="MD Repo - Molecular Dynamics Simulation Database",
    add_completion=False,
)

console = Console()


@app.command()
def version():
    """Show version information."""
    console.print(f"MD Repo v{__version__}")


@app.command()
def ingest(
    directory: Path = typer.Argument(..., help="Directory containing simulation files"),
    project: str = typer.Option(..., "--project", "-p", help="Project name"),
    name: str = typer.Option(None, "--name", "-n", help="Run name (defaults to directory name)"),
    description: str = typer.Option(None, "--description", "-d", help="Run description"),
):
    """
    Ingest a simulation directory into the database.

    Example:
        mdrepo ingest /path/to/run --project my_project
    """
    from mddatalake.cli.commands.ingest import ingest_command

    asyncio.run(
        ingest_command(
            directory=directory, project_name=project, run_name=name, description=description
        )
    )


@app.command()
def query(
    entity: str = typer.Argument("runs", help="Entity to query (runs, projects, systems)"),
    ensemble: str = typer.Option(None, "--ensemble", "-e", help="Filter by ensemble"),
    min_temp: float = typer.Option(None, "--min-temperature", help="Minimum temperature (K)"),
    max_temp: float = typer.Option(None, "--max-temperature", help="Maximum temperature (K)"),
    project: str = typer.Option(None, "--project", "-p", help="Filter by project name"),
    limit: int = typer.Option(20, "--limit", "-l", help="Maximum results to show"),
):
    """
    Query the database.

    Example:
        mdrepo query runs --ensemble NPT --min-temperature 296 --max-temperature 300
    """
    from mddatalake.cli.commands.query import query_command

    asyncio.run(
        query_command(
            entity=entity,
            ensemble=ensemble,
            min_temp=min_temp,
            max_temp=max_temp,
            project=project,
            limit=limit,
        )
    )


if __name__ == "__main__":
    app()
