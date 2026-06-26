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
  --ag-odd-row-background-color: #F7F3FC;
  --ag-header-background-color: #5C3D99;
  --ag-header-foreground-color: #ffffff;
  --ag-foreground-color: #2A1A4A;
  --ag-row-hover-color: #EDE3F8;
  --ag-selected-row-background-color: #C8B8E8;
  --ag-border-color: #D0C4E8;
  --ag-row-border-color: #EDE3F8;
  --ag-header-column-separator-color: #7850C0;
  --ag-header-column-separator-display: block;
  --ag-header-column-separator-height: 60%;
  --ag-cell-widget-spacing: 4px;
  --ag-secondary-foreground-color: #5A3A8A;
  --ag-disabled-foreground-color: #9888B8;
}
.xls-grid .ag-cell {
  border-right: 1px solid #EDE3F8 !important;
  line-height: 21px;
  color: #2A1A4A;
}
.xls-grid .ag-header-cell {
  border-right: 1px solid #7850C0 !important;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #ffffff;
}
.xls-grid .ag-root-wrapper {
  border: 1px solid #D0C4E8;
}
.xls-grid .ag-paging-panel {
  height: 28px;
  font-size: 11px;
  border-top: 1px solid #D0C4E8;
  color: #5A3A8A;
  background: #F4F0FA;
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

const TB = { padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#F4F0FA', border: '1px solid #B8A8DA', color: '#2A1A4A', borderRadius: 2, cursor: 'pointer' }

const NUM_PFX = /^(\d+)/

function getTagName(row) {
  const rd = row._raw || {}
  return rd['Tag-Name'] || rd['TagName'] || ''
}

const PAGE_SIZE = 1000

export default function Dashboard() {
  const [turbines, setTurbines]     = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [rows, setRows]             = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [offset, setOffset]         = useState(0)
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [tagFilter, setTagFilter]   = useState('')
  const [portView, setPortView]     = useState('annotated')  // default: non-empty Parameter Key

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

  // Build API params from current view settings
  const apiParams = (extra = {}) => ({
    turbine_id: selectedId,
    annotated_only: portView === 'annotated',
    limit: PAGE_SIZE,
    ...extra,
  })

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    setTagFilter('')
    setRows([])
    setOffset(0)
    setTotalCount(0)
    Promise.all([
      client.get('/parameters/count', { params: { turbine_id: selectedId, annotated_only: portView === 'annotated' } }),
      client.get('/parameters', { params: apiParams({ offset: 0 }) }),
    ]).then(([cntRes, parRes]) => {
      setTotalCount(cntRes.data.count)
      setRows(parseRows(parRes.data))
      setOffset(parRes.data.length)
    }).finally(() => setLoading(false))
  }, [selectedId, portView])

  const handleLoadMore = async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const r = await client.get('/parameters', { params: apiParams({ offset }) })
      setRows(prev => [...prev, ...parseRows(r.data)])
      setOffset(prev => prev + r.data.length)
    } finally {
      setLoadingMore(false)
    }
  }

  const hasMore = offset < totalCount

  // Detect Tag-Name numeric prefixes from loaded rows (client-side)
  const tagPrefixes = useMemo(() => {
    const counts = {}
    for (const row of rows) {
      const tag = getTagName(row)
      const m = NUM_PFX.exec(tag)
      if (m) counts[m[1]] = (counts[m[1]] || 0) + 1
    }
    return Object.entries(counts)
      .map(([prefix, count]) => ({ prefix, count }))
      .sort((a, b) => b.count - a.count)
  }, [rows])

  const mixedData = tagPrefixes.length > 1

  const filtered = useMemo(() => {
    let r = rows
    if (portView === 'annotated') {
      r = r.filter(row => (row._raw?.['Parameter Key'] || '').trim() !== '')
    }
    if (tagFilter) {
      r = r.filter(row => getTagName(row).startsWith(tagFilter))
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
  }, [rows, search, tagFilter, portView])

  const selected = turbines.find((t) => t.id === selectedId)

  const handleDeleteTurbine = async () => {
    if (!selectedId) return
    const t = turbines.find(x => x.id === selectedId)
    if (!window.confirm(`Delete "${t?.project_name} / ${t?.name}" and all its ${rows.length.toLocaleString()} parameters?`)) return
    await client.delete(`/turbines/${selectedId}`)
    const updated = turbines.filter(x => x.id !== selectedId)
    setTurbines(updated)
    setSelectedId(updated.length > 0 ? updated[0].id : null)
    setRows([])
  }

  const handleClearDb = async () => {
    if (!window.confirm('Clear ENTIRE database? All turbines and parameters will be deleted.')) return
    await client.delete('/db/reset')
    setTurbines([])
    setSelectedId(null)
    setRows([])
  }

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

        {/* Port view toggle: All / With annotation */}
        <div style={{ display: 'flex', border: '1px solid #B8A8DA', borderRadius: 2, overflow: 'hidden', fontSize: '0.78rem' }}>
          {[
            { key: 'all',       label: 'All ports',       count: totalCount },
            { key: 'annotated', label: 'With annotation', count: null       },
          ].map(({ key, label, count }, i) => (
            <button
              key={key}
              onClick={() => setPortView(key)}
              style={{
                ...TB, border: 'none', borderRadius: 0,
                borderLeft: i > 0 ? '1px solid #B8A8DA' : 'none',
                background: portView === key ? '#5C3D99' : '#F4F0FA',
                color:      portView === key ? '#ffffff'  : '#6A50A0',
                fontWeight: portView === key ? 600 : 400,
              }}
            >
              {label}{count !== null ? ` (${count.toLocaleString()})` : ''}
            </button>
          ))}
        </div>

        {/* Tag-Name prefix filter — shown when turbine has mixed GTs */}
        {tagPrefixes.length > 1 && (
          <select
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            style={{ ...TB, cursor: 'default', minWidth: 150,
              background: tagFilter ? '#F4F0FA' : '#fdecea',
              borderColor: tagFilter ? '#B8A8DA' : '#e57373',
              color: tagFilter ? '#2A1A4A' : '#922' }}
            title="Filter by turbine unit (Tag-Name prefix)"
          >
            <option value="">⚠ Mixed GTs — all</option>
            {tagPrefixes.map(({ prefix, count }) => (
              <option key={prefix} value={prefix}>{prefix}… ({count.toLocaleString()})</option>
            ))}
          </select>
        )}

        <span style={{ fontSize: '0.75rem', color: mixedData && !tagFilter ? '#c0392b' : '#6A50A0' }}>
          {filtered.length.toLocaleString()}{totalCount > rows.length ? ` / ${totalCount.toLocaleString()} total` : ''} rows
          {mixedData && !tagFilter ? ' ⚠ mixed GTs' : ''}
        </span>

        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...TB, cursor: 'text', width: 180, outline: 'none' }}
        />

        {loading && <span style={{ fontSize: '0.75rem', color: '#9888B8' }}>Loading…</span>}

        {!loading && hasMore && (
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={{ ...TB, background: '#EDE3F8', borderColor: '#9070C0' }}
          >
            {loadingMore ? 'Loading…' : `Load more (${(totalCount - offset).toLocaleString()} left)`}
          </button>
        )}

        {/* Delete current turbine */}
        {selectedId && (
          <button
            onClick={handleDeleteTurbine}
            title="Delete this turbine record and all its parameters"
            style={{ ...TB, marginLeft: 'auto', background: '#fdecea', borderColor: '#e57373', color: '#922' }}
          >
            Delete turbine
          </button>
        )}

        {/* Clear entire DB */}
        <button
          onClick={handleClearDb}
          title="Wipe entire database — all projects, turbines and parameters"
          style={{ ...TB, marginLeft: selectedId ? '0' : 'auto', background: '#922', borderColor: '#700', color: '#fff', fontWeight: 700 }}
        >
          Clear DB
        </button>
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
