import React, { useEffect, useState, useMemo, useCallback } from 'react'
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
    width: 200,
    sortable: true,
    filter: true,
  },
  {
    headerName: 'Port-Name',
    valueGetter: raw('Port-Name', 'PortName'),
    width: 110,
    sortable: true,
    filter: true,
  },
  {
    field: 'value',
    headerName: 'Value',
    width: 120,
    sortable: true,
    filter: true,
  },
  {
    headerName: 'Variation Min',
    valueGetter: raw('Variation-Min', 'Variation Min', 'Var-Min', 'VarMin', 'Min', 'Min.'),
    width: 130,
    sortable: true,
    filter: true,
  },
  {
    headerName: 'Variation Max',
    valueGetter: raw('Variation-Max', 'Variation Max', 'Var-Max', 'VarMax', 'Max', 'Max.'),
    width: 130,
    sortable: true,
    filter: true,
  },
  {
    field: 'unit',
    headerName: 'EU',
    width: 80,
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
  const [turbines, setTurbines] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  // Load turbine list once
  useEffect(() => {
    client.get('/turbines/list').then((r) => {
      setTurbines(r.data)
      if (r.data.length > 0) setSelectedId(r.data[0].id)
    })
  }, [])

  // Load parameters when turbine changes
  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    client
      .get('/parameters', { params: { turbine_id: selectedId } })
      .then((r) => setRows(parseRows(r.data)))
      .finally(() => setLoading(false))
  }, [selectedId])

  // Client-side search across Tag-Name, Port-Name and value
  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((r) => {
      const tag = (r._raw?.['Tag-Name'] || r._raw?.['TagName'] || '').toLowerCase()
      const port = (r._raw?.['Port-Name'] || r._raw?.['PortName'] || '').toLowerCase()
      const val = (r.value || '').toLowerCase()
      return tag.includes(q) || port.includes(q) || val.includes(q)
    })
  }, [rows, search])

  const onGridReady = useCallback((params) => {
    params.api.sizeColumnsToFit()
  }, [])

  const selected = turbines.find((t) => t.id === selectedId)

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

        {selected && (
          <span style={{ fontSize: '0.8rem', color: '#666' }}>
            {selected.param_count} parameters
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
          onGridReady={onGridReady}
          pagination
          paginationPageSize={200}
          suppressCellFocus
        />
      </div>
    </div>
  )
}
