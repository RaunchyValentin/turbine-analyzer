import React, { useEffect, useState, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import client from '../api/client'

const GRID_CSS = `
.xls-grid.ag-theme-alpine {
  --ag-font-size: 12px;
  --ag-font-family: Consolas, 'Courier New', monospace;
  --ag-row-height: 22px;
  --ag-header-height: 26px;
  --ag-cell-horizontal-padding: 5px;
  --ag-background-color: #ffffff;
  --ag-odd-row-background-color: #f5f7f5;
  --ag-header-background-color: #d0ddd0;
  --ag-header-foreground-color: #1a2a1a;
  --ag-foreground-color: #1a1a1a;
  --ag-row-hover-color: #e0eed0;
  --ag-selected-row-background-color: #c8e6c9;
  --ag-border-color: #b0c4b0;
  --ag-row-border-color: #dde8dd;
  --ag-header-column-separator-color: #a0b4a0;
  --ag-header-column-separator-display: block;
  --ag-header-column-separator-height: 60%;
  --ag-cell-widget-spacing: 4px;
  --ag-secondary-foreground-color: #444;
  --ag-disabled-foreground-color: #888;
}
.xls-grid .ag-cell {
  border-right: 1px solid #dde8dd !important;
  line-height: 21px;
  color: #1a1a1a;
}
.xls-grid .ag-header-cell {
  border-right: 1px solid #a0b4a0 !important;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #1a2a1a;
}
.xls-grid .ag-root-wrapper {
  border: 1px solid #b0c4b0;
}
.xls-grid .ag-paging-panel {
  height: 28px;
  font-size: 11px;
  border-top: 1px solid #b0c4b0;
  color: #333;
  background: #eef3ee;
}
`

function raw(...keys) {
  return (p) => {
    const r = p.data?._raw
    if (!r) return ''
    for (const k of keys) {
      const v = r[k]
      if (v !== undefined && v !== '') return v
    }
    return ''
  }
}

const COL_DEFS = [
  { headerName: 'Tag-Name',      valueGetter: raw('Tag-Name', 'TagName'),                                      minWidth: 140, flex: 2, sortable: true, filter: true },
  { headerName: 'Port-Name',     valueGetter: raw('Port-Name', 'PortName'),                                    minWidth: 90,  flex: 1, sortable: true, filter: true },
  { headerName: 'Port-ID',       valueGetter: raw('Port-ID', 'PortID'),                                        minWidth: 58,  width: 58, sortable: true, filter: true },
  { headerName: 'Designation',   valueGetter: raw('Designation'),                                              minWidth: 130, flex: 2, sortable: true, filter: true },
  { headerName: 'Signal Name',   valueGetter: raw('Signal Name', 'Signal-Name', 'SignalName'),                 minWidth: 130, flex: 2, sortable: true, filter: true },
  { field: 'value', headerName: 'Value',                                                                       minWidth: 72,  flex: 1, sortable: true, filter: true },
  { headerName: 'Parameter Key', valueGetter: raw('Parameter Key', 'Parameter-Key', 'ParameterKey'),          minWidth: 120, flex: 1, sortable: true, filter: true },
  { headerName: 'Var min',       valueGetter: raw('Variation min', 'Variation-Min', 'Variation Min', 'VarMin'), minWidth: 72, flex: 1, sortable: true, filter: true },
  { headerName: 'Var max',       valueGetter: raw('Variation max', 'Variation-Max', 'Variation Max', 'VarMax'), minWidth: 72, flex: 1, sortable: true, filter: true },
]

const DEFAULT_COL = { resizable: true, suppressMovable: false }

function parseRows(raw_rows) {
  return raw_rows.map((r) => {
    let parsed = {}
    if (r.raw_data) {
      try { parsed = typeof r.raw_data === 'object' ? r.raw_data : JSON.parse(r.raw_data) } catch (_) {}
    }
    return { ...r, _raw: parsed }
  })
}

const TB = { padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#eef3ee', border: '1px solid #b0c4b0', color: '#1a2a1a', borderRadius: 2, cursor: 'pointer' }

export default function Dashboard() {
  const [turbines, setTurbines]       = useState([])
  const [selectedId, setSelectedId]   = useState(null)
  const [rows, setRows]               = useState([])
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(false)
  const [kksPrefixes, setKksPrefixes] = useState([])
  const [kksFilter, setKksFilter]     = useState('')
  const [srelOnly, setSrelOnly]       = useState(false)

  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = GRID_CSS
    document.head.appendChild(el)
    return () => document.head.removeChild(el)
  }, [])

  useEffect(() => {
    client.get('/turbines/list').then((r) => {
      setTurbines(r.data)
      if (r.data.length > 0) setSelectedId(r.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    setKksPrefixes([])
    setKksFilter('')
    Promise.all([
      client.get('/parameters', { params: { turbine_id: selectedId } }),
      client.get('/db/kks-prefixes'),
    ]).then(([pRes, pfxRes]) => {
      setRows(parseRows(pRes.data))
      const turbineStats = pfxRes.data.find(t => t.turbine_id === selectedId)
      if (turbineStats) {
        const pfxs = turbineStats.prefixes.filter(p => p.prefix !== 'empty' && p.prefix !== 'other')
        setKksPrefixes(pfxs)
        if (pfxs.length === 1 && pfxs[0].count > turbineStats.total * 0.25) {
          setKksFilter(pfxs[0].prefix)
        }
      }
    }).finally(() => setLoading(false))
  }, [selectedId])

  const filtered = useMemo(() => {
    let r = rows
    if (srelOnly) {
      r = r.filter(row => /srel:/i.test(row._raw?.['Parameter Key'] || ''))
    }
    if (kksFilter) {
      r = r.filter(row => (row.kks || '').toUpperCase().startsWith(kksFilter.toUpperCase()))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter((row) => {
        const rd = row._raw || {}
        return (
          (rd['Tag-Name'] || rd['TagName'] || '').toLowerCase().includes(q) ||
          (rd['Port-Name'] || rd['PortName'] || '').toLowerCase().includes(q) ||
          (rd['Designation'] || '').toLowerCase().includes(q) ||
          (rd['Signal Name'] || rd['Signal-Name'] || '').toLowerCase().includes(q) ||
          (row.value || '').toLowerCase().includes(q) ||
          (rd['Parameter Key'] || rd['Parameter-Key'] || '').toLowerCase().includes(q)
        )
      })
    }
    return r
  }, [rows, search, kksFilter, srelOnly])

  const selected  = turbines.find((t) => t.id === selectedId)
  const mixedData = kksPrefixes.length > 1
  const srelCount = useMemo(() => rows.filter(r => /srel:/i.test(r._raw?.['Parameter Key'] || '')).length, [rows])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', height: 'calc(100vh - 72px)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.25rem 0' }}>
        <select
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(Number(e.target.value))}
          style={{ ...TB, cursor: 'default', minWidth: 240 }}
        >
          {turbines.length === 0 && <option value="">No turbines — import a file first</option>}
          {turbines.map((t) => (
            <option key={t.id} value={t.id}>{t.project_name} / {t.name}</option>
          ))}
        </select>

        {/* All / SREL toggle */}
        <div style={{ display: 'flex', border: '1px solid #b0c4b0', borderRadius: 2, overflow: 'hidden', fontSize: '0.78rem' }}>
          <button
            onClick={() => setSrelOnly(false)}
            style={{ ...TB, border: 'none', borderRadius: 0, background: !srelOnly ? '#b8d4b8' : '#eef3ee', color: !srelOnly ? '#1a3a1a' : '#5a7a5a', fontWeight: !srelOnly ? 600 : 400 }}
          >
            All ports ({rows.length.toLocaleString()})
          </button>
          <button
            onClick={() => setSrelOnly(true)}
            style={{ ...TB, border: 'none', borderRadius: 0, borderLeft: '1px solid #b0c4b0', background: srelOnly ? '#b8d4b8' : '#eef3ee', color: srelOnly ? '#1a3a1a' : '#5a7a5a', fontWeight: srelOnly ? 600 : 400 }}
          >
            With SREL key ({srelCount.toLocaleString()})
          </button>
        </div>

        {/* KKS prefix filter — shown only when turbine has mixed data */}
        {kksPrefixes.length > 1 && (
          <select
            value={kksFilter}
            onChange={e => setKksFilter(e.target.value)}
            style={{ ...TB, cursor: 'default', background: kksFilter ? '#1a2a1a' : '#2a1a1a', borderColor: kksFilter ? '#4caf7d' : '#e57373' }}
            title="Filter by KKS prefix"
          >
            <option value="">⚠ Mixed — all</option>
            {kksPrefixes.map(({ prefix, count }) => (
              <option key={prefix} value={prefix}>{prefix}… ({count.toLocaleString()})</option>
            ))}
          </select>
        )}

        <span style={{ fontSize: '0.75rem', color: mixedData && !kksFilter ? '#c0392b' : '#3a5a3a' }}>
          {filtered.length.toLocaleString()} rows
          {mixedData && !kksFilter ? ' ⚠ mixed' : ''}
        </span>

        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...TB, cursor: 'text', width: 180, outline: 'none' }}
        />

        {loading && <span style={{ fontSize: '0.75rem', color: '#7a9a7a' }}>Loading…</span>}
      </div>

      {/* Grid */}
      <div className="ag-theme-alpine xls-grid" style={{ flex: 1, width: '100%' }}>
        <AgGridReact
          rowData={filtered}
          columnDefs={COL_DEFS}
          defaultColDef={DEFAULT_COL}
          rowHeight={22}
          headerHeight={26}
          pagination
          paginationPageSize={500}
          suppressCellFocus
          enableCellTextSelection
        />
      </div>
    </div>
  )
}
