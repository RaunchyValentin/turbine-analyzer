"""
Parser for SPPA-T3000 JAR/SREL files.

Supported inputs:
  .csv / .srel  — SREL CSV export (plain text)
  .xlsx / .xls  — SREL Excel export
  .jar          — ZIP archive from T3000 engineering station containing
                  CSV, Excel or XML SREL data files
"""
from __future__ import annotations
import io
import os
import re
import zipfile
import xml.etree.ElementTree as ET
from typing import Any

from .srel_parser import parse_srel, parse_srel_excel, is_srel_csv, is_srel_excel


def parse_jar(file_bytes: bytes, filename: str = "") -> dict[str, Any]:
    fname = (filename or "").lower()

    if fname.endswith((".csv", ".srel", ".txt")):
        return parse_srel(file_bytes, filename)

    if fname.endswith((".xlsx", ".xls")):
        return parse_srel_excel(file_bytes, filename)

    # Binary .jar  →  try as ZIP archive
    return _parse_zip(file_bytes, filename)


# ── ZIP handling ────────────────────────────────────────────────────────────

def _parse_zip(file_bytes: bytes, outer_filename: str) -> dict[str, Any]:
    turbine_name = os.path.splitext(os.path.basename(outer_filename))[0] or "Unknown"

    try:
        zf = zipfile.ZipFile(io.BytesIO(file_bytes))
    except zipfile.BadZipFile:
        # Some T3000 exports are plain CSV despite the .jar extension
        if is_srel_csv(file_bytes):
            return parse_srel(file_bytes, outer_filename)
        raise ValueError(
            "File is not a valid ZIP/JAR archive and not a SREL CSV. "
            "Please export as SREL CSV or Excel from the T3000 engineering station."
        )

    all_params: list[dict] = []
    all_curves: list[dict] = []

    with zf:
        names = zf.namelist()

        csv_names  = [n for n in names if n.lower().endswith((".csv", ".srel", ".txt"))]
        xl_names   = [n for n in names if n.lower().endswith((".xlsx", ".xls"))]
        ic_names_check = [n for n in names if n.lower().endswith("icdiagram.xml")]

        for inner in csv_names:
            content = zf.read(inner)
            if is_srel_csv(content):
                r = parse_srel(content, inner)
                all_params.extend(r.get("parameters", []))
                all_curves.extend(r.get("curves", []))

        for inner in xl_names:
            content = zf.read(inner)
            if is_srel_excel(content):
                r = parse_srel_excel(content, inner)
                all_params.extend(r.get("parameters", []))
                all_curves.extend(r.get("curves", []))

        # SREL XML only when archive has no icdiagram.xml (not a T3000 project JAR)
        if not all_params and not ic_names_check:
            srel_xml_names = [
                n for n in names
                if n.lower().endswith(".xml")
                and not n.lower().endswith("node.xml")
            ]
            for inner in srel_xml_names:
                content = zf.read(inner)
                try:
                    r = _parse_srel_xml(content, inner)
                    all_params.extend(r.get("parameters", []))
                    all_curves.extend(r.get("curves", []))
                except Exception:
                    pass

        # T3000 project JAR: parse icdiagram.xml blocks
        if not all_params and not all_curves:
            # Build folder → designation map from ALL node.xml files in the archive
            desig_map: dict[str, str] = {}
            for n in names:
                if n.lower().endswith("node.xml"):
                    folder_key = (n.rsplit("/", 1)[0] if "/" in n else "").lower()
                    try:
                        desig = _extract_node_designation(zf.read(n))
                        if desig:
                            desig_map[folder_key] = desig
                    except Exception:
                        pass

            ic_names = [n for n in names if n.lower().endswith("icdiagram.xml")]
            for inner in ic_names:
                content = zf.read(inner)
                # Walk up the folder tree to find the nearest §Designation
                folder = inner.rsplit("/", 1)[0] if "/" in inner else ""
                page_desc = ""
                parts = folder.split("/")
                for depth in range(len(parts), 0, -1):
                    candidate = "/".join(parts[:depth]).lower()
                    if candidate in desig_map:
                        page_desc = desig_map[candidate]
                        break
                try:
                    r = _parse_icdiagram(content, inner, page_desc)
                    all_params.extend(r.get("parameters", []))
                    all_curves.extend(r.get("curves", []))
                except Exception:
                    pass

    if not all_params and not all_curves:
        raise ValueError(
            "No parameter data found inside the JAR archive. "
            f"Files inside: {', '.join(zf.namelist()[:10])}"
        )

    return {
        "turbine_name": turbine_name,
        "turbine_type": "SGT",
        "parameters": all_params,
        "curves": all_curves,
    }


