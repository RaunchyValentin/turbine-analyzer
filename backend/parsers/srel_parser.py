"""
Parser for SPPA-T3000 (Orion Server) SREL CSV export files.

Two known formats:
 Old (pre-2023): 35 cols  — Diagram-Name, Symbol-Type, Tag-Name, Port-Name, Value, ...
 New (2023+):    42+ cols — ... adds Port-Type (I/O) column and bilingual labels
Future formats with extra columns are handled automatically via raw_data.
"""
from __future__ import annotations
import csv
import io
import os
import re
from typing import Any

# Data-Type column value → our type string
_DT_MAP: dict[str, str] = {
    "0": "STRING",
    "1": "STRING",
    "2": "REAL",
    "3": "STRING",
    "9": "BOOL",
    "11": "REAL",
}

# Symbol-Type prefixes that represent piecewise-linear interpolation curves
_PLI_PREFIXES = ("PLI10", "PLI20", "PLI05", "PLI", "POLY")


def is_srel_csv(content: bytes) -> bool:
    """Return True if the bytes look like a SREL CSV (not plain XY data)."""
    try:
        first = content[:2000].decode("utf-8-sig", errors="replace").split("\n")[0]
        return "Diagram" in first and ("Symbol" in first or "Tag" in first)
    except Exception:
        return False


_SREL_SHEET_KEYWORDS = ("imported srel", "internal import", "srel-list", "srel_list")


def _find_srel_sheet(xl) -> str | None:
    """Return the name of the sheet that contains SREL data, or None."""
    import pandas as pd
    # 1. Check for known sheet name patterns (fast, no data read)
    for name in xl.sheet_names:
        if any(kw in name.lower() for kw in _SREL_SHEET_KEYWORDS):
            return name
    # 2. Scan all sheets for a Diagram-Name column header
    for name in xl.sheet_names:
        try:
            df = xl.parse(name, nrows=0)
            if any("Diagram" in str(c) for c in df.columns):
                return name
        except Exception:
            continue
    return None


def is_srel_excel(file_bytes: bytes) -> bool:
    """Return True if the Excel file contains a SREL-style data sheet."""
    try:
        import pandas as pd
        xl = pd.ExcelFile(io.BytesIO(file_bytes))
        return _find_srel_sheet(xl) is not None
    except Exception:
        return False


def parse_srel_excel(file_bytes: bytes, filename: str = "") -> dict[str, Any]:
    """
    Parse a SPPA-T3000 SREL export in Excel format (XLSX/XLS).

    Works for both single-sheet exports and multi-sheet workbooks that
    contain an 'IMPORTED SREL-List' or similarly named sheet.
    Converts the target sheet to CSV then delegates to parse_srel().
    """
    import pandas as pd
    xl = pd.ExcelFile(io.BytesIO(file_bytes))
    target = _find_srel_sheet(xl) or xl.sheet_names[0]
    df = xl.parse(target, dtype=str, keep_default_na=False)
    csv_bytes = df.to_csv(index=False).encode("utf-8")
    return parse_srel(csv_bytes, filename)


