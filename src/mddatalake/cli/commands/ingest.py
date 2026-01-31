"""Ingest command."""

from pathlib import Path

import typer
from rich.console import Console

from mddatalake.core.config import settings
from mddatalake.db.session import AsyncSessionLocal
from mddatalake.ingestion import IngestionService

console = Console()


async def ingest_command(
    directory: Path,
    project_name: str,
    run_name: str | None = None,
    description: str | None = None,
):
    """Ingest a simulation directory."""
    console.print(f"[bold]Ingesting simulation from:[/bold] {directory}")

    try:
        async with AsyncSessionLocal() as session:
            service = IngestionService(session)

            run_id = await service.ingest(
                directory=directory,
                project_name=project_name,
                run_name=run_name,
                description=description,
            )

            console.print(f"[green]✓ Successfully ingested run {run_id}[/green]")

    except Exception as e:
        console.print(f"[red]✗ Ingestion failed: {e}[/red]")
        raise typer.Exit(1)
