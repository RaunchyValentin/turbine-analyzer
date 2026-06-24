"""
Parser for CSV/TXT experimental data point files.
"""
from typing import Any
import io
import csv


def parse_csv(file_bytes: bytes, filename: str, delimiter: str = ",") -> dict[str, Any]:
    """
    Parse a CSV/TXT file with XY point data.

    Expects two columns: x, y (with or without header row).

    Returns:
        {
            "label": str,
            "points": [{"x": float, "y": float, "order": int}, ...]
        }
    """
    text = file_bytes.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    rows = list(reader)

    points = []
    order = 0
    for row in rows:
        if len(row) < 2:
            continue
        try:
            x = float(row[0].strip())
            y = float(row[1].strip())
            points.append({"x": x, "y": y, "order": order})
            order += 1
        except ValueError:
            continue  # skip header or non-numeric rows

    return {"label": filename, "points": points}
