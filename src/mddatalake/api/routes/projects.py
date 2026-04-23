"""Project CRUD endpoints."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from mddatalake.auth.dependencies import get_current_user, require_contributor
from mddatalake.db.models.project import Project
from mddatalake.db.models.project_collaborator import ProjectCollaborator
from mddatalake.db.models.simulation_run import SimulationRun
from mddatalake.db.models.user import User
from mddatalake.db.session import get_db

router = APIRouter(prefix="/projects", tags=["Projects"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    pi_name: str | None = None
    institution: str | None = None
    grant_number: str | None = None
    funding_source: str | None = None
    keywords: list[str] | None = None
    is_public: bool = False


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    pi_name: str | None = None
    institution: str | None = None
    grant_number: str | None = None
    funding_source: str | None = None
    keywords: list[str] | None = None
    is_public: bool | None = None


class CollaboratorAdd(BaseModel):
    user_id: int
    role: str = "viewer"


def _project_dict(p: Project, run_count: int = 0) -> dict[str, Any]:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "pi_name": p.pi_name,
        "institution": p.institution,
        "grant_number": p.grant_number,
        "funding_source": p.funding_source,
        "keywords": p.keywords or [],
        "is_public": p.is_public,
        "created_by_id": p.created_by_id,
        "created_by_name": p.created_by.full_name or p.created_by.email if p.created_by else None,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        "run_count": run_count,
        "collaborators": [
            {
                "user_id": c.user_id,
                "email": c.user.email,
                "full_name": c.user.full_name,
                "role": c.role,
            }
            for c in (p.collaborators or [])
        ],
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_projects(
    search: str | None = Query(None),
    is_public: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Project)
        .options(
            selectinload(Project.created_by),
            selectinload(Project.collaborators).selectinload(ProjectCollaborator.user),
        )
        .order_by(Project.name)
    )
    if search:
        stmt = stmt.where(Project.name.ilike(f"%{search}%"))
    if is_public is not None:
        stmt = stmt.where(Project.is_public == is_public)

    result = await db.execute(stmt)
    projects = result.scalars().all()

    # Count runs per project in one query
    count_stmt = select(SimulationRun.project_id, func.count().label("n")).group_by(
        SimulationRun.project_id
    )
    count_result = await db.execute(count_stmt)
    run_counts = {row.project_id: row.n for row in count_result}

    return [_project_dict(p, run_counts.get(p.id, 0)) for p in projects]


@router.post("", status_code=201)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_contributor),
):
    existing = await db.execute(select(Project).where(Project.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A project with that name already exists.")

    project = Project(
        name=body.name,
        description=body.description,
        pi_name=body.pi_name,
        institution=body.institution,
        grant_number=body.grant_number,
        funding_source=body.funding_source,
        keywords=body.keywords,
        is_public=body.is_public,
        created_by_id=current_user.id,
    )
    db.add(project)
    await db.flush()

    # Creator is automatically a collaborator with admin role
    collab = ProjectCollaborator(project_id=project.id, user_id=current_user.id, role="admin")
    db.add(collab)
    await db.commit()
    await db.refresh(project)

    # Reload with relationships
    stmt = (
        select(Project)
        .where(Project.id == project.id)
        .options(
            selectinload(Project.created_by),
            selectinload(Project.collaborators).selectinload(ProjectCollaborator.user),
        )
    )
    result = await db.execute(stmt)
    project = result.scalar_one()
    return _project_dict(project, 0)


@router.get("/{project_id}")
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Project)
        .where(Project.id == project_id)
        .options(
            selectinload(Project.created_by),
            selectinload(Project.collaborators).selectinload(ProjectCollaborator.user),
        )
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    count_result = await db.execute(
        select(func.count()).where(SimulationRun.project_id == project_id)
    )
    run_count = count_result.scalar() or 0
    return _project_dict(project, run_count)


@router.patch("/{project_id}")
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    is_owner = project.created_by_id == current_user.id
    is_admin = current_user.role == "admin"
    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="Only the project owner or an admin can edit.")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(project, field, value)
    project.updated_at = datetime.utcnow()
    await db.commit()

    stmt = (
        select(Project)
        .where(Project.id == project_id)
        .options(
            selectinload(Project.created_by),
            selectinload(Project.collaborators).selectinload(ProjectCollaborator.user),
        )
    )
    result = await db.execute(stmt)
    project = result.scalar_one()
    count_result = await db.execute(
        select(func.count()).where(SimulationRun.project_id == project_id)
    )
    run_count = count_result.scalar() or 0
    return _project_dict(project, run_count)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete projects.")

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/collaborators", status_code=201)
async def add_collaborator(
    project_id: int,
    body: CollaboratorAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    is_owner = project.created_by_id == current_user.id
    is_admin = current_user.role == "admin"
    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="Only the project owner or an admin can manage collaborators.")

    user_result = await db.execute(select(User).where(User.id == body.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    existing = await db.execute(
        select(ProjectCollaborator).where(
            ProjectCollaborator.project_id == project_id,
            ProjectCollaborator.user_id == body.user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User is already a collaborator.")

    collab = ProjectCollaborator(project_id=project_id, user_id=body.user_id, role=body.role)
    db.add(collab)
    await db.commit()
    return {"project_id": project_id, "user_id": body.user_id, "role": body.role}


@router.delete("/{project_id}/collaborators/{user_id}", status_code=204)
async def remove_collaborator(
    project_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    is_owner = project.created_by_id == current_user.id
    is_admin = current_user.role == "admin"
    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="Only the project owner or an admin can manage collaborators.")

    collab_result = await db.execute(
        select(ProjectCollaborator).where(
            ProjectCollaborator.project_id == project_id,
            ProjectCollaborator.user_id == user_id,
        )
    )
    collab = collab_result.scalar_one_or_none()
    if not collab:
        raise HTTPException(status_code=404, detail="Collaborator not found.")

    await db.delete(collab)
    await db.commit()
