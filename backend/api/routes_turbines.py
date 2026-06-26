from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
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
    # Explicit cascade
    await db.execute(text(
        "DELETE FROM parameters WHERE turbine_id IN (SELECT id FROM turbines WHERE project_id = :id)"
    ), {"id": project_id})
    await db.execute(text(
        "DELETE FROM curve_points WHERE curve_id IN "
        "(SELECT c.id FROM curves c JOIN turbines t ON c.turbine_id=t.id WHERE t.project_id = :id)"
    ), {"id": project_id})
    await db.execute(text(
        "DELETE FROM curves WHERE turbine_id IN (SELECT id FROM turbines WHERE project_id = :id)"
    ), {"id": project_id})
    await db.execute(text("DELETE FROM turbines WHERE project_id = :id"), {"id": project_id})
    await db.delete(project)
    await db.commit()


@router.delete("/db/reset", status_code=200)
async def reset_db(db: AsyncSession = Depends(get_db)):
    """Delete ALL data — full DB wipe."""
    await db.execute(text("DELETE FROM parameters"))
    await db.execute(text("DELETE FROM curve_points"))
    await db.execute(text("DELETE FROM curves"))
    await db.execute(text("DELETE FROM turbines"))
    await db.execute(text("DELETE FROM projects"))
    await db.execute(text("VACUUM"))
    await db.commit()
    return {"status": "ok"}


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
    # Explicit cascade — SQLite FK not enabled by default
    await db.execute(text("DELETE FROM parameters WHERE turbine_id = :id"), {"id": turbine_id})
    await db.execute(text(
        "DELETE FROM curve_points WHERE curve_id IN (SELECT id FROM curves WHERE turbine_id = :id)"
    ), {"id": turbine_id})
    await db.execute(text("DELETE FROM curves WHERE turbine_id = :id"), {"id": turbine_id})
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


@router.get("/db/kks-prefixes")
async def kks_prefix_stats(db: AsyncSession = Depends(get_db)):
    """Return KKS prefix distribution per turbine for diagnostics."""
    import re
    turbines_r = await db.execute(select(Turbine))
    result = []
    num_pfx = re.compile(r'^(\d+)')
    for t in turbines_r.scalars().all():
        r = await db.execute(
            text("SELECT kks FROM parameters WHERE turbine_id = :tid"),
            {"tid": t.id}
        )
        counts: dict[str, int] = {}
        for (kks,) in r.fetchall():
            m = num_pfx.match(kks or "")
            pfx = m.group(1) if m else ("other" if kks else "empty")
            counts[pfx] = counts.get(pfx, 0) + 1
        result.append({
            "turbine_id":   t.id,
            "turbine_name": t.name,
            "total":        sum(counts.values()),
            "prefixes":     sorted([{"prefix": k, "count": v} for k, v in counts.items()], key=lambda x: -x["count"]),
        })
    return result


@router.delete("/turbines/{turbine_id}/params")
async def purge_params_by_prefix(
    turbine_id: int,
    keep_prefix: str = Query(..., description="Keep only params whose kks starts with this prefix"),
    db: AsyncSession = Depends(get_db),
):
    """Delete all parameters of a turbine that don't match the given KKS prefix."""
    turbine = await db.get(Turbine, turbine_id)
    if not turbine:
        raise HTTPException(404)
    r = await db.execute(
        text("DELETE FROM parameters WHERE turbine_id = :tid AND kks NOT LIKE :pfx"),
        {"tid": turbine_id, "pfx": keep_prefix.upper() + "%"},
    )
    await db.commit()
    return {"deleted": r.rowcount, "kept_prefix": keep_prefix.upper()}


@router.post("/db/cleanup")
async def cleanup_db(db: AsyncSession = Depends(get_db)):
    """Delete all orphaned rows left after project/turbine deletion."""
    r1 = await db.execute(text(
        "DELETE FROM parameters WHERE turbine_id NOT IN (SELECT id FROM turbines)"
    ))
    r2 = await db.execute(text(
        "DELETE FROM curve_points WHERE curve_id NOT IN (SELECT id FROM curves)"
    ))
    r3 = await db.execute(text(
        "DELETE FROM curves WHERE turbine_id NOT IN (SELECT id FROM turbines)"
    ))
    r4 = await db.execute(text(
        "DELETE FROM turbines WHERE project_id NOT IN (SELECT id FROM projects)"
    ))
    await db.execute(text("VACUUM"))
    await db.commit()
    return {
        "deleted_parameters": r1.rowcount,
        "deleted_curve_points": r2.rowcount,
        "deleted_curves": r3.rowcount,
        "deleted_turbines": r4.rowcount,
    }


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
