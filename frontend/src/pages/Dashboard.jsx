import React, { useEffect, useState, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import client from '../api/client'

// Extract a field from the pre-parsed _raw object, trying multiple key variants
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
  {
    headerName: 'Tag-Name',
    valueGetter: raw('Tag-Name', 'TagName'),
    minWidth: 140,
    flex: 2,
    sortable: true,
    filter: true,
  },
  {
    headerName: 'Port-Name',
    valueGetter: raw('Port-Name', 'PortName'),
    minWidth: 90,
    flex: 1,
    sortable: true,
    filter: true,
  },
  {
    headerName: 'Port-ID',
    valueGetter: raw('Port-ID', 'PortID'),
    minWidth: 70,
    width: 70,
    sortable: true,
    filter: true,
  },
  {
    headerName: 'Designation',
    valueGetter: raw('Designation'),
    minWidth: 120,
    flex: 2,
    sortable: true,
    filter: true,
  },
  {
    headerName: 'Signal Name',
    valueGetter: raw('Signal Name', 'Signal-Name', 'SignalName'),
    minWidth: 120,
    flex: 2,
    sortable: true,
    filter: true,
  },
  {
    field: 'value',
    headerName: 'Value',
    minWidth: 80,
    flex: 1,
    sortable: true,
    filter: true,
  },
  {
    headerName: 'Parameter Key',
    valueGetter: raw('Parameter Key', 'Parameter-Key', 'ParameterKey', 'Param-Key'),
    minWidth: 110,
    flex: 1,
    sortable: true,
    filter: true,
  },
  {
    headerName: 'Variation min',
    valueGetter: raw('Variation min', 'Variation-Min', 'Variation Min', 'Var-Min', 'VarMin'),
    minWidth: 100,
    flex: 1,
    sortable: true,
    filter: true,
  },
  {
    headerName: 'Variation max',
    valueGetter: raw('Variation max', 'Variation-Max', 'Variation Max', 'Var-Max', 'VarMax'),
    minWidth: 100,
    flex: 1,
    sortable: true,
    filter: true,
  },
]

const DEFAULT_COL = { resizable: true }

function parseRows(raw_rows) {
  return raw_rows.map((r) => {
    let parsed = {}
    if (r.raw_data) {
      try {
        parsed = typeof r.raw_data === 'object' ? r.raw_data : JSON.parse(r.raw_data)
      } catch (_) {}
    }
    return { ...r, _raw: parsed }
  })
}

export default function Dashboard() {
  const [turbines, setTurbines]     = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [rows, setRows]             = useState([])
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [kksPrefixes, setKksPrefixes] = useState([])  // [{prefix,count}] detected in current turbine
  const [kksFilter, setKksFilter]   = useState('')    // selected prefix filter

  // Load turbine list once
  useEffect(() => {
    client.get('/turbines/list').then((r) => {
      setTurbines(r.data)
      if (r.data.length > 0) setSelectedId(r.data[0].id)
    })
  }, [])

  // Load parameters + prefix stats when turbine changes
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
        // Auto-select only when a single numeric prefix covers most of the data (multi-GT import)
        if (pfxs.length === 1 && pfxs[0].count > turbineStats.total * 0.25) {
          setKksFilter(pfxs[0].prefix)
        }
      }
    }).finally(() => setLoading(false))
  }, [selectedId])

  // Client-side filter: KKS prefix + search
  const filtered = useMemo(() => {
    let r = rows
    if (kksFilter) {
      r = r.filter(row => (row.kks || '').toUpperCase().startsWith(kksFilter.toUpperCase()))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter((row) => {
        const rd = row._raw || {}
        const tag  = (rd['Tag-Name'] || rd['TagName'] || '').toLowerCase()
        const port = (rd['Port-Name'] || rd['PortName'] || '').toLowerCase()
        const desg = (rd['Designation'] || '').toLowerCase()
        const sig  = (rd['Signal Name'] || rd['Signal-Name'] || '').toLowerCase()
        const val  = (row.value || '').toLowerCase()
        const key  = (rd['Parameter Key'] || rd['Parameter-Key'] || '').toLowerCase()
        return tag.includes(q) || port.includes(q) || desg.includes(q) || sig.includes(q) || val.includes(q) || key.includes(q)
      })
    }
    return r
  }, [rows, search, kksFilter])

  const selected = turbines.find((t) => t.id === selectedId)
  const mixedData = kksPrefixes.length > 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', height: 'calc(100vh - 72px)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <select
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(Number(e.target.value))}
          style={{ padding: '0.35rem 0.6rem', fontSize: '0.875rem', minWidth: 260 }}
        >
          {turbines.length === 0 && <option value="">No turbines — import a file first</option>}
          {turbines.map((t) => (
            <option key={t.id} value={t.id}>
              {t.project_name} / {t.name}
            </option>
          ))}
        </select>

        {/* KKS prefix filter — shown only when turbine has mixed data */}
        {kksPrefixes.length > 1 && (
          <select
            value={kksFilter}
            onChange={e => setKksFilter(e.target.value)}
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.875rem', background: kksFilter ? '#1a2a1a' : '#2a1a1a', borderColor: kksFilter ? '#4caf7d' : '#e57373', border: '1px solid', borderRadius: 3, color: '#e0e0e0' }}
            title="Filter by KKS prefix (turbine unit number)"
          >
            <option value="">⚠ Mixed data — all {rows.length.toLocaleString()} params</option>
            {kksPrefixes.map(({ prefix, count }) => (
              <option key={prefix} value={prefix}>
                {prefix}… — {count.toLocaleString()} params
              </option>
            ))}
          </select>
        )}

        {selected && (
          <span style={{ fontSize: '0.8rem', color: mixedData && !kksFilter ? '#e57373' : '#666' }}>
            {kksFilter ? filtered.length.toLocaleString() : selected.param_count.toLocaleString()} parameters
            {mixedData && !kksFilter ? ' ⚠ mixed' : ''}
          </span>
        )}

        <input
          placeholder="Search tag / port / value…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '0.35rem 0.6rem', fontSize: '0.875rem', width: 220 }}
        />

        {loading && <span style={{ fontSize: '0.8rem', color: '#888' }}>Loading…</span>}
      </div>

      {/* Table */}
      <div className="ag-theme-alpine" style={{ flex: 1, width: '100%' }}>
        <AgGridReact
          rowData={filtered}
          columnDefs={COL_DEFS}
          defaultColDef={DEFAULT_COL}
          pagination
          paginationPageSize={200}
          suppressCellFocus
        />
      </div>
    </div>
  )
}
