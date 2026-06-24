"""
Excel export with defined output structure.
"""
from typing import Any
import io
import pandas as pd


def export_parameters_to_excel(
    turbines: list[dict[str, Any]],
    parameters_per_turbine: list[list[dict[str, Any]]],
) -> bytes:
    """
    Export parameters for one or more turbines to .xlsx.

    Returns raw bytes of the Excel file.
    """
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        for turbine, params in zip(turbines, parameters_per_turbine):
            sheet_name = turbine.get("name", "Turbine")[:31]
            df = pd.DataFrame(params, columns=["kks", "name", "value", "unit", "data_type", "group", "source"])
            df.to_excel(writer, sheet_name=sheet_name, index=False)
    return output.getvalue()


def export_comparison_to_excel(comparison_rows: list[dict[str, Any]], turbine_names: list[str]) -> bytes:
    """Export a comparison result to .xlsx."""
    output = io.BytesIO()
    records = []
    for row in comparison_rows:
        record: dict[str, Any] = {"key": row["key"], "diff": row["color"]}
        for i, param in enumerate(row["params"]):
            name = turbine_names[i] if i < len(turbine_names) else f"Turbine {i+1}"
            record[f"{name}_value"] = param.get("value", "") if param else ""
            record[f"{name}_unit"] = param.get("unit", "") if param else ""
        records.append(record)
    df = pd.DataFrame(records)
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Comparison", index=False)
    return output.getvalue()
