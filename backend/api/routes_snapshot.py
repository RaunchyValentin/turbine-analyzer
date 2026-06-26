import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from database import get_db
from models import Turbine, Curve, CurvePoint
from models.parameter import Parameter
from models.override import UserOverride
from models.setting_override import SettingOverride

router = APIRouter(tags=["snapshot"])

SNAPSHOT_VERSION = 2


# ── Export ──────────────────────────────────────────────────────────────────

@router.get("/snapshot/{turbine_id}")
async def export_snapshot(turbine_id: int, db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import selectinload
    from models.turbine import Project
    res = await db.execute(
        select(Turbine).where(Turbine.id == turbine_id).options(selectinload(Turbine.project))
    )
    turbine = res.scalar_one_or_none()
    if not turbine:
        raise HTTPException(404, "Turbine not found")

    # setting_overrides
    so_res = await db.execute(
        select(SettingOverride).where(SettingOverride.turbine_id == turbine_id)
    )
    setting_overrides = [
        {"sheet_id": r.sheet_id, "srel_key": r.srel_key, "value": r.value}
        for r in so_res.scalars().all()
    ]

    # curves + their current points
    cv_res = await db.execute(select(Curve).where(Curve.turbine_id == turbine_id))
    curves_out = []
    for curve in cv_res.scalars().all():
        pts_res = await db.execute(
            select(CurvePoint).where(CurvePoint.curve_id == curve.id).order_by(CurvePoint.order)
        )
        pts = [{"x": p.x, "y": p.y, "order": p.order} for p in pts_res.scalars().all()]
        curves_out.append({
            "name": curve.name,
            "description": curve.description,
            "poly_order": curve.poly_order,
            "points": pts,
        })

    snapshot = {
        "version": SNAPSHOT_VERSION,
        "turbine_id": turbine_id,
        "turbine_name": turbine.name,
        "project_name": turbine.project.name if turbine.project else "",
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "setting_overrides": setting_overrides,
        "curves": curves_out,
    }

    date_str = datetime.now().strftime("%Y-%m-%d")
    filename = f"{turbine.name}_{date_str}.json"
    return Response(
        content=json.dumps(snapshot, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Import ───────────────────────────────────────────────────────────────────

@router.post("/snapshot/restore")
async def restore_snapshot(
    file: UploadFile = File(...),
    turbine_id: int = Query(None),
    db: AsyncSession = Depends(get_db),
):
    raw = await file.read()
    try:
        snap = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"Invalid JSON: {e}")

    if snap.get("version", 1) < 1:
        raise HTTPException(400, "Unsupported snapshot version")

    # Resolve target turbine
    tid = turbine_id or snap.get("turbine_id")
    if not tid:
        raise HTTPException(400, "turbine_id required")
    turbine = await db.get(Turbine, int(tid))
    if not turbine:
        raise HTTPException(404, f"Turbine {tid} not found in database")

    restored_settings = 0
    restored_curves = 0
    skipped_curves = 0

    # ── Restore setting_overrides ───────────────────────────────────────────
    await db.execute(delete(SettingOverride).where(SettingOverride.turbine_id == tid))

    for entry in snap.get("setting_overrides", []):
        db.add(SettingOverride(
            turbine_id=tid,
            sheet_id=entry["sheet_id"],
            srel_key=entry["srel_key"],
            value=entry["value"],
            updated_at=datetime.utcnow(),
        ))
        restored_settings += 1

    # ── Restore curves ──────────────────────────────────────────────────────
    # Build lookup: curve name → Curve row
    cv_res = await db.execute(select(Curve).where(Curve.turbine_id == tid))
    curve_by_name: dict[str, Curve] = {c.name: c for c in cv_res.scalars().all()}

    # Load all parameters for user_override sync
    param_res = await db.execute(
        select(Parameter).where(Parameter.turbine_id == tid)
    )
    params_all = param_res.scalars().all()

    # Clear all user_overrides for this turbine — will rebuild below
    await db.execute(delete(UserOverride).where(UserOverride.turbine_id == tid))

    for cv_snap in snap.get("curves", []):
        name = cv_snap.get("name", "")
        points = cv_snap.get("points", [])

        if name not in curve_by_name:
            skipped_curves += 1
            continue

        curve = curve_by_name[name]

        # Replace curve points
        await db.execute(delete(CurvePoint).where(CurvePoint.curve_id == curve.id))
        for pt in points:
            db.add(CurvePoint(
                curve_id=curve.id,
                x=float(pt["x"]),
                y=float(pt["y"]),
                order=int(pt["order"]),
            ))

        # Rebuild user_overrides for this curve
        _rebuild_overrides(curve, points, params_all, tid, db)
        restored_curves += 1

    await db.commit()

    return {
        "status": "ok",
        "turbine": turbine.name,
        "restored_setting_overrides": restored_settings,
        "restored_curves": restored_curves,
        "skipped_curves_not_found": skipped_curves,
    }


def _rebuild_overrides(curve: Curve, points: list[dict], params_all, turbine_id: int, db):
    """Rebuild UserOverride rows for a single curve after restoring its points."""
    parts = (curve.name or "").split("|", 1)
    if len(parts) != 2:
        return
    tag, port = parts

    param_by_name = {
        p.name: p for p in params_all
        if p.name and p.name.startswith(f"{tag}|{port}.")
    }
    if not param_by_name:
        return

    now = datetime.utcnow()
    for pt in points:
        i = pt["order"]
        for port_id_offset, val_key in [(0, "x"), (10, "y")]:
            pid = 20 + i * 20 + port_id_offset
            pname = f"{tag}|{port}.{pid}"
            param = param_by_name.get(pname)
            if not param:
                continue
            new_val = str(pt[val_key])
            if (param.value or "").strip() != new_val.strip():
                db.add(UserOverride(
                    turbine_id=turbine_id,
                    parameter_id=param.id,
                    user_value=new_val,
                    original_value=param.value,
                    modified_at=now,
                ))
