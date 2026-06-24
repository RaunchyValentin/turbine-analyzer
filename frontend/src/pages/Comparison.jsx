import React, { useEffect, useState, useMemo } from 'react'
import client from '../api/client'

const STAT_CARDS = [
  { key: 'matching', label: 'Matching records', color: '#4caf50' },
  { key: 'changed',  label: 'Changed values',   color: '#ff9800' },
  { key: 'only_a',  label: 'Only in Before',    color: '#2196f3' },
  { key: 'only_b',  label: 'Only in After',     color: '#9c27b0' },
]

const STATUS_FILTERS = [
  { value: 'changed', label: 'Changed' },
  { value: 'only_a',  label: 'Only in Before' },
  { value: 'only_b',  label: 'Only in After' },
]

function TurbineLabel(t) {
  if (!t) return '—'
  const date = t.file_date || t.imported_at || ''
  return `${t.name}${date ? '  ·  ' + date : ''}`
}

export default function Comparison() {
  const [turbines, setTurbines]   = useState([])
  const [idA, setIdA]             = useState('')
  const [idB, setIdB]             = useState('')
  const [result, setResult]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [filter, setFilter]       = useState('changed')
  const [search, setSearch]       = useState('')

  useEffect(() => {
    client.get('/turbines/list').then(r => setTurbines(r.data))
  }, [])

  const handleCompare = async () => {
    if (!idA || !idB || idA === idB) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const r = await client.get('/comparison', { params: { turbine_a: idA, turbine_b: idB } })
      setResult(r.data)
      setFilter('changed')
    } catch (e) {
      setError(e.response?.data?.detail || 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    window.open(`/api/comparison/export?turbine_a=${idA}&turbine_b=${idB}`, '_blank')
  }

  const visible = useMemo(() => {
    if (!result) return []
    let rows = result.rows.filter(r => r.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        (r.tag_name  || '').toLowerCase().includes(q) ||
        (r.param_key || '').toLowerCase().includes(q) ||
        (r.port_name || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
      )
    }
    return rows
  }, [result, filter, search])

  const taInfo = result?.turbine_a
  const tbInfo = result?.turbine_b

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Selectors */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: '0.75rem', color: '#666' }}>Before</label>
          <select value={idA} onChange={e => setIdA(e.target.value)} style={SEL_STYLE}>
            <option value="">— select turbine —</option>
            {turbines.map(t => (
              <option key={t.id} value={t.id}>{t.project_name} / {TurbineLabel(t)}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: '0.75rem', color: '#666' }}>After</label>
          <select value={idB} onChange={e => setIdB(e.target.value)} style={SEL_STYLE}>
            <option value="">— select turbine —</option>
            {turbines.map(t => (
              <option key={t.id} value={t.id}>{t.project_name} / {TurbineLabel(t)}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCompare}
          disabled={!idA || !idB || idA === idB || loading}
          style={BTN_STYLE}
        >
          {loading ? 'Comparing…' : 'Compare'}
        </button>
      </div>

      {error && <div style={{ color: 'red' }}>{error}</div>}

      {/* Stats */}
      {result && (
        <>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {STAT_CARDS.map(c => (
              <div
                key={c.key}
                onClick={() => c.key !== 'matching' && setFilter(c.key)}
                style={{
                  ...CARD_STYLE,
                  cursor: c.key !== 'matching' ? 'pointer' : 'default',
                  borderBottom: filter === c.key ? `3px solid ${c.color}` : '3px solid transparent',
                }}
              >
                <div style={{ fontSize: '2rem', fontWeight: 700, color: c.color }}>
                  {result.stats[c.key]}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  style={{
                    ...TAB_STYLE,
                    background: filter === f.value ? '#1976d2' : '#eee',
                    color: filter === f.value ? '#fff' : '#333',
                  }}
                >
                  {f.label} ({result.stats[f.value]})
                </button>
              ))}
            </div>
            <input
              placeholder="Search by Tag / Key / Port / Description…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.875rem', width: 300 }}
            />
            <button onClick={handleExport} style={{ ...BTN_STYLE, background: '#388e3c' }}>
              ↓ Download Excel report
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#263238', color: '#fff' }}>
                  <Th>#</Th>
                  <Th>Tag-Name</Th>
                  <Th>Parameter Key</Th>
                  <Th>Port-Name</Th>
                  <Th>Description</Th>
                  <Th>{taInfo ? TurbineLabel(taInfo) : 'Before'}</Th>
                  <Th>{tbInfo ? TurbineLabel(tbInfo) : 'After'}</Th>
                  <Th>EU</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row, i) => (
                  <tr
                    key={row.key + i}
                    style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}
                  >
                    <Td style={{ color: '#999', textAlign: 'right' }}>{i + 1}</Td>
                    <Td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.tag_name}</Td>
                    <Td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.param_key}</Td>
                    <Td>{row.port_name}</Td>
                    <Td style={{ color: '#666' }}>{row.description}</Td>
                    <Td style={row.status === 'only_a' ? ONLY_STYLE_A : {}}>{row.value_a ?? '—'}</Td>
                    <Td style={
                      row.status === 'changed' ? CHANGED_STYLE :
                      row.status === 'only_b'  ? ONLY_STYLE_B : {}
                    }>{row.value_b ?? '—'}</Td>
                    <Td style={{ color: '#888' }}>{row.eu}</Td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#aaa' }}>No records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function Th({ children }) {
  return <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, style }) {
  return <td style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid #eee', ...style }}>{children}</td>
}

const SEL_STYLE = { padding: '0.4rem 0.6rem', fontSize: '0.875rem', minWidth: 280 }
const BTN_STYLE = {
  padding: '0.45rem 1.25rem', fontSize: '0.875rem', fontWeight: 600,
  background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer',
}
const TAB_STYLE = {
  padding: '0.3rem 0.75rem', fontSize: '0.8rem', border: 'none', borderRadius: 4, cursor: 'pointer',
}
const CARD_STYLE = {
  padding: '1rem 1.5rem', background: '#fff', borderRadius: 8,
  boxShadow: '0 1px 4px rgba(0,0,0,0.1)', minWidth: 140, textAlign: 'center',
}
const CHANGED_STYLE = { background: '#ffe0b2', fontWeight: 600, color: '#e65100' }
const ONLY_STYLE_A  = { background: '#e3f2fd', color: '#1565c0', fontStyle: 'italic' }
const ONLY_STYLE_B  = { background: '#f3e5f5', color: '#6a1b9a', fontStyle: 'italic' }
