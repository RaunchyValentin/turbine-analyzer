import io
import json
import re
import zipfile
from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert
from datetime import date

from database import get_db
from models import Project, Turbine, Parameter, Curve, CurvePoint
from parsers import (
    parse_jar, parse_srel_excel, parse_excel, parse_csv,
    is_srel_csv, is_srel_excel,
)

router = APIRouter(tags=["import"])

_DATE_PATTERNS = [
    (re.compile(r'(\d{2})\.(\d{2})\.(\d{4})'), lambda m: f"{m.group(3)}-{m.group(2)}-{m.group(1)}"),  # DD.MM.YYYY
    (re.compile(r'(\d{4})[-_](\d{2})[-_](\d{2})'), lambda m: f"{m.group(1)}-{m.group(2)}-{m.group(3)}"),  # YYYY-MM-DD
    (re.compile(r'(\d{2})-(\d{2})-(\d{4})'), lambda m: f"{m.group(3)}-{m.group(2)}-{m.group(1)}"),  # DD-MM-YYYY
]


def _extract_file_date(filename: str) -> str | None:
    for pattern, formatter in _DATE_PATTERNS:
        m = pattern.search(filename)
        if m:
            return formatter(m)
    return None

_SCALAR_FIELDS = {"kks", "name", "value", "unit", "data_type", "group", "description"}
_BATCH_SIZE = 2000


async def _bulk_insert_params(db: AsyncSession, turbine_id: int, source: str, params: list[dict]):
    """Insert parameters in batches for performance."""
    rows = []
    for p in params:
        raw = p.get("raw_data")
        row = {k: v for k, v in p.items() if k in _SCALAR_FIELDS}
        row["turbine_id"] = turbine_id
        row["source"] = source
        row["raw_data"] = json.dumps(raw, ensure_ascii=False) if raw else None
        rows.append(row)
    for i in range(0, len(rows), _BATCH_SIZE):
        await db.execute(insert(Parameter), rows[i:i + _BATCH_SIZE])


_TAG_RE  = re.compile(rb'<name\b[^>]*\btag="([^"]+)"')
_WORD_RE = re.compile(rb'(?:^|[,;\t])(\d{2}[A-Z]{2,}[^\s,;\t|]*)', re.MULTILINE)
_NUM_PFX = re.compile(r'^(\d+)')


def _add_prefix(counts: dict, tag: str) -> None:
    m = _NUM_PFX.match(tag)
    if m:
        pfx = m.group(1)
        counts[pfx] = counts.get(pfx, 0) + 1


def _scan_kks_prefixes(content: bytes) -> list[dict]:
    """Fast scan of JAR: extract leading KKS unit prefixes from all sources."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except Exception:
        return []

    counts: dict[str, int] = {}
    with zf:
        names = zf.namelist()

        # 1. icdiagram.xml — <name tag="KKS"> attributes
        for name in names:
            if not name.lower().endswith("icdiagram.xml"):
                continue
            try:
                data = zf.read(name)
            except Exception:
                continue
            for m in _TAG_RE.finditer(data):
                _add_prefix(counts, m.group(1).decode("utf-8", errors="ignore"))

        # 2. CSV/SREL/TXT — first token on each line that looks like KKS
        if not counts:
            for name in names:
                if not name.lower().endswith((".csv", ".srel", ".txt")):
                    continue
                try:
                    data = zf.read(name)[:65536]   # first 64 KB is enough
                except Exception:
                    continue
                for m in _WORD_RE.finditer(data):
                    _add_prefix(counts, m.group(1).decode("utf-8", errors="ignore"))

    return sorted(
        [{"prefix": k, "count": v} for k, v in counts.items()],
        key=lambda x: -x["count"],
    )


@router.post("/import/detect-prefixes")
async def detect_prefixes(file: UploadFile = File(...)):
    """Quickly scan a JAR and return detected KKS unit prefixes with tag counts."""
    content = await file.read()
    fn = (file.filename or "").lower()
    if not fn.endswith(".jar"):
        return []
    return _scan_kks_prefixes(content)


def _dispatch(content: bytes, filename: str) -> tuple[dict, str]:
    """
    Select and run the correct parser.  Returns (data, source_label).

    Routing:
      .jar / .srel          → JAR/SREL parser (CSV path)
      .csv  / .txt          → SREL if header matches, else XY CSV
      .xlsx / .xls          → SREL if Diagram column found, else generic Excel
    """
    fn = (filename or "").lower()

    if fn.endswith(".jar"):
        return parse_jar(content, filename), "jar"

    if fn.endswith(".srel"):
        return parse_jar(content, filename), "srel"

    if fn.endswith((".csv", ".txt")):
        if is_srel_csv(content):
            return parse_jar(content, filename), "srel"
        return parse_csv(content, filename), "csv"

    if fn.endswith((".xlsx", ".xls")):
        if is_srel_excel(content):
            return parse_srel_excel(content, filename), "srel"
        return parse_excel(content, filename), "excel"

    raise HTTPException(400, f"Unsupported file type: {filename}")


@router.post("/import/preview")
async def preview_file(file: UploadFile = File(...)):
    """Parse a file and return preview data without saving to DB."""
    content = await file.read()
    try:
        data, _ = _dispatch(content, file.filename or "")
    except NotImplementedError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Parse error: {e}")
    return data


@router.post("/import/save")
async def save_import(
    turbine_id: int = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Parse a file and persist all columns to the given turbine."""
    content = await file.read()
    filename = file.filename or ""

    turbine = await db.get(Turbine, turbine_id)
    if not turbine:
        raise HTTPException(404, "Turbine not found")

    data, source = _dispatch(content, filename)

    await _bulk_insert_params(db, turbine_id, source, data.get("parameters", []))

    for c in data.get("curves", []):
        curve = Curve(turbine_id=turbine_id, name=c["name"], description=c.get("description", ""))
        db.add(curve)
        await db.flush()
        for i, pt in enumerate(c.get("points", [])):
            db.add(CurvePoint(curve_id=curve.id, x=pt["x"], y=pt["y"], order=i))

    turbine.source_file = filename
    turbine.file_date = _extract_file_date(filename)
    turbine.imported_at = date.today()
    await db.commit()
    return {
        "status": "ok",
        "parameters": len(data.get("parameters", [])),
        "curves": len(data.get("curves", [])),
    }