# ── XML handling ────────────────────────────────────────────────────────────

# Map of XML tag names (case-insensitive) → Parameter field
_XML_FIELD_MAP = {
    "diagramname":  "group",
    "diagram-name": "group",
    "diagram_name": "group",
    "symboltype":   "data_type",
    "symbol-type":  "data_type",
    "symbol_type":  "data_type",
    "tagname":      "kks",
    "tag-name":     "kks",
    "tag_name":     "kks",
    "portname":     "name",
    "port-name":    "name",
    "port_name":    "name",
    "value":        "value",
    "eu":           "unit",
    "unit":         "unit",
    "description":  "description",
}

# Element names that represent a single parameter row
_ROW_TAGS = {"parameter", "param", "row", "entry", "record", "srel", "item"}


def _parse_srel_xml(content: bytes, filename: str = "") -> dict[str, Any]:
    """
    Best-effort parser for T3000 XML SREL exports.
    Handles both flat (<Parameter>…</Parameter>) and attribute-based layouts.
    """
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        raise ValueError(f"XML parse error in {filename}: {e}")

    parameters: list[dict] = []

    # Collect all elements that look like parameter rows
    row_elements = _find_row_elements(root)

    for elem in row_elements:
        p = _elem_to_param(elem)
        if p.get("kks") or p.get("value"):
            p["source"] = "srel"
            parameters.append(p)

    turbine_name = os.path.splitext(os.path.basename(filename))[0]
    return {
        "turbine_name": turbine_name,
        "turbine_type": "SGT",
        "parameters": parameters,
        "curves": [],
    }


def _find_row_elements(root: ET.Element) -> list[ET.Element]:
    """Return all elements that look like parameter rows."""
    results: list[ET.Element] = []

    def walk(el: ET.Element):
        tag_lower = el.tag.lower().split("}")[-1]  # strip namespace
        if tag_lower in _ROW_TAGS and len(el) > 0:
            results.append(el)
        else:
            for child in el:
                walk(child)

    walk(root)

    # Fallback: if no known row tags found, use all direct children of root
    if not results:
        for child in root:
            if len(child) > 0:
                results.append(child)

    return results


def _elem_to_param(elem: ET.Element) -> dict:
    """Convert an XML element to a parameter dict by matching child tag names."""
    p: dict[str, Any] = {}
    raw: dict[str, str] = {}

    # Check child elements
    for child in elem:
        tag = child.tag.lower().split("}")[-1]
        text = (child.text or "").strip()
        raw[tag] = text
        field = _XML_FIELD_MAP.get(tag)
        if field and text:
            p[field] = text

    # Check attributes too (some exports use attributes instead of child elements)
    for attr, val in elem.attrib.items():
        tag = attr.lower()
        raw[tag] = val
        field = _XML_FIELD_MAP.get(tag)
        if field and val:
            p.setdefault(field, val)

    # Build full name = kks|port if both present
    if p.get("kks") and p.get("name") and "|" not in p["name"]:
        p["name"] = f"{p['kks']}|{p['name']}"

    p["raw_data"] = raw
    return p


# ── icdiagram.xml parser (T3000 project JAR) ────────────────────────────────

_NUMERIC_RE = re.compile(r"^-?\d+(\.\d+)?([eE][+-]?\d+)?$")
_SREL_RE    = re.compile(r"SREL:\s*(.+)", re.IGNORECASE)
_PLI_TYPES  = {"PLI10", "PLI20", "PLI05", "PLI", "POLY"}


def _extract_node_designation(content: bytes) -> str:
    """
    Read node.xml and return the §Designation property value (e.g. 'POSN VLV D/STR GAS DR').

    Actual node.xml structure (T3000):
      <ImportNode>
        <context>
          <key>Â§Designation</key><value>POSN VLV D/STR GAS DR</value>
          ...
        </context>
      </ImportNode>

    Keys and values are sibling elements inside <context>.
    The § sign may appear as Â§ due to double-UTF-8 encoding in the source file.
    """
    # Strip DOCTYPE declaration to avoid external DTD resolution
    clean = re.sub(rb'<!DOCTYPE[^>]*>', b'', content)
    try:
        root = ET.fromstring(clean)
    except ET.ParseError:
        return ""

    # Find <context> anywhere in the tree
    ctx = root.find(".//context")
    if ctx is None:
        return ""

    children = list(ctx)
    for i, el in enumerate(children):
        if el.tag != "key":
            continue
        key_text = (el.text or "").strip()
        # Match §Designation regardless of § encoding variant
        if key_text.endswith("Designation") and i + 1 < len(children) and children[i + 1].tag == "value":
            return (children[i + 1].text or "").strip()

    return ""


