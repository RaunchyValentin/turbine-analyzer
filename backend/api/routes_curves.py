import json
import os.path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from database import get_db
from models import Curve, CurvePoint
from models.parameter import Parameter

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


@router.get("/curves/{curve_id}/axis-info")
async def get_curve_axis_info(curve_id: int, db: AsyncSession = Depends(get_db)):
    """Return X/Y axis labels derived from the SREL keys of underlying jar parameters."""
    curve = await db.get(Curve, curve_id)
    if not curve:
        raise HTTPException(404)

    parts = (curve.name or "").split("|", 1)
    if len(parts) != 2:
        return {"x_label": "X", "y_label": "Y", "x_unit": "", "y_unit": ""}

    tag, port = parts

    result = await db.execute(
        select(Parameter).where(
            Parameter.turbine_id == curve.turbine_id,
            Parameter.name.like(f"{tag}|{port}.%"),
        )
    )
    params = result.scalars().all()

    x_keys, y_keys = [], []
    x_units, y_units = set(), set()

    for p in params:
        if not p.raw_data:
            continue
        try:
            rd = json.loads(p.raw_data)
            pid = int(rd.get("Port-ID", "0"))
        except Exception:
            continue
        if pid % 20 == 0:
            if p.kks:
                x_keys.append(p.kks)
            if p.unit:
                x_units.add(p.unit)
        elif pid % 20 == 10:
            if p.kks:
                y_keys.append(p.kks)
            if p.unit:
                y_units.add(p.unit)

    def common_prefix(keys: list[str]) -> str:
        if not keys:
            return ""
        bases = [k.rsplit(".", 1)[0] for k in keys if "." in k]
        if not bases:
            return keys[0]
        cp = os.path.commonprefix(bases)
        return cp.rstrip(".")

    # Unit "1" in SPPA-T3000 means dimensionless — omit it for cleaner labels
    def clean_unit(units: set) -> str:
        meaningful = {u for u in units if u and u != "1"}
        return next(iter(meaningful), "")

    return {
        "x_label": common_prefix(x_keys) or "X",
        "y_label": common_prefix(y_keys) or "Y",
        "x_unit":  clean_unit(x_units),
        "y_unit":  clean_unit(y_units),
    }


@router.post("/curves/detect-pli")
async def detect_pli_curves(turbine_id: int, db: AsyncSession = Depends(get_db)):
    """
    Scan jar parameters for PLI polynomial patterns and create Curve records.
    Pattern: same (Tag-Name, Port-Name), portIds 20,30,40,50... step 10;
    portId%20==0 → X axis, portId%20==10 → Y axis.
    """
    result = await db.execute(
        select(Parameter).where(Parameter.turbine_id == turbine_id, Parameter.source == "jar")
    )
    params = result.scalars().all()

    # Group by (Tag-Name, Port-Name)
    groups: dict[tuple, list[dict]] = {}
    for p in params:
        if not p.raw_data:
            continue
        try:
            rd = json.loads(p.raw_data)
        except Exception:
            continue
        tag = rd.get("Tag-Name", "")
        port = rd.get("Port-Name", "")
        pid = rd.get("Port-ID", "")
        val = p.value or rd.get("Value", "")
        if not tag or not port or not pid:
            continue
        groups.setdefault((tag, port), []).append({
            "port_id": pid, "value": val, "designation": p.description or ""
        })

    existing_r = await db.execute(select(Curve.name).where(Curve.turbine_id == turbine_id))
    existing_names = {r[0] for r in existing_r.fetchall()}

    created = 0
    skipped = 0

    for (tag, port_name), entries in groups.items():
        try:
            sorted_ids = sorted({int(e["port_id"]) for e in entries})
        except (ValueError, TypeError):
            continue

        if len(sorted_ids) < 4:
            continue
        if sorted_ids[0] != 20:
            continue
        if not all(b - a == 10 for a, b in zip(sorted_ids, sorted_ids[1:])):
            continue

        x_ids = [i for i in sorted_ids if i % 20 == 0]   # 20,40,60…
        y_ids = [i for i in sorted_ids if i % 20 == 10]  # 30,50,70…
        if len(x_ids) < 2 or len(x_ids) != len(y_ids):
            continue

        id_val: dict[int, float] = {}
        for e in entries:
            try:
                id_val[int(e["port_id"])] = float(e["value"])
            except (ValueError, TypeError):
                pass

        points = [
            {"x": id_val[xi], "y": id_val[yi], "order": i}
            for i, (xi, yi) in enumerate(zip(x_ids, y_ids))
            if xi in id_val and yi in id_val
        ]
        if len(points) < 2:
            continue

        curve_name = f"{tag}|{port_name}"
        if curve_name in existing_names:
            skipped += 1
            continue

        designation = entries[0].get("designation", "")
        n = len(points)
        curve = Curve(
            turbine_id=turbine_id,
            name=curve_name,
            poly_order=n,
            description=f"PLI{n} – {designation}" if designation else f"PLI{n}",
        )
        db.add(curve)
        await db.flush()

        for pt in points:
            db.add(CurvePoint(curve_id=curve.id, **pt))

        existing_names.add(curve_name)
        created += 1

    await db.commit()
    return {"created": created, "skipped_duplicates": skipped, "total_groups": len(groups)}
