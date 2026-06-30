import json
import os.path
import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from database import get_db
from models import Curve, CurvePoint
from models.parameter import Parameter
from models.override import UserOverride

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


async def _sync_overrides(curve: Curve, points: list[PointUpsert], db: AsyncSession) -> None:
    """Write/delete UserOverride records to reflect current curve edits vs original parameters."""
    parts = (curve.name or "").split("|", 1)
    if len(parts) != 2:
        return
    tag, port = parts

    # Load all parameters for this curve's tag+port
    res = await db.execute(
        select(Parameter).where(
            Parameter.turbine_id == curve.turbine_id,
            Parameter.name.like(f"{tag}|{port}.%"),
        )
    )
    param_by_name: dict[str, Parameter] = {p.name: p for p in res.scalars().all()}

    now = datetime.utcnow()

    for pt in points:
        i = pt.order
        for axis, port_id, new_val in [
            ("x", 30 + i * 20, str(pt.x)),
            ("y", 40 + i * 20, str(pt.y)),
        ]:
            pname = f"{tag}|{port}.{port_id}"
            param = param_by_name.get(pname)
            if not param:
                continue

            changed = (param.value or "").strip() != new_val.strip()

            # Load existing override (if any)
            ov_res = await db.execute(
                select(UserOverride).where(
                    UserOverride.turbine_id == curve.turbine_id,
                    UserOverride.parameter_id == param.id,
                )
            )
            ov = ov_res.scalar_one_or_none()

            if changed:
                if ov:
                    ov.user_value = new_val
                    ov.modified_at = now
                else:
                    db.add(UserOverride(
                        turbine_id=curve.turbine_id,
                        parameter_id=param.id,
                        user_value=new_val,
                        original_value=param.value,
                        modified_at=now,
                    ))
            else:
                # Value restored to original — remove override
                if ov:
                    await db.delete(ov)


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
    await _sync_overrides(curve, points, db)
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


