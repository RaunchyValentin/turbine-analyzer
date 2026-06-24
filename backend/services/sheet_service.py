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
        _enrich_b(enriched, srel_lookup, overrides)   # same point structure
    elif pattern == "D":
        _enrich_d(enriched, srel_lookup, overrides)
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


def _stub(sheet_id: str) -> dict:
    return {
        "id": sheet_id,
        "title": sheet_id,
        "pattern": "stub",
        "message": "Sheet config not yet implemented.",
    }
