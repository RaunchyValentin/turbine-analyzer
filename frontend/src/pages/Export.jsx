import React, { useEffect, useRef, useState } from 'react'
import client from '../api/client'

export default function Export() {
  const [turbines, setTurbines]       = useState([])
  const [turbineId, setTurbineId]     = useState('')
  const [keyTypes, setKeyTypes]       = useState([])
  const [selected, setSelected]       = useState(new Set())
  const [allSelected, setAllSelected] = useState(true)
  const [loadingTypes, setLoadingTypes] = useState(false)
  const [overrideCount, setOverrideCount] = useState(null)

  // Session state
  const [snapTurbineId, setSnapTurbineId] = useState('')
  const [allTurbines, setAllTurbines]     = useState([])
  const [restoring, setRestoring]         = useState(false)
  const [restoreResult, setRestoreResult] = useState(null)
  const snapFileRef = useRef()

  useEffect(() => {
    client.get('/turbines/list').then(r => {
      setAllTurbines(r.data)
      const jars = r.data.filter(t => (t.source_file || '').toLowerCase().endsWith('.jar'))
      setTurbines(jars)
      if (jars.length > 0) {
        setTurbineId(String(jars[0].id))
        setSnapTurbineId(String(r.data[0]?.id || ''))
      }
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
      setSelected(new Set()); setAllSelected(false)
    } else {
      setSelected(new Set(keyTypes.map(t => t.prefix))); setAllSelected(true)
    }
  }

  const selectedTurbine = turbines.find(t => String(t.id) === turbineId)

  const handleExport = () => {
    if (!turbineId) return
    const params = new URLSearchParams({ turbine_id: turbineId })
    if (!allSelected && selected.size > 0) params.set('key_types', [...selected].join(','))
    window.open(`/api/export/srel-from-jar?${params}`, '_blank')
  }

  const totalFiltered = allSelected
    ? keyTypes.reduce((s, t) => s + t.count, 0)
    : keyTypes.filter(t => selected.has(t.prefix)).reduce((s, t) => s + t.count, 0)

  const canExport = !!turbineId && (allSelected || selected.size > 0)

  // ── Session handlers ───────────────────────────────────────────────────────

  const handleSaveSession = () => {
    if (!snapTurbineId) return
    window.open(`/api/snapshot/${snapTurbineId}`, '_blank')
  }

  const handleRestoreFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f || !snapTurbineId) return
    setRestoring(true)
    setRestoreResult(null)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const r = await client.post(`/snapshot/restore?turbine_id=${snapTurbineId}`, fd)
      const d = r.data
      setRestoreResult({
        ok: true,
        msg: `Restored: ${d.restored_setting_overrides} setting overrides, ${d.restored_curves} curves`
          + (d.skipped_curves_not_found ? `, ${d.skipped_curves_not_found} curves not found` : ''),
      })
    } catch (err) {
      setRestoreResult({ ok: false, msg: err.response?.data?.detail || err.message })
    } finally {
      setRestoring(false)
      e.target.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-start' }}>

      {/* ── SREL Export ───────────────────────────────────────────────────── */}
      <section style={SECTION}>
        <h2 style={H2}>Generate SREL from JAR</h2>

        <div style={FIELD}>
          <label style={LABEL}>Turbine (JAR imports only)</label>
          {turbines.length === 0
            ? <div style={{ color: '#9A80BB', fontSize: '0.85rem' }}>No JAR imports found — import a .jar file first</div>
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
            <div style={{ fontSize: '0.72rem', color: '#9A80BB', marginTop: 3, fontFamily: 'monospace' }}>
              {selectedTurbine.source_file}
            </div>
          )}
        </div>

        <div style={FIELD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 4 }}>
            <label style={LABEL}>Parameter key types</label>
            {loadingTypes && <span style={{ fontSize: '0.72rem', color: '#9A80BB' }}>loading…</span>}
            {keyTypes.length > 0 && (
              <label style={TOGGLE}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                <span>all</span>
              </label>
            )}
          </div>
          {keyTypes.length === 0 && !loadingTypes && turbineId && (
            <div style={{ fontSize: '0.8rem', color: '#9A80BB' }}>No keyed parameters found — all params will be exported</div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {keyTypes.map(({ prefix, count }) => (
              <label key={prefix} style={{
                ...CHIP,
                background:  selected.has(prefix) ? '#8A00E5' : '#F3EAFF',
                borderColor: selected.has(prefix) ? '#6B00B3' : '#DDD0EE',
                color:       selected.has(prefix) ? '#ffffff'  : '#7A55AA',
              }}>
                <input type="checkbox" checked={selected.has(prefix)} onChange={() => toggleType(prefix)} style={{ display: 'none' }} />
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{prefix}:</span>
                <span style={{ fontSize: '0.7rem', color: selected.has(prefix) ? 'rgba(255,255,255,0.75)' : '#9A80BB' }}>{count.toLocaleString()}</span>
              </label>
            ))}
          </div>
        </div>

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
              <span style={{ fontSize: '0.78rem', color: overrideCount > 0 ? '#6B00B3' : '#9A80BB' }}>
                {overrideCount > 0 ? `${overrideCount} changed parameter(s)` : 'No overrides yet'}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#9A80BB', marginTop: 2 }}>
            Delta export — only parameters changed vs original JAR values.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={handleExport} disabled={!canExport} style={{ ...BTN, opacity: canExport ? 1 : 0.4 }}>
            ↓ Download SREL (.xlsx)
          </button>
          <span style={{ fontSize: '0.78rem', color: '#9A80BB' }}>
            {keyTypes.length > 0
              ? `~${totalFiltered.toLocaleString()} rows`
              : selectedTurbine ? `${(selectedTurbine.param_count || 0).toLocaleString()} rows` : ''}
          </span>
        </div>
      </section>

      {/* ── Work Sessions ────────────────────────────────────────────────── */}
      <section style={SECTION}>
        <h2 style={H2}>Work Sessions</h2>
        <div style={{ fontSize: '0.8rem', color: '#7A55AA', marginBottom: '0.75rem' }}>
          Save all your edits (Settings overrides + curve point changes) to a JSON file.
          Load it back later to continue from where you left off.
        </div>

        <div style={FIELD}>
          <label style={LABEL}>Turbine</label>
          {allTurbines.length === 0
            ? <div style={{ color: '#9A80BB', fontSize: '0.85rem' }}>No turbines yet</div>
            : (
              <select value={snapTurbineId} onChange={e => { setSnapTurbineId(e.target.value); setRestoreResult(null) }} style={SELECT}>
                {allTurbines.map(t => (
                  <option key={t.id} value={t.id}>{t.project_name} / {t.name}</option>
                ))}
              </select>
            )
          }
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Save */}
          <button
            onClick={handleSaveSession}
            disabled={!snapTurbineId}
            style={{ ...BTN, opacity: snapTurbineId ? 1 : 0.4 }}
            title="Download a JSON snapshot of all your edits for this turbine"
          >
            ↓ Save session
          </button>

          {/* Load */}
          <button
            onClick={() => snapFileRef.current?.click()}
            disabled={!snapTurbineId || restoring}
            style={{ ...BTN, background: restoring ? '#F3EAFF' : '#F3EAFF', borderColor: '#C099FF', color: '#6B00B3', opacity: snapTurbineId ? 1 : 0.4 }}
            title="Load a previously saved session file and restore all edits"
          >
            {restoring ? 'Restoring…' : '↑ Load session'}
          </button>
          <input
            ref={snapFileRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleRestoreFile}
          />
        </div>

        {restoreResult && (
          <div style={{
            marginTop: '0.5rem',
            padding: '0.4rem 0.75rem',
            borderRadius: 4,
            fontSize: '0.82rem',
            background: restoreResult.ok ? '#e8f5e8' : '#fdecea',
            border: `1px solid ${restoreResult.ok ? '#7aaa7a' : '#e57373'}`,
            color: restoreResult.ok ? '#2a7a2a' : '#c0392b',
          }}>
            {restoreResult.ok ? '✓ ' : '✕ '}{restoreResult.msg}
          </div>
        )}

        <div style={{ fontSize: '0.72rem', color: '#9A80BB', marginTop: 4 }}>
          The session file does NOT include raw parameter data — only your edits.
          The turbine must already be imported before loading a session.
        </div>
      </section>

    </div>
  )
}

const SECTION = { background: '#ffffff', border: '1px solid #DDD0EE', borderRadius: 6, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: '1 1 340px', minWidth: 300, maxWidth: 560 }
const H2     = { margin: 0, fontSize: '0.95rem', color: '#1A0A2E', fontWeight: 700 }
const FIELD  = { display: 'flex', flexDirection: 'column', gap: 6 }
const LABEL  = { fontSize: '0.78rem', color: '#7A55AA', fontWeight: 600, letterSpacing: '0.03em' }
const SELECT = { background: '#fff', color: '#1A0A2E', border: '1px solid #DDD0EE', borderRadius: 4, padding: '0.4rem 0.6rem', fontSize: '0.875rem' }
const BTN    = { background: '#8A00E5', border: '1px solid #6B00B3', color: '#ffffff', borderRadius: 4, cursor: 'pointer', padding: '0.5rem 1.5rem', fontSize: '0.875rem', fontWeight: 600 }
const CHIP   = { display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', padding: '0.25rem 0.6rem', borderRadius: 4, border: '1px solid', fontSize: '0.8rem', userSelect: 'none', transition: 'all 0.1s' }
const TOGGLE = { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.75rem', color: '#7A55AA' }
