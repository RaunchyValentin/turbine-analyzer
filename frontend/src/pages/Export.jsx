import React, { useEffect, useState } from 'react'
import client from '../api/client'

export default function Export() {
  const [turbines, setTurbines]       = useState([])
  const [turbineId, setTurbineId]     = useState('')
  const [keyTypes, setKeyTypes]       = useState([])      // [{prefix, count}]
  const [selected, setSelected]       = useState(new Set()) // selected prefixes
  const [allSelected, setAllSelected] = useState(true)
  const [loadingTypes, setLoadingTypes] = useState(false)
  const [overrideCount, setOverrideCount] = useState(null)

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
    setOverrideCount(null)
    client.get('/export/key-types', { params: { turbine_id: turbineId } })
      .then(r => {
        setKeyTypes(r.data)
        setSelected(new Set(r.data.map(t => t.prefix)))
      })
      .finally(() => setLoadingTypes(false))
    client.get('/overrides', { params: { turbine_id: turbineId } })
      .then(r => setOverrideCount(r.data.length))
      .catch(() => setOverrideCount(0))
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
      <h2 style={{ margin: 0, fontSize: '1rem', color: '#1a2a1a', fontWeight: 600 }}>
        Generate SREL from JAR
      </h2>

      {/* Turbine selector */}
      <div style={FIELD}>
        <label style={LABEL}>Turbine (JAR imports only)</label>
        {turbines.length === 0
          ? <div style={{ color: '#7a9a7a', fontSize: '0.85rem' }}>No JAR imports found — import a .jar file first</div>
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
          <div style={{ fontSize: '0.72rem', color: '#7a9a7a', marginTop: 3, fontFamily: 'monospace' }}>
            {selectedTurbine.source_file}
          </div>
        )}
      </div>

      {/* Key type checkboxes */}
      <div style={FIELD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 4 }}>
          <label style={LABEL}>Parameter key types</label>
          {loadingTypes && <span style={{ fontSize: '0.72rem', color: '#7a9a7a' }}>loading…</span>}
          {keyTypes.length > 0 && (
            <label style={TOGGLE}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              <span>all</span>
            </label>
          )}
        </div>
        {keyTypes.length === 0 && !loadingTypes && turbineId && (
          <div style={{ fontSize: '0.8rem', color: '#7a9a7a' }}>
            No keyed parameters found — all params will be exported
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {keyTypes.map(({ prefix, count }) => (
            <label key={prefix} style={{
              ...CHIP,
              background: selected.has(prefix) ? '#d0ecd0' : '#eef3ee',
              borderColor: selected.has(prefix) ? '#4a8a4a' : '#b0c4b0',
              color: selected.has(prefix) ? '#1a3a1a' : '#5a7a5a',
            }}>
              <input
                type="checkbox"
                checked={selected.has(prefix)}
                onChange={() => toggleType(prefix)}
                style={{ display: 'none' }}
              />
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{prefix}:</span>
              <span style={{ fontSize: '0.7rem', color: selected.has(prefix) ? '#4a6a4a' : '#7a9a7a' }}>
                {count.toLocaleString()}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Overrides export */}
      <div style={FIELD}>
        <label style={LABEL}>User overrides (edited parameters)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => window.open(`/api/export/overrides?turbine_id=${turbineId}`, '_blank')}
            disabled={!turbineId || overrideCount === 0}
            style={{ ...BTN, opacity: (!turbineId || overrideCount === 0) ? 0.4 : 1 }}
          >
            ↓ Download Overrides (.xlsx)
          </button>
          {overrideCount !== null && (
            <span style={{ fontSize: '0.78rem', color: overrideCount > 0 ? '#2a8a4a' : '#7a9a7a' }}>
              {overrideCount > 0 ? `${overrideCount} changed parameter(s)` : 'No overrides yet'}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#7a9a7a', marginTop: 2 }}>
          Delta export — only parameters changed vs original JAR values.
          Edit curves on the Curves page and Save to create overrides.
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
        <span style={{ fontSize: '0.78rem', color: '#7a9a7a' }}>
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
const LABEL  = { fontSize: '0.78rem', color: '#5a7a5a', fontWeight: 600, letterSpacing: '0.03em' }
const SELECT = { background: '#fff', color: '#1a1a1a', border: '1px solid #b0c4b0', borderRadius: 4, padding: '0.4rem 0.6rem', fontSize: '0.875rem' }
const BTN    = { background: '#d0ecd0', border: '1px solid #7aaa7a', color: '#1a3a1a', borderRadius: 4, cursor: 'pointer', padding: '0.5rem 1.5rem', fontSize: '0.875rem', fontWeight: 600 }
const CHIP   = { display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', padding: '0.25rem 0.6rem', borderRadius: 4, border: '1px solid', fontSize: '0.8rem', userSelect: 'none', transition: 'all 0.1s' }
const TOGGLE = { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.75rem', color: '#5a7a5a' }