def _save_data(turbine_id: int, data: dict, source: str):
    """Yield ORM objects to add (used by both save and create endpoints)."""
    objects = []
    for p in data.get("parameters", []):
        raw = p.get("raw_data")
        objects.append(Parameter(
            turbine_id=turbine_id,
            source=source,
            raw_data=json.dumps(raw, ensure_ascii=False) if raw else None,
            **{k: v for k, v in p.items() if k in _SCALAR_FIELDS},
        ))
    return objects


@router.post("/import/create")
async def create_and_import(
    project_name: str = Form(...),
    turbine_name: str = Form(...),
    file: UploadFile = File(...),
    kks_prefix: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    """One-shot: find-or-create project, create turbine, parse and save."""
    content = await file.read()
    filename = file.filename or ""

    # Duplicate check: same project + turbine + file_date
    file_date = _extract_file_date(filename)
    if file_date:
        dup = await db.execute(
            select(Turbine)
            .join(Project, Turbine.project_id == Project.id)
            .where(Project.name == project_name)
            .where(Turbine.name == turbine_name)
            .where(Turbine.file_date == file_date)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(
                409,
                f"File dated {file_date} is already imported for {project_name} / {turbine_name}. "
                "Delete the existing entry first or use a file with a different date."
            )

    try:
        data, source = _dispatch(content, filename)
    except NotImplementedError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Parse error: {e}")

    # Find or create project
    result = await db.execute(select(Project).where(Project.name == project_name))
    project = result.scalar_one_or_none()
    if not project:
        project = Project(name=project_name, description=None, created_at=date.today())
        db.add(project)
        await db.flush()

    # Create turbine
    turbine = Turbine(
        project_id=project.id,
        name=turbine_name,
        source_file=filename,
        file_date=file_date,
        imported_at=date.today(),
    )
    db.add(turbine)
    await db.flush()

    # Filter by KKS prefix if specified
    params = data.get("parameters", [])
    pfx = kks_prefix.strip().upper()
    if pfx:
        params = [
            p for p in params
            if (p.get("kks") or "").upper().startswith(pfx)
            or (
                isinstance(p.get("raw_data"), dict)
                and (p["raw_data"].get("Tag-Name") or "").upper().startswith(pfx)
            )
        ]

    # Save parameters
    await _bulk_insert_params(db, turbine.id, source, params)

    # Save curves
    for c in data.get("curves", []):
        curve = Curve(turbine_id=turbine.id, name=c["name"], description=c.get("description", ""))
        db.add(curve)
        await db.flush()
        for i, pt in enumerate(c.get("points", [])):
            db.add(CurvePoint(curve_id=curve.id, x=pt["x"], y=pt["y"], order=i))

    await db.commit()
    return {
        "status": "ok",
        "project_id": project.id,
        "project_name": project_name,
        "turbine_id": turbine.id,
        "turbine_name": turbine_name,
        "parameters": len(params),
        "curves": len(data.get("curves", [])),
        "kks_prefix": pfx or None,
    }