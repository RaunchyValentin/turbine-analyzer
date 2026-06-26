"""Loads setting-list sheet configs and merges in live SREL values + user overrides."""
from __future__ import annotations
import copy
import json
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from models.parameter import Parameter
from models.setting_override import SettingOverride

CONFIGS_DIR = Path(__file__).parent.parent / "sheet_configs"


# ── navigation ─────────────────────────────────────────────────────────────

def get_navigation() -> dict:
    with open(CONFIGS_DIR / "navigation.json", encoding="utf-8") as f:
        return json.load(f)


# ── sheet data ──────────────────────────────────────────────────────────────

async def get_sheet(turbine_id: int, sheet_id: str, db: AsyncSession) -> dict:
    config_path = CONFIGS_DIR / f"{sheet_id.lower()}.json"
    if not config_path.exists():
        return _stub(sheet_id)

    with open(config_path, encoding="utf-8") as f:
        config = json.load(f)

    srel_lookup = await _build_srel_lookup(turbine_id, db)
    overrides = await _load_overrides(turbine_id, sheet_id, db)

    pattern = config.get("pattern", "A")
    enriched = copy.deepcopy(config)

    if pattern == "A":
        _enrich_a(enriched, srel_lookup, overrides)
    elif pattern == "B":
        _enrich_b(enriched, srel_lookup, overrides)
    elif pattern == "C":
        if enriched.get("id", "").upper() == "SG111C":
            _enrich_sg111c(enriched, srel_lookup, overrides)
        else:
            _enrich_b(enriched, srel_lookup, overrides)
    elif pattern == "D":
        _enrich_d(enriched, srel_lookup, overrides)
    elif pattern == "G":
        _enrich_sg111c(enriched, srel_lookup, overrides)
    elif pattern == "H":
        _enrich_h(enriched, srel_lookup, overrides)
    # E, F — config returned as-is (no live values needed for now)

    return enriched


# ── save override ───────────────────────────────────────────────────────────

async def save_override(turbine_id: int, sheet_id: str, srel_key: str,
                        value: str, db: AsyncSession) -> SettingOverride:
    from datetime import datetime

    existing = await db.execute(
        select(SettingOverride).where(
            and_(
                SettingOverride.turbine_id == turbine_id,
                SettingOverride.sheet_id == sheet_id,
                SettingOverride.srel_key == srel_key,
            )
        )
    )
    row = existing.scalar_one_or_none()
    if row:
        row.value = value
        row.updated_at = datetime.utcnow()
    else:
        row = SettingOverride(
            turbine_id=turbine_id,
            sheet_id=sheet_id,
            srel_key=srel_key,
            value=value,
        )
        db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


# ── helpers ─────────────────────────────────────────────────────────────────

async def _build_srel_lookup(turbine_id: int, db: AsyncSession) -> dict[str, str]:
    """Build {kks -> value} index, preferring the N10 port for multi-port tags."""
    result = await db.execute(
        select(Parameter).where(Parameter.turbine_id == turbine_id)
    )
    params = result.scalars().all()

    bucket: dict[str, list[Parameter]] = {}
    for p in params:
        if p.kks:
            bucket.setdefault(p.kks, []).append(p)

    lookup: dict[str, str] = {}
    for kks, plist in bucket.items():
        chosen = next((p for p in plist if p.name and "|N10" in p.name), plist[0])
        lookup[kks] = chosen.value or ""
    return lookup


async def _load_overrides(turbine_id: int, sheet_id: str,
                          db: AsyncSession) -> dict[str, str]:
    result = await db.execute(
        select(SettingOverride).where(
            and_(SettingOverride.turbine_id == turbine_id,
                 SettingOverride.sheet_id == sheet_id)
        )
    )
    return {o.srel_key: o.value for o in result.scalars().all()}


def _enrich_a(config: dict, srel: dict, overrides: dict) -> None:
    for section in config.get("sections", []):
        for row in section.get("rows", []):
            if row.get("manual"):
                key = row.get("key", "")
                ov = overrides.get(key)
                row["value"] = ov if ov is not None else row.get("default_value", "")
                row["overridden"] = ov is not None
            else:
                k = row.get("srel", "")
                original = srel.get(k, "") if k else ""
                ov = overrides.get(k) if k else None
                row["value"] = ov if ov is not None else original
                row["original_value"] = original
                row["overridden"] = ov is not None


