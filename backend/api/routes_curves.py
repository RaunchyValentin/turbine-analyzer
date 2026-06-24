from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from database import get_db
from models import Curve, CurvePoint

router = APIRouter(tags=["curves"])


class CurveCreate(BaseModel):
    turbine_id: int
    name: str
    poly_order: int | None = None
    description: str | None = None


class PointUpsert(BaseModel):
    x: float
    y: float
    order: int


@router.get("/curves")
async def list_curves(turbine_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Curve).where(Curve.turbine_id == turbine_id))
    return result.scalars().all()


@router.post("/curves", status_code=201)
async def create_curve(body: CurveCreate, db: AsyncSession = Depends(get_db)):
    curve = Curve(**body.model_dump())
    db.add(curve)
    await db.commit()
    await db.refresh(curve)
    return curve


@router.get("/curves/{curve_id}/points")
async def get_curve_points(curve_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CurvePoint).where(CurvePoint.curve_id == curve_id).order_by(CurvePoint.order)
    )
    return result.scalars().all()


@router.put("/curves/{curve_id}/points")
async def replace_curve_points(curve_id: int, points: list[PointUpsert], db: AsyncSession = Depends(get_db)):
    curve = await db.get(Curve, curve_id)
    if not curve:
        raise HTTPException(404)
    existing = await db.execute(select(CurvePoint).where(CurvePoint.curve_id == curve_id))
    for pt in existing.scalars().all():
        await db.delete(pt)
    for pt in points:
        db.add(CurvePoint(curve_id=curve_id, **pt.model_dump()))
    await db.commit()
    result = await db.execute(
        select(CurvePoint).where(CurvePoint.curve_id == curve_id).order_by(CurvePoint.order)
    )
    return result.scalars().all()


@router.delete("/curves/{curve_id}", status_code=204)
async def delete_curve(curve_id: int, db: AsyncSession = Depends(get_db)):
    curve = await db.get(Curve, curve_id)
    if not curve:
        raise HTTPException(404)
    await db.delete(curve)
    await db.commit()