def _parse_icdiagram(content: bytes, filepath: str = "", page_description: str = "") -> dict[str, Any]:
    """
    Parse a T3000 icdiagram.xml file and extract settable parameters.

    Each <afi> block represents one function block instance.
    Parameter ports have a numeric `parameter` attribute and a §SREL key
    in the <context> block.
    """
    try:
        root = ET.fromstring(content)
    except ET.ParseError:
        return {"parameters": [], "curves": []}

    # Diagram name from path: "G1/AP1/SW/MBY/31MBY10DU050C@IC/icdiagram.xml"
    parts = filepath.replace("\\", "/").split("/")
    diagram_name = ""
    for p in reversed(parts):
        if "@IC" in p or "@ic" in p:
            diagram_name = p.split("@")[0]
            break
    if not diagram_name and len(parts) >= 2:
        diagram_name = parts[-2]

    parameters: list[dict] = []
    curves_acc: dict[str, dict] = {}

    for afi in root.iter("afi"):
        afi_designation = afi.get("designation", "") or page_description or diagram_name
        name_el = afi.find("name")
        if name_el is None:
            continue
        tag_name = name_el.get("tag", "")
        item_name = name_el.get("item", "")

        # Build context map: "@portId" → raw value string
        ctx: dict[str, str] = {}
        ctx_el = afi.find("context")
        if ctx_el is not None:
            keys   = [el.text or "" for el in ctx_el if el.tag == "key"]
            values = [el.text or "" for el in ctx_el if el.tag == "value"]
            for k, v in zip(keys, values):
                ctx[k.strip()] = v.strip()

        # Collect signal info from output port sigdefs
        # Signal Name = "KKS|signal" (e.g. "42MBY10DT010|U220"), not sigdef.designation
        # sigdef.designation is the IC page description — same as afi_designation, not useful here
        sig_tagname = sig_signal = ""
        for port in afi.findall("port"):
            sigdef = port.find("sigdef")
            if sigdef is not None and not sig_tagname:
                sig_tagname = sigdef.get("tagname", "")
                sig_signal  = sigdef.get("signal", "")

        # Skip AFI blocks with no KKS tag — nothing to identify them by
        if not tag_name:
            continue

        # Process each port
        for port in afi.findall("port"):
            param_val = port.get("parameter", "")
            if not param_val or param_val.lower() == "false":
                continue

            port_id_el = port.find("portIdentifier/portId")
            port_id = port_id_el.text.strip() if port_id_el is not None and port_id_el.text else ""

            ctx_key  = f"@{port_id}"
            raw_srel = ctx.get(ctx_key, "")

            # Skip pure display/text context entries
            if raw_srel.strip().lower() in ("text:", "text"):
                continue

            m = _SREL_RE.search(raw_srel)
            srel_key = m.group(1).strip() if m else raw_srel.strip()

            # param_val must be numeric or boolean "true"
            # String values like "Time Signal", "FO CONSUM..." are text elements, not parameters
            is_numeric = bool(_NUMERIC_RE.match(param_val))
            is_bool = param_val.lower() == "true"
            if not is_numeric and not is_bool and not srel_key:
                continue

            var_el  = port.find("variation")
            eu      = var_el.get("engUnit", "") if var_el is not None else ""

            is_visible   = port.get("isvisible", "false")
            par_visible  = port.get("parVisible", "false")
            is_archive   = port.get("isarchive", "false")

            # Port-Name: use item_name (block port), append portId to distinguish
            # multiple settable ports within the same AFI block
            port_name = f"{item_name}.{port_id}" if item_name and port_id else (item_name or port_id)

            raw_data = {
                "Tag-Name":        tag_name,
                "Port-Name":       port_name,
                "Designation":     afi_designation,
                "Signal Name":     f"{sig_tagname}|{sig_signal}" if sig_tagname and sig_signal else sig_tagname,
                "Signal Tag Name": sig_tagname,
                "Signal Item":     sig_signal,
                "Value":           param_val,
                "Parameter Key":   raw_srel,
                "EU":              eu,
                "Visible Port":    is_visible,
                "Visible Parameter": par_visible,
                "Archive":         is_archive,
                "Diagram-Name":    diagram_name,
            }

            kks = srel_key if srel_key else (f"{tag_name}|{port_name}" if port_name else tag_name)
            parameters.append({
                "kks":         kks,
                "name":        f"{tag_name}|{port_name}" if port_name else tag_name,
                "value":       param_val,
                "unit":        eu,
                "group":       diagram_name,
                "description": afi_designation,
                "source":      "jar",
                "raw_data":    raw_data,
            })

    return {"parameters": parameters, "curves": []}
