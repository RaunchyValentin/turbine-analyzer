from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from database import get_db
from models import Parameter

router = APIRouter(tags=["parameters"])


class ParameterCreate(BaseModel):
    turbine_id: int
    kks: str | None = None
    name: str | None = None
    value: str | None = None
    unit: str | None = None
    data_type: str | None = None
    source: str | None = None
    group: str | None = None


@router.get("/parameters")
async def list_parameters(
    turbine_id: int,
    group: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(Parameter).where(Parameter.turbine_id == turbine_id)
    if group:
        q = q.where(Parameter.group == group)
    if search:
        like = f"%{search}%"
        q = q.where(
            Parameter.kks.ilike(like) | Parameter.name.ilike(like)
        )
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/parameters", status_code=201)
async def create_parameter(body: ParameterCreate, db: AsyncSession = Depends(get_db)):
    param = Parameter(**body.model_dump())
    db.add(param)
    await db.commit()
    await db.refresh(param)
    return param


@router.patch("/parameters/{param_id}")
async def update_parameter(param_id: int, body: dict, db: AsyncSession = Depends(get_db)):
    param = await db.get(Parameter, param_id)
    if not param:
        raise HTTPException(404)
    for key, val in body.items():
        if hasattr(param, key):
            setattr(param, key, val)
    await db.commit()
    await db.refresh(param)
    return param


@router.delete("/parameters/{param_id}", status_code=204)
async def delete_parameter(param_id: int, db: AsyncSession = Depends(get_db)):
    param = await db.get(Parameter, param_id)
    if not param:
        raise HTTPException(404)
    await db.delete(param)
    await db.commit()
