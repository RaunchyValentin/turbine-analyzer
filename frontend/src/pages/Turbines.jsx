import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'

function sourceLabel(filename) {
  if (!filename) return '—'
  const ext = filename.split('.').pop().toLowerCase()
  if (ext === 'jar') return 'T3000 (JAR)'
  if (ext === 'xlsx' || ext === 'xls') return 'SREL (Excel)'
  if (ext === 'csv' || ext === 'txt' || ext === 'srel') return 'SREL (CSV)'
  return ext.toUpperCase()
}

// Parse "Sarir_GT12_SettingList_SGT5-4000F_4_.xls" → {project:"Sarir", turbine:"GT12"}
function parseFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, '').replace(/\s+/g, '_')
  const parts = base.split('_').filter(Boolean)
  return {
    project: parts[0] || '',
    turbine: parts[1] || '',
  }
}

export default function Turbines() {
  const [turbines, setTurbines]         = useState([])
  const [file, setFile]                 = useState(null)
  const [projectName, setProjectName]   = useState('')
  const [turbineName, setTurbineName]   = useState('')
  const [kksPrefix, setKksPrefix]       = useState('')
  const [kksPrefixes, setKksPrefixes]   = useState([])   // [{prefix, count}]
  const [scanningPfx, setScanningPfx]   = useState(false)
  const [importing, setImporting]       = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError]   = useState(null)
  const [dragging, setDragging]         = useState(false)
  const [editingProject, setEditingProject] = useState(null) // {id, name}
  const [cleaning, setCleaning]             = useState(false)
  const [cleanResult, setCleanResult]       = useState(null)
  const [purgingId, setPurgingId]           = useState(null)
  const [purgePrefix, setPurgePrefix]       = useState({}) // {turbineId: prefix}
  const [sortBy, setSortBy]             = useState('project')
  const fileInputRef = useRef()
  const navigate = useNavigate()

  const loadTurbines = useCallback(() => {
    client.get('/turbines/list').then(r => setTurbines(r.data))
  }, [])

  useEffect(() => { loadTurbines() }, [loadTurbines])

  const onFileChosen = async (f) => {
    if (!f) return
    setFile(f)
    setImportResult(null)
    setImportError(null)
    const parsed = parseFilename(f.name)
    setProjectName(parsed.project)
    setTurbineName(parsed.turbine)
    setKksPrefix('')
    setKksPrefixes([])

    // Scan JAR for KKS prefixes
    if (f.name.toLowerCase().endsWith('.jar')) {
      setScanningPfx(true)
      try {
        const fd = new FormData()
        fd.append('file', f)
        const r = await client.post('/import/detect-prefixes', fd)
        setKksPrefixes(r.data)
        // Auto-select if only one prefix found
        if (r.data.length === 1) setKksPrefix(r.data[0].prefix)
      } catch (_) {}
      finally { setScanningPfx(false) }
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFileChosen(f)
  }

  const handleImport = async () => {
    if (!file || !projectName || !turbineName) return
    setImporting(true)
    setImportError(null)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('project_name', projectName)
      fd.append('turbine_name', turbineName)
      if (kksPrefix.trim()) fd.append('kks_prefix', kksPrefix.trim())
      const r = await client.post('/import/create', fd)
      setImportResult(r.data)
      setFile(null)
      setProjectName('')
      setTurbineName('')
      setKksPrefix('')
      loadTurbines()
    } catch (e) {
      setImportError(e.response?.data?.detail || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handlePurge = async (turbineId) => {
    const pfx = (purgePrefix[turbineId] || '').trim()
    if (!pfx) return
    if (!window.confirm(`Keep only "${pfx}…" params in this turbine? All others will be deleted.`)) return
    setPurgingId(turbineId)
    try {
      await client.delete(`/turbines/${turbineId}/params`, { params: { keep_prefix: pfx } })
      loadTurbines()
    } finally {
      setPurgingId(null)
    }
  }

  const handleDelete = async (turbineId, turbineName) => {
    if (!window.confirm(`Delete turbine "${turbineName}" and all its data?`)) return
    await client.delete(`/turbines/${turbineId}`)
    loadTurbines()
  }

  const handleCleanup = async () => {
    setCleaning(true)
    setCleanResult(null)
    try {
      const r = await client.post('/db/cleanup')
      setCleanResult(r.data)
      loadTurbines()
    } finally {
      setCleaning(false)
    }
  }

  const handleRenameProject = async (projectId, newName) => {
    if (!newName.trim()) { setEditingProject(null); return }
    await client.patch(`/projects/${projectId}`, { name: newName.trim() })
    setEditingProject(null)
    loadTurbines()
  }

  const sorted = [...turbines].sort((a, b) => {
    if (sortBy === 'project') {
      const pc = a.project_name.localeCompare(b.project_name)
      return pc !== 0 ? pc : a.name.localeCompare(b.name)
    }
    return a.name.localeCompare(b.name)
  })

  const isReady = file && projectName.trim() && turbineName.trim()

  return (
    <div style={s.page}>

      {/* ── IMPORT SECTION ─────────────────────── */}
      <section style={s.importSection}>
        <h2 style={s.sectionTitle}>Import SREL / JAR</h2>

        {/* Drop zone */}
        <div
          style={{ ...s.dropzone, ...(dragging ? s.dropzoneActive : {}), ...(file ? s.dropzoneFilled : {}) }}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jar,.srel,.xlsx,.xls,.csv,.txt"
            style={{ display: 'none' }}
            onChange={e => onFileChosen(e.target.files[0])}
          />
          {file
            ? <><span style={s.fileIcon}>📄</span><span style={s.fileName}>{file.name}</span></>
            : <><span style={s.dropIcon}>⬆</span><span style={s.dropText}>Click or drag JAR / SREL / XLSX / CSV</span></>
          }
        </div>

        {/* Name fields */}
        {file && (
          <div style={s.nameRow}>
            <label style={s.label}>
              Project
              <input
                style={s.input}
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="e.g. Sarir"
              />
            </label>
            <label style={s.label}>
              Turbine
              <input
                style={s.input}
                value={turbineName}
                onChange={e => setTurbineName(e.target.value)}
                placeholder="e.g. GT12"
              />
            </label>
            <label style={s.label}>
              KKS prefix
              {scanningPfx
                ? <span style={{ ...s.input, color: '#555', width: '130px' }}>scanning…</span>
                : kksPrefixes.length > 1
                  ? (
                    <select
                      style={{ ...s.input, width: '150px' }}
                      value={kksPrefix}
                      onChange={e => setKksPrefix(e.target.value)}
                    >
                      <option value="">— all turbines —</option>
                      {kksPrefixes.map(({ prefix, count }) => (
                        <option key={prefix} value={prefix}>
                          {prefix}  ({count.toLocaleString()} tags)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      style={{ ...s.input, width: '90px' }}
                      value={kksPrefix}
                      onChange={e => setKksPrefix(e.target.value)}
                      placeholder="e.g. 12"
                      title="Filter: only import tags starting with this prefix"
                    />
                  )
              }
            </label>
            <button style={{ ...s.importBtn, ...(isReady ? {} : s.importBtnDisabled) }}
              onClick={handleImport} disabled={!isReady || importing}>
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        )}

        {importResult && (
          <div style={s.success}>
            ✓ {importResult.project_name} / {importResult.turbine_name} — {importResult.parameters} parameters, {importResult.curves} curves
          </div>
        )}
        {importError && <div style={s.error}>✕ {importError}</div>}
      </section>

      {/* ── TURBINE LIST ───────────────────────── */}
      <section style={s.listSection}>
        <div style={s.listHeader}>
          <h2 style={s.sectionTitle}>Turbines ({turbines.length})</h2>
          <div style={s.sortGroup}>
            <button
              onClick={handleCleanup}
              disabled={cleaning}
              style={{ ...s.sortBtn, color: cleaning ? '#999' : '#c05030', borderColor: '#e0b0a0', marginRight: 8 }}
              title="Remove orphaned parameters and curves left after turbine deletion"
            >
              {cleaning ? 'Cleaning…' : '⌫ Clean DB'}
            </button>
            {cleanResult && (
              <span style={{ fontSize: '0.72rem', color: '#888', marginRight: 8 }}>
                Removed: {cleanResult.deleted_parameters} params, {cleanResult.deleted_curves} curves
              </span>
            )}
            <span style={s.sortLabel}>Sort:</span>
            {['project', 'turbine'].map(k => (
              <button key={k} style={{ ...s.sortBtn, ...(sortBy === k ? s.sortActive : {}) }}
                onClick={() => setSortBy(k)}>{k}</button>
            ))}
          </div>
        </div>

        {turbines.length === 0
          ? <div style={s.empty}>No turbines yet — import a file above.</div>
          : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Project</th>
                  <th style={s.th}>Turbine</th>
                  <th style={s.th}>Source file</th>
                  <th style={s.th}>Source</th>
                  <th style={s.th}>Date</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Parameters</th>
                  <th style={s.th}>Keep prefix</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t, i) => (
                  <tr key={t.id} style={i % 2 === 0 ? s.rowEven : s.rowOdd}>
                    <td style={s.td}>
                      {editingProject?.id === t.project_id
                        ? (
                          <input
                            style={s.inlineInput}
                            autoFocus
                            value={editingProject.name}
                            onChange={e => setEditingProject({ ...editingProject, name: e.target.value })}
                            onBlur={() => handleRenameProject(editingProject.id, editingProject.name)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRenameProject(editingProject.id, editingProject.name)
                              if (e.key === 'Escape') setEditingProject(null)
                            }}
                          />
                        ) : (
                          <span
                            style={s.projectName}
                            title="Click to rename"
                            onClick={() => setEditingProject({ id: t.project_id, name: t.project_name })}
                          >{t.project_name}</span>
                        )
                      }
                    </td>
                    <td style={s.td}>
                      <span
                        style={s.turbineLink}
                        onClick={() => navigate(`/settings/${t.id}/SO111b`)}
                        title="Open in Setting List"
                      >{t.name}</span>
                    </td>
                    <td style={{ ...s.td, ...s.fileCell }} title={t.source_file}>{t.source_file || '—'}</td>
                    <td style={s.td}>
                      <span style={sourceStyle(t.source_file)}>{sourceLabel(t.source_file)}</span>
                    </td>
                    <td style={{ ...s.td, color: '#7a8a7a' }}>{t.file_date || t.imported_at || '—'}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <span style={s.paramCount}>{t.param_count}</span>
                    </td>
                    <td style={{ ...s.td }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          style={{ ...s.inlineInput, width: 44 }}
                          placeholder="e.g. 31"
                          value={purgePrefix[t.id] || ''}
                          onChange={e => setPurgePrefix(p => ({ ...p, [t.id]: e.target.value }))}
                          title="Keep only params with this KKS prefix, delete the rest"
                        />
                        <button
                          style={{ ...s.deleteBtn, color: '#c0784a', borderColor: '#3a2a1a', whiteSpace: 'nowrap' }}
                          disabled={!purgePrefix[t.id]?.trim() || purgingId === t.id}
                          onClick={() => handlePurge(t.id)}
                          title="Delete all params NOT matching this prefix"
                        >
                          {purgingId === t.id ? '…' : '⌫'}
                        </button>
                      </div>
                    </td>
                    <td style={s.td}>
                      <button style={s.deleteBtn} onClick={() => handleDelete(t.id, t.name)} title="Delete turbine">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </section>
    </div>
  )
}

function sourceStyle(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase()
  if (ext === 'jar') return { color: '#0066cc', fontSize: '0.75rem', fontWeight: 600 }
  return { color: '#2a8a4a', fontSize: '0.75rem', fontWeight: 600 }
}

const s = {
  page:          { padding: '1.25rem', maxWidth: '1100px' },
  sectionTitle:  { margin: '0 0 0.75rem', fontSize: '1rem', color: '#1a2a1a', fontWeight: 600 },
  importSection: { background: '#f5f8f5', border: '1px solid #b0c4b0', borderRadius: '6px', padding: '1.25rem', marginBottom: '1.5rem' },
  listSection:   { background: '#f5f8f5', border: '1px solid #b0c4b0', borderRadius: '6px', padding: '1.25rem' },

  dropzone:      { border: '2px dashed #b0c4b0', borderRadius: '6px', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', minHeight: '80px', background: '#fff' },
  dropzoneActive:{ borderColor: '#4a8a4a', background: '#e8f5e8' },
  dropzoneFilled:{ borderColor: '#4caf7d', background: '#f0faf0' },
  dropIcon:      { fontSize: '1.4rem', color: '#aaa' },
  dropText:      { color: '#7a9a7a', fontSize: '0.85rem' },
  fileIcon:      { fontSize: '1.2rem' },
  fileName:      { color: '#2a7a4a', fontSize: '0.85rem', fontFamily: 'monospace' },

  nameRow:       { display: 'flex', alignItems: 'flex-end', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' },
  label:         { display: 'flex', flexDirection: 'column', gap: '0.3rem', color: '#5a7a5a', fontSize: '0.75rem' },
  input:         { background: '#fff', color: '#1a1a1a', border: '1px solid #b0c4b0', borderRadius: '4px', padding: '0.35rem 0.6rem', fontSize: '0.85rem', width: '140px' },
  importBtn:     { background: '#d0ecd0', border: '1px solid #7aaa7a', color: '#1a3a1a', borderRadius: '4px', cursor: 'pointer', padding: '0.4rem 1.25rem', fontSize: '0.85rem', fontWeight: 600 },
  importBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },

  success: { marginTop: '0.75rem', color: '#2a7a2a', fontSize: '0.82rem', padding: '0.4rem 0.75rem', background: '#e8f5e8', borderRadius: '4px', border: '1px solid #7aaa7a' },
  error:   { marginTop: '0.75rem', color: '#c0392b', fontSize: '0.82rem', padding: '0.4rem 0.75rem', background: '#fdecea', borderRadius: '4px', border: '1px solid #e57373' },

  listHeader:  { display: 'flex', alignItems: 'center', marginBottom: '0.75rem' },
  sortGroup:   { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' },
  sortLabel:   { color: '#7a9a7a', fontSize: '0.75rem' },
  sortBtn:     { background: '#eef3ee', border: '1px solid #b0c4b0', color: '#4a6a4a', borderRadius: '3px', cursor: 'pointer', padding: '0.15rem 0.5rem', fontSize: '0.72rem' },
  sortActive:  { background: '#b8d4b8', borderColor: '#4a8a4a', color: '#1a3a1a' },

  empty:       { color: '#7a9a7a', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' },
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' },
  th:          { background: '#d0ddd0', color: '#1a2a1a', fontWeight: 600, padding: '0.3rem 0.6rem', textAlign: 'left', borderBottom: '1px solid #b0c4b0' },
  rowEven:     { background: '#ffffff' },
  rowOdd:      { background: '#f5f7f5' },
  td:          { padding: '0.35rem 0.6rem', borderBottom: '1px solid #dde8dd', verticalAlign: 'middle' },
  fileCell:    { fontFamily: 'monospace', fontSize: '0.74rem', color: '#7a9a7a', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  projectName: { color: '#2a4a8a', cursor: 'pointer', borderBottom: '1px dashed #b0c4b0' },
  inlineInput: { background: '#fff', color: '#1a1a1a', border: '1px solid #5b9bd5', borderRadius: '3px', padding: '0.1rem 0.4rem', fontSize: '0.8rem', width: '120px' },
  turbineLink: { color: '#1a5a9a', cursor: 'pointer', fontWeight: 600 },
  paramCount:  { color: '#5a7a5a', fontFamily: 'monospace' },
  deleteBtn:   { background: 'none', border: '1px solid #d0d0d0', color: '#999', borderRadius: '3px', cursor: 'pointer', padding: '0.1rem 0.4rem', fontSize: '0.75rem', transition: 'all 0.1s' },
}
