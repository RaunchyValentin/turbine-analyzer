from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Turbine, Parameter
from services import export_parameters_to_excel, export_comparison_to_excel, compare_turbines

router = APIRouter(tags=["export"])


@router.get("/export/parameters")
async def export_parameters(turbine_ids: list[int] = Query(...), db: AsyncSession = Depends(get_db)):
    turbines = []
    params_per_turbine = []

    for tid in turbine_ids:
        turbine = await db.get(Turbine, tid)
        if not turbine:
            raise HTTPException(404, f"Turbine {tid} not found")
        turbines.append({"name": turbine.name})
        result = await db.execute(select(Parameter).where(Parameter.turbine_id == tid))
        params = [
            {c.name: getattr(p, c.name) for c in p.__table__.columns}
            for p in result.scalars().all()
        ]
        params_per_turbine.append(params)

    xlsx_bytes = export_parameters_to_excel(turbines, params_per_turbine)
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=parameters.xlsx"},
    )


@router.get("/export/comparison")
async def export_comparison(turbine_ids: list[int] = Query(...), db: AsyncSession = Depends(get_db)):
    turbine_names = []
    params_per_turbine = []

    for tid in turbine_ids:
        turbine = await db.get(Turbine, tid)
        if not turbine:
            raise HTTPException(404, f"Turbine {tid} not found")
        turbine_names.append(turbine.name)
        result = await db.execute(select(Parameter).where(Parameter.turbine_id == tid))
        params = [
            {c.name: getattr(p, c.name) for c in p.__table__.columns}
            for p in result.scalars().all()
        ]
        params_per_turbine.append(params)

    comparison_rows = compare_turbines(params_per_turbine)
    xlsx_bytes = export_comparison_to_excel(comparison_rows, turbine_names)
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=comparison.xlsx"},
    )