def _ep(pt: dict, srel: dict, overrides: dict) -> None:
    """Enrich a single H-pattern point in-place. sx/sy = static override."""
    for axis, sk, sv in (("x", "xk", "sx"), ("y", "yk", "sy")):
        if sv in pt:
            pt[f"{axis}v"] = pt[sv]
            pt[f"{axis}s"] = "static"
        else:
            k = pt.get(sk, "")
            if k:
                ov   = overrides.get(k)
                orig = _safe_float(srel.get(k))
                pt[f"{axis}v"]          = _safe_float(ov) if ov is not None else orig
                pt[f"{axis}o"]          = orig
                pt[f"{axis}_overridden"] = k in overrides
            pt[f"{axis}s"] = "srel"


def _enrich_h(config: dict, srel: dict, overrides: dict) -> None:
    """Enrich pattern H (PilotGasPaired): sections with points / points_u."""
    for section in config.get("sections", []):
        for key in ("points", "points_u"):
            for pt in section.get(key, []):
                _ep(pt, srel, overrides)
    # Optional gas_index panel
    gi = config.get("gas_index")
    if gi:
        gi["values"] = {
            name: {"key": k, "value": _safe_float(overrides.get(k) or srel.get(k))}
            for name, k in gi.get("keys", {}).items()
        }
    # Optional lhv_panel
    lp = config.get("lhv_panel")
    if lp:
        lp["values"] = {
            name: {"key": k, "value": _safe_float(overrides.get(k) or srel.get(k))}
            for name, k in lp.get("keys", {}).items()
        }
    # Optional gas_temp panel (Definition of Gas Temperature)
    gt = config.get("gas_temp")
    if gt:
        gt["values"] = {
            name: {"key": k, "value": _safe_float(overrides.get(k) or srel.get(k))}
            for name, k in gt.get("keys", {}).items()
        }


def _enrich_b(config: dict, srel: dict, overrides: dict) -> None:
    for block_key in ("blocks", "blocks_split"):
        for block in config.get(block_key, []):
            for pt in block.get("points", []):
                for axis in ("x", "y"):
                    key = pt.get(f"{axis}_srel", "")
                    if not key:
                        continue
                    original = srel.get(key, "")
                    ov = overrides.get(key)
                    pt[f"{axis}_value"] = ov if ov is not None else original
                    pt[f"{axis}_original"] = original
                    pt[f"{axis}_overridden"] = ov is not None


def _safe_float(v) -> float | None:
    if v is None:
        return None
    try:
        f = float(v)
        return f if f == f else None  # NaN check
    except (ValueError, TypeError):
        return None


def _linear_interp(xs: list, ys: list, x: float) -> float | None:
    if len(xs) < 2:
        return ys[0] if ys else None
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    for i in range(len(xs) - 1):
        if xs[i] <= x <= xs[i + 1]:
            t = (x - xs[i]) / (xs[i + 1] - xs[i])
            return ys[i] + t * (ys[i + 1] - ys[i])
    return None


def _compute_ignition_diagram(vals: dict) -> list[dict]:
    """Build step-function points for FPG vs Zeit chart."""
    t0  = vals.get("ZUET0")  or 2.5
    t1  = vals.get("ZUEMT1") or 5.0
    td  = vals.get("ZUEMTD") or 6.5
    t2  = vals.get("ZUEMT2") or 9.0
    m0  = vals.get("ZUEM0")  or 0.20
    m1  = vals.get("ZUEM1")  or 0.30
    m2  = vals.get("ZUEM2")  or 0.38
    mfl = vals.get("ZUEFL")  or 0.15
    return [
        {"t": -1.5,     "flow": round(m0, 4),  "label": "Vorpositionierung"},
        {"t": -0.01,    "flow": round(m0, 4),  "label": ""},
        {"t":  0.0,     "flow": round(m0, 4),  "label": "SSV öffnet"},
        {"t":  t0,      "flow": round(m1, 4),  "label": "Beginn 1. Rampe"},
        {"t":  t1,      "flow": round(m1, 4),  "label": "Ende 1. Rampe"},
        {"t":  td,      "flow": round(m2, 4),  "label": "Beginn 2. Rampe"},
        {"t":  t2,      "flow": round(m2, 4),  "label": "Ende 2. Rampe"},
        {"t":  t2+0.01, "flow": round(mfl, 4), "label": "Flamme ein"},
        {"t": 12.0,     "flow": round(mfl, 4), "label": ""},
    ]


