import React, { useState, useRef } from 'react'
import client from '../api/client'

const S = {
  page:    { padding: '1.5rem', maxWidth: 720, fontFamily: 'system-ui, sans-serif' },
  h1:      { fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.2rem', color: '#1a2a1a' },
  card:    { background: '#f5f8f5', border: '1px solid #b0c4b0', borderRadius: 4, padding: '1rem', marginBottom: '1rem' },
  label:   { display: 'block', fontSize: '0.78rem', color: '#4a6a4a', fontWeight: 600, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' },
  input:   { width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.875rem', border: '1px solid #b0c4b0', borderRadius: 3, background: '#fff', color: '#1a1a1a', boxSizing: 'border-box' },
  row:     { display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' },
  col:     { flex: 1 },
  btn:     { padding: '0.4rem 1rem', fontSize: '0.85rem', border: '1px solid #7aaa7a', borderRadius: 3, background: '#d0ecd0', color: '#1a3a1a', cursor: 'pointer', fontWeight: 600 },
  btnDis:  { padding: '0.4rem 1rem', fontSize: '0.85rem', border: '1px solid #ccc', borderRadius: 3, background: '#eee', color: '#999', cursor: 'not-allowed' },
  pfxGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' },
  pfxCard: (sel) => ({ border: `2px solid ${sel ? '#4aaa4a' : '#b0c4b0'}`, borderRadius: 4, padding: '0.5rem 0.75rem', cursor: 'pointer', background: sel ? '#d8f0d8' : '#fff', textAlign: 'center' }),
  pfxPfx:  { fontSize: '1.1rem', fontWeight: 700, color: '#1a3a1a' },
  pfxCnt:  { fontSize: '0.75rem', color: '#5a7a5a' },
  ok:      { color: '#2a7a2a', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.5rem' },
  err:     { color: '#c0392b', fontSize: '0.85rem', marginTop: '0.5rem' },
  drop:    { border: '2px dashed #b0c4b0', borderRadius: 4, padding: '2rem', textAlign: 'center', color: '#5a7a5a', cursor: 'pointer', background: '#fafffe' },
}

export default function Import() {
  const [file, setPfxFile]     = useState(null)
  const [prefixes, setPrefixes] = useState([])   // [{prefix, count}]
  const [scanning, setScanning] = useState(false)
  const [selPrefix, setSelPrefix] = useState('')
  const [projectName, setProjectName] = useState('')
  const [turbineName, setTurbineName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult]     = useState(null)  // {ok, msg}
  const inputRef = useRef()

  const handleFile = async (f) => {
    if (!f) return
    setPfxFile(f)
    setPrefixes([])
    setSelPrefix('')
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

  const handleImport = async () => {
    if (!file || !projectName.trim() || !turbineName.trim()) return
    setImporting(true)
    setResult(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('project_name', projectName.trim())
    fd.append('turbine_name', turbineName.trim())
    fd.append('kks_prefix', selPrefix)
    try {
      const r = await client.post('/import/create', fd)
      setResult({ ok: true, msg: `Imported: ${r.data.parameters} parameters → ${r.data.project_name} / ${r.data.turbine_name}` })
    } catch (e) {
      const msg = e.response?.data?.detail || e.message
      setResult({ ok: false, msg })
    } finally {
      setImporting(false)
    }
  }

  const canImport = file && projectName.trim() && turbineName.trim() && !importing

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
          <span style={{ color: '#1a3a1a', fontWeight: 600 }}>{file.name}</span>
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
              <div style={{ fontSize: '0.78rem', color: '#5a7a5a', marginBottom: '0.4rem' }}>
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
          </div>

          {selPrefix && (
            <div style={{ fontSize: '0.78rem', color: '#4a7a4a', marginBottom: '0.75rem' }}>
              Filter: only parameters where Tag-Name starts with <strong>{selPrefix}</strong>
            </div>
          )}

          <button
            style={canImport ? S.btn : S.btnDis}
            disabled={!canImport}
            onClick={handleImport}
          >
            {importing ? 'Importing…' : 'Import'}
          </button>

          {result && (
            <div style={result.ok ? S.ok : S.err}>{result.msg}</div>
          )}
        </div>
      )}
    </div>
  )
}
