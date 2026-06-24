from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from datetime import date

from database import get_db
from models import Project, Turbine, Parameter

router = APIRouter(tags=["turbines"])


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None


class TurbineCreate(BaseModel):
    project_id: int
    name: str
    type: str | None = None
    site: str | None = None


@router.get("/projects")
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project))
    return result.scalars().all()


@router.post("/projects", status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(name=body.name, description=body.description, created_at=date.today())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404)
    await db.delete(project)
    await db.commit()


@router.get("/turbines")
async def list_turbines(project_id: int | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Turbine)
    if project_id is not None:
        q = q.where(Turbine.project_id == project_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/turbines", status_code=201)
async def create_turbine(body: TurbineCreate, db: AsyncSession = Depends(get_db)):
    turbine = Turbine(**body.model_dump(), imported_at=date.today())
    db.add(turbine)
    await db.commit()
    await db.refresh(turbine)
    return turbine


@router.delete("/turbines/{turbine_id}", status_code=204)
async def delete_turbine(turbine_id: int, db: AsyncSession = Depends(get_db)):
    turbine = await db.get(Turbine, turbine_id)
    if not turbine:
        raise HTTPException(404)
    await db.delete(turbine)
    await db.commit()


@router.get("/turbines/list")
async def list_turbines_with_stats(db: AsyncSession = Depends(get_db)):
    q = (
        select(
            Turbine,
            Project.name.label("project_name"),
            func.count(Parameter.id).label("param_count"),
        )
        .outerjoin(Project, Turbine.project_id == Project.id)
        .outerjoin(Parameter, Parameter.turbine_id == Turbine.id)
        .group_by(Turbine.id)
        .order_by(Project.name, Turbine.name)
    )
    rows = (await db.execute(q)).all()
    return [
        {
            "id": r.Turbine.id,
            "name": r.Turbine.name,
            "type": r.Turbine.type,
            "site": r.Turbine.site,
            "source_file": r.Turbine.source_file,
            "file_date": r.Turbine.file_date,
            "imported_at": str(r.Turbine.imported_at) if r.Turbine.imported_at else None,
            "project_id": r.Turbine.project_id,
            "project_name": r.project_name or "—",
            "param_count": r.param_count,
        }
        for r in rows
    ]


@router.patch("/projects/{project_id}")
async def rename_project(project_id: int, body: dict, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404)
    if "name" in body:
        project.name = body["name"]
    await db.commit()
    await db.refresh(project)
    return project