@router.post("/curves/{curve_id}/reset")
async def reset_curve_to_original(curve_id: int, db: AsyncSession = Depends(get_db)):
    """Restore curve points from original jar parameters (undoes manual edits)."""
    curve = await db.get(Curve, curve_id)
    if not curve:
        raise HTTPException(404)

    parts = (curve.name or "").split("|", 1)
    if len(parts) != 2:
        raise HTTPException(400, detail="Curve name is not in TAG|PORT format")

    tag, port = parts

    result = await db.execute(
        select(Parameter).where(
            Parameter.turbine_id == curve.turbine_id,
            Parameter.name.like(f"{tag}|{port}.%"),
        )
    )
    params = result.scalars().all()

    id_val: dict[int, float] = {}
    for p in params:
        if not p.raw_data:
            continue
        try:
            rd = json.loads(p.raw_data)
            pid = int(rd.get("Port-ID", "0"))
            id_val[pid] = float(p.value or rd.get("Value", "0"))
        except Exception:
            continue

    if not id_val:
        raise HTTPException(400, detail="No parameter data found for this curve")

    sorted_ids = sorted(id_val)
    x_ids = [i for i in sorted_ids if i % 20 == 10 and i >= 30]
    y_ids = [i for i in sorted_ids if i % 20 == 0  and i >= 40]

    points = [
        {"x": id_val[xi], "y": id_val[yi], "order": i}
        for i, (xi, yi) in enumerate(zip(x_ids, y_ids))
        if xi in id_val and yi in id_val
    ]
    if not points:
        raise HTTPException(400, detail="Could not reconstruct points from parameters")

    existing = await db.execute(select(CurvePoint).where(CurvePoint.curve_id == curve_id))
    for pt in existing.scalars().all():
        await db.delete(pt)
    for pt in points:
        db.add(CurvePoint(curve_id=curve_id, **pt))

    # Clear overrides for this curve's parameters — values restored to original
    ov_res = await db.execute(
        select(UserOverride).where(
            UserOverride.turbine_id == curve.turbine_id,
            UserOverride.parameter_id.in_(
                select(Parameter.id).where(
                    Parameter.turbine_id == curve.turbine_id,
                    Parameter.name.like(f"{tag}|{port}.%"),
                )
            ),
        )
    )
    for ov in ov_res.scalars().all():
        await db.delete(ov)

    await db.commit()

    refreshed = await db.execute(
        select(CurvePoint).where(CurvePoint.curve_id == curve_id).order_by(CurvePoint.order)
    )
    return refreshed.scalars().all()


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
        if pid % 20 == 10 and pid >= 30:
            if p.kks:
                x_keys.append(p.kks)
            if p.unit:
                x_units.add(p.unit)
        elif pid % 20 == 0 and pid >= 40:
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
async def detect_pli_curves(turbine_id: int, force: bool = False, db: AsyncSession = Depends(get_db)):  # noqa: C901
    """
    Scan jar parameters for polynomial curve blocks and create Curve records.

    SPPA-T3000 PLI/POLY block structure:
      Port 10   = config (type indicator)
      Port 20   = active pair count (integer)
      Port 30   = X1,  Port 40  = Y1
      Port 50   = X2,  Port 60  = Y2  ...
    X ports: pid % 20 == 10 and pid >= 30  (30, 50, 70, ...)
    Y ports: pid % 20 == 0  and pid >= 40  (40, 60, 80, ...)
    Block capacity types: PLI10 (30-220), PLI15 (30-320), PLI20 (30-420).
    Tolerates ±1 mismatch between X and Y count (incomplete last pair in JAR export).
    If force=True: deletes all existing curves before re-creating.
    """
    if force:
        existing_curves = await db.execute(select(Curve).where(Curve.turbine_id == turbine_id))
        for c in existing_curves.scalars().all():
            await db.delete(c)
        await db.flush()

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
        # Build port_id → value map (numeric port IDs only)
        id_val_raw: dict[int, str] = {}
        for e in entries:
            try:
                id_val_raw[int(e["port_id"])] = e["value"]
            except (ValueError, TypeError):
                continue

        # Determine count from port 20 (number-of-points parameter)
        count_port = None
        if 20 in id_val_raw:
            try:
                count_port = int(float(id_val_raw[20]))
            except (ValueError, TypeError):
                pass

        # Polynomial data ports: 30=X1, 40=Y1, 50=X2, 60=Y2, ...
        # Limit to the range defined by count port (excludes trailing zero-filled slots).
        # PLI10 capacity: data ports 30-220 (20 ports, 10 pairs max)
        # PLI20 capacity: data ports 30-420 (40 ports, 20 pairs max)
        if count_port and count_port >= 2:
            max_pid = 40 + (count_port - 1) * 20
            poly_pids = sorted(pid for pid in id_val_raw if 30 <= pid <= max_pid)
        else:
            # Fallback: consecutive step-10 block starting at 30, below 1000
            poly_pids = sorted(pid for pid in id_val_raw if 30 <= pid < 1000)
            trimmed = []
            for pid in poly_pids:
                if not trimmed or pid - trimmed[-1] == 10:
                    trimmed.append(pid)
                else:
                    break
            poly_pids = trimmed

        if len(poly_pids) < 4:
            continue
        if not all(b - a == 10 for a, b in zip(poly_pids, poly_pids[1:])):
            continue

        x_ids = [pid for pid in poly_pids if pid % 20 == 10]  # 30,50,70…
        y_ids = [pid for pid in poly_pids if pid % 20 == 0]   # 40,60,80…

        # Tolerate off-by-one: last pair may be incomplete in the JAR export
        if abs(len(x_ids) - len(y_ids)) == 1:
            n_min = min(len(x_ids), len(y_ids))
            x_ids = x_ids[:n_min]
            y_ids = y_ids[:n_min]

        if len(x_ids) < 2 or len(x_ids) != len(y_ids):
            continue

        id_val: dict[int, float] = {}
        for pid, raw in id_val_raw.items():
            try:
                id_val[pid] = float(raw)
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

        # Only keep PLI10 (30-220) and PLI20 (30-420) capacity blocks
        all_data_pids = [p for p in id_val_raw if 30 <= p < 1000]
        capacity = len(all_data_pids) // 2
        if capacity not in (10, 20):
            continue

        # Reject non-polynomial blocks:
        #  - first X step must be non-decreasing (catches ZV52-style: 21930→0→0...)
        #  - all X steps except last must be non-decreasing
        #    (last slot may be a fill-zero from JAR export, e.g. HSG0: 0,2.8,10,12,130,0)
        #  - X must have a non-zero range
        #  - Y must have variation (discrete/protection blocks have flat Y)
        xs = [p["x"] for p in points]
        ys = [p["y"] for p in points]
        steps = [xs[i + 1] - xs[i] for i in range(len(xs) - 1)]
        if steps[0] < 0:                          # first step must go up or stay
            continue
        if not all(s >= 0 for s in steps[:-1]):   # all steps except last must be ≥ 0
            continue
        if max(xs) == min(xs):   # X all same → degenerate
            continue
        if max(ys) == min(ys):   # Y constant → not an interpolation curve
            continue

        block_type = f"PLI{capacity}"

        designation = next((e.get("designation", "") for e in entries if e.get("designation")), "")
        n = len(points)
        curve = Curve(
            turbine_id=turbine_id,
            name=curve_name,
            poly_order=n,
            description=f"{block_type}(n={n}) – {designation}" if designation else f"{block_type}(n={n})",
        )
        db.add(curve)
        await db.flush()

        for pt in points:
            db.add(CurvePoint(curve_id=curve.id, **pt))

        existing_names.add(curve_name)
        created += 1

    # ── SREL phase: scan srel parameters for PLI10/PLI20/POLY blocks ─────────
    # SREL exports carry Symbol-Type = PLI10/PLI20/POLY and port names A1/B1
    # (A=X, B=Y) or X1/Y1.  These rows are saved as parameters during import so
    # they can be re-detected here without re-importing the file.
    srel_result = await db.execute(
        select(Parameter).where(Parameter.turbine_id == turbine_id, Parameter.source == "srel")
    )
    srel_params = srel_result.scalars().all()

    srel_groups: dict[str, dict] = {}  # "{tag_name}\x00{sym_type}" → accum dict

    for p in srel_params:
        if not p.raw_data:
            continue
        try:
            rd = json.loads(p.raw_data)
        except Exception:
            continue

        sym_type = rd.get("Symbol-Type", "").strip()
        sym_up = sym_type.upper()
        if not (sym_up.startswith("PLI") or sym_up == "POLY"):
            continue

        tag = rd.get("Tag-Name", "").strip()
        port_nm = (rd.get("Port-Name") or "").strip()
        value = p.value or rd.get("Value", "")
        if not tag or not port_nm:
            continue

        m = re.match(r"^([ABXY])(\d+)$", port_nm, re.IGNORECASE)
        if not m:
            continue

        letter = m.group(1).upper()
        axis = "x" if letter in ("A", "X") else "y"
        idx = int(m.group(2))

        gkey = f"{tag}\x00{sym_type}"
        grp = srel_groups.setdefault(gkey, {"sym_type": sym_type, "points": {}})
        pt_entry = grp["points"].setdefault(idx, {})
        try:
            pt_entry[axis] = float(str(value).replace(",", "."))
        except (ValueError, TypeError):
            pass

    for gkey, grp in srel_groups.items():
        tag = gkey.split("\x00")[0]
        sym_type = grp["sym_type"]
        curve_name = tag

        if curve_name in existing_names:
            skipped += 1
            continue

        common_idx = sorted(
            i for i, pt in grp["points"].items() if "x" in pt and "y" in pt
        )
        if len(common_idx) < 2:
            continue

        pts_map = grp["points"]
        points = [
            {"x": pts_map[i]["x"], "y": pts_map[i]["y"], "order": ord_i}
            for ord_i, i in enumerate(common_idx)
        ]

        xs = [p["x"] for p in points]
        ys = [p["y"] for p in points]
        if max(xs) == min(xs) or max(ys) == min(ys):
            continue

        n = len(points)
        curve = Curve(
            turbine_id=turbine_id,
            name=curve_name,
            poly_order=n,
            description=f"{sym_type.upper()}(n={n})",
        )
        db.add(curve)
        await db.flush()
        for pt in points:
            db.add(CurvePoint(curve_id=curve.id, **pt))
        existing_names.add(curve_name)
        created += 1

    await db.commit()
    return {"created": created, "skipped_duplicates": skipped, "total_groups": len(groups)}
