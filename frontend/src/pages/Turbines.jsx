import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'

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
  const [importing, setImporting]       = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError]   = useState(null)
  const [dragging, setDragging]         = useState(false)
  const [editingProject, setEditingProject] = useState(null) // {id, name}
  const [cleaning, setCleaning]             = useState(false)
  const [cleanResult, setCleanResult]       = useState(null)
  const [sortBy, setSortBy]             = useState('project')
  const fileInputRef = useRef()
  const navigate = useNavigate()

  const loadTurbines = useCallback(() => {
    client.get('/turbines/list').then(r => setTurbines(r.data))
  }, [])

  useEffect(() => { loadTurbines() }, [loadTurbines])

  const onFileChosen = (f) => {
    if (!f) return
    setFile(f)
    setImportResult(null)
    setImportError(null)
    const parsed = parseFilename(f.name)
    setProjectName(parsed.project)
    setTurbineName(parsed.turbine)
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
      const r = await client.post('/import/create', fd)
      setImportResult(r.data)
      setFile(null)
      setProjectName('')
      setTurbineName('')
      loadTurbines()
    } catch (e) {
      setImportError(e.response?.data?.detail || 'Import failed')
    } finally {
      setImporting(false)
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
              style={{ ...s.sortBtn, color: cleaning ? '#555' : '#c0784a', borderColor: '#3a2a1a', marginRight: 8 }}
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
                  <th style={s.th}>Imported</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Parameters</th>
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
                    <td style={{ ...s.td, ...s.fileCell }}>{t.source_file || '—'}</td>
                    <td style={s.td}>{t.imported_at || '—'}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <span style={s.paramCount}>{t.param_count}</span>
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

const s = {
  page:          { padding: '1.25rem', maxWidth: '1100px' },
  sectionTitle:  { margin: '0 0 0.75rem', fontSize: '1rem', color: '#e0e0e0', fontWeight: 600 },
  importSection: { background: '#0d0d1e', border: '1px solid #1e1e30', borderRadius: '6px', padding: '1.25rem', marginBottom: '1.5rem' },
  listSection:   { background: '#0d0d1e', border: '1px solid #1e1e30', borderRadius: '6px', padding: '1.25rem' },

  dropzone:      { border: '2px dashed #2a2a45', borderRadius: '6px', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', minHeight: '80px' },
  dropzoneActive:{ borderColor: '#5b9bd5', background: '#0a1020' },
  dropzoneFilled:{ borderColor: '#4caf7d', background: '#0a1a10' },
  dropIcon:      { fontSize: '1.4rem', color: '#444' },
  dropText:      { color: '#555', fontSize: '0.85rem' },
  fileIcon:      { fontSize: '1.2rem' },
  fileName:      { color: '#4caf7d', fontSize: '0.85rem', fontFamily: 'monospace' },

  nameRow:       { display: 'flex', alignItems: 'flex-end', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' },
  label:         { display: 'flex', flexDirection: 'column', gap: '0.3rem', color: '#888', fontSize: '0.75rem' },
  input:         { background: '#1e1e2e', color: '#e0e0e0', border: '1px solid #333', borderRadius: '4px', padding: '0.35rem 0.6rem', fontSize: '0.85rem', width: '140px' },
  importBtn:     { background: '#1a3a5a', border: '1px solid #5b9bd5', color: '#5b9bd5', borderRadius: '4px', cursor: 'pointer', padding: '0.4rem 1.25rem', fontSize: '0.85rem', fontWeight: 600 },
  importBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },

  success: { marginTop: '0.75rem', color: '#4caf7d', fontSize: '0.82rem', padding: '0.4rem 0.75rem', background: '#0a1a0a', borderRadius: '4px', border: '1px solid #1a3a1a' },
  error:   { marginTop: '0.75rem', color: '#e74c3c', fontSize: '0.82rem', padding: '0.4rem 0.75rem', background: '#1a0a0a', borderRadius: '4px', border: '1px solid #3a1a1a' },

  listHeader:  { display: 'flex', alignItems: 'center', marginBottom: '0.75rem' },
  sortGroup:   { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' },
  sortLabel:   { color: '#555', fontSize: '0.75rem' },
  sortBtn:     { background: '#1e1e2e', border: '1px solid #2a2a45', color: '#666', borderRadius: '3px', cursor: 'pointer', padding: '0.15rem 0.5rem', fontSize: '0.72rem' },
  sortActive:  { background: '#1a2a3a', borderColor: '#5b9bd5', color: '#5b9bd5' },

  empty:       { color: '#444', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' },
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' },
  th:          { background: '#0a0a18', color: '#555', fontWeight: 600, padding: '0.3rem 0.6rem', textAlign: 'left', borderBottom: '1px solid #1e1e30' },
  rowEven:     { background: '#0a0a14' },
  rowOdd:      { background: '#0d0d1a' },
  td:          { padding: '0.35rem 0.6rem', borderBottom: '1px solid #12121e', verticalAlign: 'middle' },
  fileCell:    { fontFamily: 'monospace', fontSize: '0.74rem', color: '#666', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  projectName: { color: '#c0c0e0', cursor: 'pointer', borderBottom: '1px dashed #333' },
  inlineInput: { background: '#1e1e2e', color: '#e0e0e0', border: '1px solid #5b9bd5', borderRadius: '3px', padding: '0.1rem 0.4rem', fontSize: '0.8rem', width: '120px' },
  turbineLink: { color: '#5b9bd5', cursor: 'pointer', fontWeight: 600 },
  paramCount:  { color: '#888', fontFamily: 'monospace' },
  deleteBtn:   { background: 'none', border: '1px solid #2a1a1a', color: '#555', borderRadius: '3px', cursor: 'pointer', padding: '0.1rem 0.4rem', fontSize: '0.75rem', transition: 'all 0.1s' },
}
