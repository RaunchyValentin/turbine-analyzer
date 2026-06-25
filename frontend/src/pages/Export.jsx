import React, { useEffect, useState } from 'react'
import client from '../api/client'

export default function Export() {
  const [turbines, setTurbines]       = useState([])
  const [turbineId, setTurbineId]     = useState('')
  const [keyTypes, setKeyTypes]       = useState([])      // [{prefix, count}]
  const [selected, setSelected]       = useState(new Set()) // selected prefixes
  const [allSelected, setAllSelected] = useState(true)
  const [loadingTypes, setLoadingTypes] = useState(false)

  useEffect(() => {
    client.get('/turbines/list').then(r => {
      const jars = r.data.filter(t => (t.source_file || '').toLowerCase().endsWith('.jar'))
      setTurbines(jars)
      if (jars.length > 0) setTurbineId(String(jars[0].id))
    })
  }, [])

  useEffect(() => {
    if (!turbineId) return
    setLoadingTypes(true)
    setKeyTypes([])
    setSelected(new Set())
    setAllSelected(true)
    client.get('/export/key-types', { params: { turbine_id: turbineId } })
      .then(r => {
        setKeyTypes(r.data)
        setSelected(new Set(r.data.map(t => t.prefix)))
      })
      .finally(() => setLoadingTypes(false))
  }, [turbineId])

  const toggleType = (pfx) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(pfx)) next.delete(pfx); else next.add(pfx)
      setAllSelected(next.size === keyTypes.length)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
      setAllSelected(false)
    } else {
      setSelected(new Set(keyTypes.map(t => t.prefix)))
      setAllSelected(true)
    }
  }

  const selectedTurbine = turbines.find(t => String(t.id) === turbineId)

  const handleExport = () => {
    if (!turbineId) return
    const params = new URLSearchParams({ turbine_id: turbineId })
    // send selected types only when not all selected (saves URL length)
    if (!allSelected && selected.size > 0) {
      params.set('key_types', [...selected].join(','))
    }
    window.open(`/api/export/srel-from-jar?${params}`, '_blank')
  }

  const totalFiltered = allSelected
    ? keyTypes.reduce((s, t) => s + t.count, 0)
    : keyTypes.filter(t => selected.has(t.prefix)).reduce((s, t) => s + t.count, 0)

  const canExport = !!turbineId && (allSelected || selected.size > 0)

  return (
    <div style={{ maxWidth: 580, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h2 style={{ margin: 0, fontSize: '1rem', color: '#e0e0e0', fontWeight: 600 }}>
        Generate SREL from JAR
      </h2>

      {/* Turbine selector */}
      <div style={FIELD}>
        <label style={LABEL}>Turbine (JAR imports only)</label>
        {turbines.length === 0
          ? <div style={{ color: '#555', fontSize: '0.85rem' }}>No JAR imports found — import a .jar file first</div>
          : (
            <select value={turbineId} onChange={e => setTurbineId(e.target.value)} style={SELECT}>
              {turbines.map(t => (
                <option key={t.id} value={t.id}>
                  {t.project_name} / {t.name}{t.file_date ? `  ·  ${t.file_date}` : ''}  ({t.param_count.toLocaleString()} params)
                </option>
              ))}
            </select>
          )
        }
        {selectedTurbine && (
          <div style={{ fontSize: '0.72rem', color: '#444', marginTop: 3, fontFamily: 'monospace' }}>
            {selectedTurbine.source_file}
          </div>
        )}
      </div>

      {/* Key type checkboxes */}
      <div style={FIELD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 4 }}>
          <label style={LABEL}>Parameter key types</label>
          {loadingTypes && <span style={{ fontSize: '0.72rem', color: '#555' }}>loading…</span>}
          {keyTypes.length > 0 && (
            <label style={TOGGLE}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              <span>all</span>
            </label>
          )}
        </div>
        {keyTypes.length === 0 && !loadingTypes && turbineId && (
          <div style={{ fontSize: '0.8rem', color: '#555' }}>
            No keyed parameters found — all params will be exported
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {keyTypes.map(({ prefix, count }) => (
            <label key={prefix} style={{
              ...CHIP,
              background: selected.has(prefix) ? '#1a2a3a' : '#111',
              borderColor: selected.has(prefix) ? '#5b9bd5' : '#2a2a45',
              color: selected.has(prefix) ? '#c0d8f0' : '#555',
            }}>
              <input
                type="checkbox"
                checked={selected.has(prefix)}
                onChange={() => toggleType(prefix)}
                style={{ display: 'none' }}
              />
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{prefix}:</span>
              <span style={{ fontSize: '0.7rem', color: selected.has(prefix) ? '#778' : '#333' }}>
                {count.toLocaleString()}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Export button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={handleExport}
          disabled={!canExport}
          style={{ ...BTN, opacity: canExport ? 1 : 0.4 }}
        >
          ↓ Download SREL (.xlsx)
        </button>
        <span style={{ fontSize: '0.78rem', color: '#555' }}>
          {keyTypes.length > 0
            ? `~${totalFiltered.toLocaleString()} rows`
            : selectedTurbine
              ? `${(selectedTurbine.param_count || 0).toLocaleString()} rows`
              : ''
          }
        </span>
      </div>
    </div>
  )
}

const FIELD  = { display: 'flex', flexDirection: 'column', gap: 6 }
const LABEL  = { fontSize: '0.78rem', color: '#888', fontWeight: 600, letterSpacing: '0.03em' }
const SELECT = { background: '#1e1e2e', color: '#e0e0e0', border: '1px solid #333', borderRadius: 4, padding: '0.4rem 0.6rem', fontSize: '0.875rem' }
const BTN    = { background: '#1a3a5a', border: '1px solid #5b9bd5', color: '#5b9bd5', borderRadius: 4, cursor: 'pointer', padding: '0.5rem 1.5rem', fontSize: '0.875rem', fontWeight: 600 }
const CHIP   = { display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', padding: '0.25rem 0.6rem', borderRadius: 4, border: '1px solid', fontSize: '0.8rem', userSelect: 'none', transition: 'all 0.1s' }
const TOGGLE = { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.75rem', color: '#666' }
