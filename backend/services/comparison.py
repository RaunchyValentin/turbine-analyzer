"""
Multi-turbine parameter comparison logic.
"""
from typing import Any


MATCH_COLOR = "green"
MINOR_DIFF_COLOR = "yellow"
MAJOR_DIFF_COLOR = "red"
MISSING_COLOR = "red"

MINOR_DIFF_THRESHOLD = 0.01  # 1% relative difference


def compare_turbines(
    turbines_params: list[list[dict[str, Any]]],
    match_by: str = "kks",
) -> list[dict[str, Any]]:
    """
    Compare parameters across 2-3 turbines.

    Args:
        turbines_params: list of parameter lists, one per turbine
        match_by: field to match on — "kks", "name"

    Returns:
        List of rows with per-turbine values and diff color codes.
    """
    all_keys: set[str] = set()
    indexed: list[dict[str, dict]] = []

    for params in turbines_params:
        index: dict[str, dict] = {}
        for p in params:
            key = p.get(match_by) or ""
            if key:
                index[key] = p
        indexed.append(index)
        all_keys.update(index.keys())

    rows = []
    for key in sorted(all_keys):
        row_params = [idx.get(key) for idx in indexed]
        color = _diff_color(row_params)
        rows.append({
            "key": key,
            "params": row_params,
            "color": color,
        })

    return rows


def _diff_color(row_params: list[dict | None]) -> str:
    present = [p for p in row_params if p is not None]

    if len(present) < len(row_params):
        return MISSING_COLOR

    values = [p.get("value", "") for p in present]
    if len(set(values)) == 1:
        return MATCH_COLOR

    try:
        floats = [float(v) for v in values]
        base = floats[0]
        if base == 0:
            return MAJOR_DIFF_COLOR
        max_rel = max(abs(f - base) / abs(base) for f in floats[1:])
        return MINOR_DIFF_COLOR if max_rel <= MINOR_DIFF_THRESHOLD else MAJOR_DIFF_COLOR
    except (ValueError, TypeError):
        return MAJOR_DIFF_COLOR