def _enrich_sg111c(config: dict, srel: dict, overrides: dict) -> None:
    """Enrich SG111c: static VBNTM values for first 6 pts + computed pilot gas."""
    f2_curve: list[tuple[float, float]] = []
    vb_curve: list[tuple[float, float]] = []

    for block in config.get("blocks", []):
        name = block.get("name", "")
        is_f2    = "|F2"    in name
        is_vbntm = "|VBNTM" in name or "VBNTM" in name

        for i, pt in enumerate(block.get("points", [])):
            xk = pt.get("x_srel", "")
            yk = pt.get("y_srel", "")

            xv = _safe_float(overrides.get(xk) or srel.get(xk))
            yv = _safe_float(overrides.get(yk) or srel.get(yk))
            xo = _safe_float(srel.get(xk))
            yo = _safe_float(srel.get(yk))
            pt["x_value"]      = xv
            pt["y_value"]      = yv
            pt["x_original"]   = xo
            pt["y_original"]   = yo
            pt["x_overridden"] = xk in overrides
            pt["y_overridden"] = yk in overrides
            pt["x_source"]     = "srel" if xv is not None else "not_found"
            pt["y_source"]     = "srel" if yv is not None else "not_found"

            if is_f2 and xv is not None and yv is not None:
                f2_curve.append((float(xv), float(yv)))
            if is_vbntm and xv is not None and yv is not None:
                vb_curve.append((float(xv), float(yv)))

    # Compute pilot gas
    pilot: list[dict] = []
    if vb_curve:
        vb_s = sorted(vb_curve, key=lambda t: t[0])
        vb_xs = [p[0] for p in vb_s]
        vb_ys = [p[1] for p in vb_s]
        for speed, mng in f2_curve:
            mpremix = _linear_interp(vb_xs, vb_ys, speed)
            mpilot  = round(mng - mpremix, 4) if mpremix is not None else None
            pilot.append({"speed": speed, "mNG": mng, "mPremix": mpremix, "mPilot": mpilot})

    config["pilot_gas"] = pilot


def _enrich_d(config: dict, srel: dict, overrides: dict) -> None:
    for section in config.get("sections", []):
        stype = section.get("type", "scalar")
        if stype == "scalar":
            for row in section.get("rows", []):
                k = row.get("srel", "")
                original = srel.get(k, "") if k else ""
                ov = overrides.get(k) if k else None
                row["value"] = ov if ov is not None else original
                row["original_value"] = original
                row["overridden"] = ov is not None
        elif stype == "poly":
            for pt in section.get("points", []):
                for axis in ("x", "y"):
                    key = pt.get(f"{axis}_srel", "")
                    if not key:
                        continue
                    original = srel.get(key, "")
                    ov = overrides.get(key)
                    pt[f"{axis}_value"] = ov if ov is not None else original
                    pt[f"{axis}_original"] = original
                    pt[f"{axis}_overridden"] = ov is not None

        elif stype == "timing_diagram":
            keys = section.get("srel_keys", {})
            vals = {name: _safe_float(overrides.get(key) or srel.get(key))
                    for name, key in keys.items()}
            section["computed_values"] = vals
            section["chart_points"] = _compute_ignition_diagram(vals)


def _stub(sheet_id: str) -> dict:
    return {
        "id": sheet_id,
        "title": sheet_id,
        "pattern": "stub",
        "message": "Sheet config not yet implemented.",
    }
