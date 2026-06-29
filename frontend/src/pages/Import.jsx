import React, { useState, useRef } from 'react'
import client from '../api/client'

const TURBINE_TYPES = ['SGT5-2000E', 'SGT6-2000E', 'SGT5-4000F', 'SGT6-4000F']

const S = {
  page:    { padding: '1.5rem', maxWidth: 720, fontFamily: 'system-ui, sans-serif' },
  h1:      { fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.2rem', color: '#2A1A4A' },
  card:    { background: '#ffffff', border: '1px solid #D0C4E8', borderRadius: 4, padding: '1rem', marginBottom: '1rem' },
  label:   { display: 'block', fontSize: '0.78rem', color: '#6A50A0', fontWeight: 600, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' },
  input:   { width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.875rem', border: '1px solid #D0C4E8', borderRadius: 3, background: '#fff', color: '#2A1A4A', boxSizing: 'border-box' },
  row:     { display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' },
  col:     { flex: 1 },
  btn:     { padding: '0.4rem 1rem', fontSize: '0.85rem', border: '1px solid #3D2270', borderRadius: 3, background: '#5C3D99', color: '#ffffff', cursor: 'pointer', fontWeight: 600 },
  btnAlt:  { padding: '0.4rem 1rem', fontSize: '0.85rem', border: '2px solid #3D2270', borderRadius: 3, background: '#3D2270', color: '#ffffff', cursor: 'pointer', fontWeight: 700 },
  btnDis:  { padding: '0.4rem 1rem', fontSize: '0.85rem', border: '1px solid #D0C4E8', borderRadius: 3, background: '#F4F0FA', color: '#B8A8DA', cursor: 'not-allowed' },
  pfxGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' },
  pfxCard: (sel) => ({ border: `2px solid ${sel ? '#5C3D99' : '#D0C4E8'}`, borderRadius: 4, padding: '0.5rem 0.75rem', cursor: 'pointer', background: sel ? '#EDE3F8' : '#fff', textAlign: 'center' }),
  pfxPfx:  { fontSize: '1.1rem', fontWeight: 700, color: '#2A1A4A' },
  pfxCnt:  { fontSize: '0.75rem', color: '#9888B8' },
  ok:      { color: '#3D2270', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.5rem' },
  err:     { color: '#c0392b', fontSize: '0.85rem', marginTop: '0.5rem' },
  drop:    { border: '2px dashed #B8A8DA', borderRadius: 4, padding: '2rem', textAlign: 'center', color: '#9888B8', cursor: 'pointer', background: '#F7F3FC' },
}

export default function Import() {
  const [file, setPfxFile]     = useState(null)
  const [prefixes, setPrefixes] = useState([])   // [{prefix, count}]
  const [scanning, setScanning] = useState(false)
  const [selPrefix, setSelPrefix] = useState('')
  const [projectName, setProjectName] = useState('')
  const [turbineName, setTurbineName] = useState('')
  const [turbineType, setTurbineType] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult]     = useState(null)  // {ok, msg}
  const inputRef = useRef()

  const handleFile = async (f) => {
    if (!f) return
    setPfxFile(f)
    setPrefixes([])
    setSelPrefix('')
    setTurbineType('')
    setResult(null)

    if (f.name.toLowerCase().endsWith('.jar')) {
      setScanning(true)
      const fd = new FormData()
      fd.append('file', f)
      try {
        const r = await client.post('/import/detect-prefixes', fd)
        setPrefixes(r.data || [])
        if (r.data?.length === 1) {
          setSelPrefix(r.data[0].prefix)
          setTurbineName(r.data[0].prefix)
        }
      } catch (_) {}
      finally { setScanning(false) }
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const doImportOne = async (prefix, unitName) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('project_name', projectName.trim())
    fd.append('turbine_name', unitName.trim())
    fd.append('kks_prefix', prefix)
    if (turbineType.trim()) fd.append('turbine_type', turbineType.trim())
    const r = await client.post('/import/create', fd)
    return r.data
  }

  const handleImport = async () => {
    if (!file || !projectName.trim() || !turbineName.trim()) return
    setImporting(true)
    setResult(null)
    try {
      const r = await doImportOne(selPrefix, turbineName)
      setResult({ ok: true, msg: `Imported: ${r.parameters} parameters → ${r.project_name} / ${r.turbine_name}` })
    } catch (e) {
      const msg = e.response?.data?.detail || e.message
      setResult({ ok: false, msg })
    } finally {
      setImporting(false)
    }
  }

  const handleImportAll = async () => {
    if (!file || !projectName.trim() || prefixes.length === 0) return
    setImporting(true)
    setResult(null)
    const results = []
    const errors = []
    for (const { prefix } of prefixes) {
      try {
        const r = await doImportOne(prefix, prefix)
        results.push(`${r.turbine_name}: ${r.parameters} params`)
      } catch (e) {
        errors.push(`${prefix}: ${e.response?.data?.detail || e.message}`)
      }
    }
    setImporting(false)
    if (errors.length === 0) {
      setResult({ ok: true, msg: `Imported ${results.length} units: ${results.join(', ')}` })
    } else {
      setResult({ ok: false, msg: `Errors: ${errors.join('; ')}. Done: ${results.join(', ')}` })
    }
  }

  const canImport    = file && projectName.trim() && turbineName.trim() && !importing
  const canImportAll = file && projectName.trim() && prefixes.length > 1 && selPrefix === '' && !importing

  return (
    <div style={S.page}>
      <div style={S.h1}>Import SPPA-T3000 Data</div>

      {/* Drop zone */}
      <div
        style={S.drop}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
      >
        {file ? (
          <span style={{ color: '#2A1A4A', fontWeight: 600 }}>{file.name}</span>
        ) : (
          <span>Drop JAR / SREL / XLSX here, or click to browse</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".jar,.srel,.xlsx,.xls,.csv,.txt"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
      </div>

      {/* KKS prefix selector — only for JAR files */}
      {(scanning || prefixes.length > 0) && (
        <div style={{ ...S.card, marginTop: '1rem' }}>
          <div style={S.label}>
            {scanning ? 'Scanning KKS prefixes…' : `Detected turbine units (${prefixes.length})`}
          </div>
          {!scanning && prefixes.length === 0 && (
            <div style={{ color: '#888', fontSize: '0.8rem' }}>No numeric KKS prefixes found — all parameters will be imported.</div>
          )}
          {prefixes.length > 0 && (
            <>
              <div style={{ fontSize: '0.78rem', color: '#9888B8', marginBottom: '0.4rem' }}>
                Select which unit to import (each unit → separate turbine record):
              </div>
              <div style={S.pfxGrid}>
                <div
                  style={S.pfxCard(selPrefix === '')}
                  onClick={() => { setSelPrefix(''); setTurbineName('ALL') }}
                >
                  <div style={S.pfxPfx}>All</div>
                  <div style={S.pfxCnt}>no filter</div>
                </div>
                {prefixes.map(({ prefix, count }) => (
                  <div
                    key={prefix}
                    style={S.pfxCard(selPrefix === prefix)}
                    onClick={() => { setSelPrefix(prefix); setTurbineName(prefix) }}
                  >
                    <div style={S.pfxPfx}>{prefix}…</div>
                    <div style={S.pfxCnt}>{count.toLocaleString()} blocks</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Project / turbine names */}
      {file && (
        <div style={{ ...S.card }}>
          <div style={S.row}>
            <div style={S.col}>
              <label style={S.label}>Project name</label>
              <input style={S.input} value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. Misurata" />
            </div>
            <div style={S.col}>
              <label style={S.label}>Turbine / unit name</label>
              <input style={S.input} value={turbineName} onChange={e => setTurbineName(e.target.value)} placeholder="e.g. GT31" />
            </div>
            <div style={S.col}>
              <label style={S.label}>Model</label>
              <select style={S.input} value={turbineType} onChange={e => setTurbineType(e.target.value)}>
                <option value="">— select —</option>
                {TURBINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {selPrefix && (
            <div style={{ fontSize: '0.78rem', color: '#6A50A0', marginBottom: '0.75rem' }}>
              Filter: only parameters where Tag-Name starts with <strong>{selPrefix}</strong>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              style={canImport ? S.btn : S.btnDis}
              disabled={!canImport}
              onClick={handleImport}
            >
              {importing ? 'Importing…' : selPrefix ? `Import ${selPrefix}…` : 'Import (all mixed)'}
            </button>

            {prefixes.length > 1 && selPrefix === '' && (
              <button
                style={canImportAll ? S.btnAlt : S.btnDis}
                disabled={!canImportAll}
                onClick={handleImportAll}
                title={`Import each unit (${prefixes.map(p => p.prefix).join(', ')}) as a separate turbine record`}
              >
                {importing ? 'Importing…' : `Import each unit separately (${prefixes.length})`}
              </button>
            )}
          </div>

          {result && (
            <div style={result.ok ? S.ok : S.err}>{result.msg}</div>
          )}
        </div>
      )}
    </div>
  )
}
