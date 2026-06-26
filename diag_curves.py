"""
Диагностика PLI/POLY блоков в T3000 JAR.
Использование: python diag_curves.py path\to\file.jar
"""
import io, re, sys, zipfile, xml.etree.ElementTree as ET

PLI_RE = re.compile(r'PLI|POLY|PLY', re.IGNORECASE)
JAR = sys.argv[1] if len(sys.argv) > 1 else None
if not JAR:
    print("Usage: python diag_curves.py <file.jar>"); sys.exit(1)

zf = zipfile.ZipFile(JAR)
ic_names = [n for n in zf.namelist() if n.lower().endswith('icdiagram.xml')]
print(f"icdiagram.xml files: {len(ic_names)}\n")

found = 0
for ic_path in ic_names:
    try:
        root = ET.fromstring(zf.read(ic_path))
    except ET.ParseError:
        continue

    for afi in root.iter('afi'):
        name_el = afi.find('name')
        if name_el is None:
            continue

        tag   = name_el.get('tag', '')
        item  = name_el.get('item', '')
        atype = name_el.get('type', '') or afi.get('type', '') or afi.get('symboltype', '')

        # Match PLI/POLY by type attribute or item name
        is_pli = PLI_RE.search(atype) or PLI_RE.search(item)
        if not is_pli:
            continue

        found += 1
        if found > 20:
            print("... (showing first 20 PLI blocks)")
            break

        print(f"=== PLI block #{found} ===")
        print(f"  File  : {ic_path}")
        print(f"  tag   : {tag!r}")
        print(f"  item  : {item!r}")
        print(f"  type  : {atype!r}")
        print(f"  afi attribs: {dict(afi.attrib)}")
        print(f"  name attribs: {dict(name_el.attrib)}")

        # Context
        ctx = {}
        ctx_el = afi.find('context')
        if ctx_el is not None:
            keys   = [e.text or '' for e in ctx_el if e.tag == 'key']
            values = [e.text or '' for e in ctx_el if e.tag == 'value']
            ctx = dict(zip(keys, values))
            print(f"  context ({len(ctx)} entries):")
            for k, v in list(ctx.items())[:20]:
                print(f"    {k!r}: {v!r}")

        # Ports
        ports = afi.findall('port')
        print(f"  ports ({len(ports)}):")
        for p in ports[:20]:
            pid_el = p.find('portIdentifier/portId')
            pid    = pid_el.text.strip() if pid_el is not None and pid_el.text else '?'
            pval   = p.get('parameter', '')
            annot  = ctx.get(f'@{pid}', '')
            var_el = p.find('variation')
            eu     = var_el.get('engUnit', '') if var_el is not None else ''
            print(f"    portId={pid!r:8s}  parameter={pval!r:12s}  eu={eu!r:6s}  annotation={annot!r}")
        print()

    if found > 20:
        break

if found == 0:
    print("No PLI/POLY blocks found by type/item name.")
    print("Dumping first 3 AFI blocks to help identify structure:\n")
    for ic_path in ic_names[:3]:
        try:
            root = ET.fromstring(zf.read(ic_path))
        except ET.ParseError:
            continue
        for afi in list(root.iter('afi'))[:3]:
            name_el = afi.find('name')
            if name_el is None:
                continue
            print(f"File: {ic_path}")
            print(f"  afi attribs : {dict(afi.attrib)}")
            print(f"  name attribs: {dict(name_el.attrib)}")
            for p in afi.findall('port')[:5]:
                pid_el = p.find('portIdentifier/portId')
                pid = pid_el.text.strip() if pid_el is not None and pid_el.text else '?'
                print(f"    port attribs: {dict(p.attrib)}  portId={pid!r}")
            print()