def parse_srel(file_bytes: bytes, filename: str = "") -> dict[str, Any]:
    """
    Parse a SPPA-T3000 SREL CSV export.

    Every original column is captured in raw_data regardless of format version.

    Returns:
        {
            "turbine_name": str,
            "turbine_type": str,
            "parameters": [{"kks", "name", "value", "unit", "data_type",
                             "group", "source", "description", "raw_data"}, ...],
            "curves":     [{"name", "kks", "description",
                             "points": [{"x", "y", "order"}, ...]}, ...]
        }
    """
    text = _decode(file_bytes)
    reader = csv.reader(io.StringIO(text))
    all_rows = list(reader)

    if len(all_rows) < 2:
        return _empty(filename)

    header, data_rows = all_rows[0], all_rows[1:]

    # Normalised header strings (e.g. "Diagram- Name" → "Diagram-Name") used as
    # keys in raw_data and in the lookup dict col.
    norm_headers: list[str] = [_norm_col(h) for h in header]
    col: dict[str, int] = {h: i for i, h in enumerate(norm_headers)}

    parameters: list[dict] = []
    curves_acc: dict[str, dict] = {}  # accumulate PLI breakpoints

    for row in data_rows:
        if not row or all(c.strip() == "" for c in row):
            continue

        # ── Build raw_data — every column, no filtering ────────────────────
        raw_data: dict[str, str] = {}
        for i, col_name in enumerate(norm_headers):
            val = row[i].strip() if i < len(row) else ""
            if val:
                raw_data[col_name] = val

        def g(*names: str) -> str:
            for n in names:
                idx = col.get(n)
                if idx is not None and idx < len(row):
                    v = row[idx].strip()
                    if v:
                        return v
            return ""

        diagram    = g("Diagram-Name")
        sym_type   = g("Symbol-Type")
        tag_name   = g("Tag-Name")
        port_nm    = g("Port-Name")
        port_type  = g("Port-Type", "Port Type", "PortType")
        param_key  = _extract_srel_key(g("Parameter Key", "Parameter-Key", "ParameterKey", "Param-Key"))
        value      = g("Value")
        eu         = g("EU")
        dt_raw     = g("Data-Type", "Data Type")
        desc       = g("Description")

        sym_up = sym_type.upper()

        # ── PLI curve blocks ───────────────────────────────────────────────
        if any(sym_up.startswith(p) for p in _PLI_PREFIXES):
            m = re.match(r"^([AB])(\d+)$", port_nm, re.IGNORECASE)
            if m:
                axis = m.group(1).upper()
                idx = int(m.group(2))
                key = f"{tag_name}\x00{sym_type}"
                if key not in curves_acc:
                    parts = tag_name.split("|")
                    curves_acc[key] = {
                        "name": tag_name,
                        "kks": diagram,
                        "description": sym_type,
                        "points": {},
                    }
                pt = curves_acc[key]["points"].setdefault(idx, {})
                try:
                    coord = float(value.replace(",", "."))
                    pt["x" if axis == "A" else "y"] = coord
                except ValueError:
                    pass
            continue

        # ── Regular parameter ──────────────────────────────────────────────
        # kks: Parameter Key takes priority (e.g. "S.TURB.09") — used by
        # setting-list lookup.  Fall back to Tag-Name base for KKS-only data.
        tag_base = tag_name.split("|")[0] if "|" in tag_name else tag_name
        kks = param_key if param_key else tag_base

        # name: param_key|port_name keeps the |N10 preference working for
        # multi-port SREL parameters.  For KKS-only rows use tag_name|port_name.
        if param_key:
            full_name = f"{param_key}|{port_nm}" if port_nm else param_key
        else:
            full_name = f"{tag_name}|{port_nm}" if port_nm else tag_name

        data_type = _DT_MAP.get(dt_raw, "REAL" if dt_raw == "11" else "STRING")

        parameters.append({
            "kks": kks,
            "name": full_name,
            "value": value,
            "unit": eu,
            "data_type": data_type,
            "group": diagram,
            "source": "srel",
            "description": desc,
            "raw_data": raw_data,
        })

    # ── Flatten curves ─────────────────────────────────────────────────────
    curves: list[dict] = []
    for cd in curves_acc.values():
        pts = [
            {"x": pt["x"], "y": pt["y"], "order": i}
            for i, pt in sorted(cd["points"].items())
            if "x" in pt and "y" in pt
        ]
        if pts:
            curves.append({
                "name": cd["name"],
                "kks": cd["kks"],
                "description": cd["description"],
                "points": pts,
            })

    turbine_name = os.path.splitext(os.path.basename(filename))[0] if filename else "Unknown"

    return {
        "turbine_name": turbine_name,
        "turbine_type": "SGT",
        "parameters": parameters,
        "curves": curves,
    }


# ── helpers ────────────────────────────────────────────────────────────────

def _extract_srel_key(raw: str) -> str:
    """Extract the SREL key from a Parameter Key column value.

    '§SREL: G.VLE0.01' → 'G.VLE0.01'
    'G.VLE0.01'        → 'G.VLE0.01'  (already clean)
    ''                 → ''
    """
    if not raw:
        return ""
    m = re.search(r"SREL:\s*(.+)", raw.strip(), re.IGNORECASE)
    return m.group(1).strip() if m else raw.strip()


def _norm_col(raw: str) -> str:
    """Normalise a header cell: strip, collapse 'Diagram- Name' → 'Diagram-Name'."""
    return raw.strip().replace("- ", "-").replace(" -", "-")


def _decode(data: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return data.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    raise ValueError("Cannot decode SREL file — unknown encoding")


def _empty(filename: str) -> dict[str, Any]:
    return {
        "turbine_name": os.path.splitext(os.path.basename(filename))[0],
        "turbine_type": "SGT",
        "parameters": [],
        "curves": [],
    }
