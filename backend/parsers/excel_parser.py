"""
Parser for generic flat Excel workbooks (.xlsx/.xls).

Expected columns: kks, name, value, unit, data_type, group
Any extra columns are preserved in raw_data.
"""
from typing import Any
import pandas as pd
import io


def parse_excel(file_bytes: bytes, filename: str) -> dict[str, Any]:
    """
    Parse a flat Excel workbook.

    Required columns: kks, name, value, unit, data_type, group.
    All other columns are captured in raw_data (JSON-ready dict).

    Returns:
        {"parameters": [...], "curves": []}
    """
    df = pd.read_excel(io.BytesIO(file_bytes), dtype=str, keep_default_na=False)

    parameters = []
    for _, row in df.iterrows():
        row_dict = {str(k): str(v) for k, v in row.items() if str(v).strip()}
        parameters.append({
            "kks":       row_dict.get("kks", ""),
            "name":      row_dict.get("name", ""),
            "value":     row_dict.get("value", ""),
            "unit":      row_dict.get("unit", ""),
            "data_type": row_dict.get("data_type", "STRING"),
            "group":     row_dict.get("group", ""),
            "source":    "excel",
            "description": row_dict.get("description", ""),
            "raw_data":  row_dict,
        })

    return {"parameters": parameters, "curves": []}
